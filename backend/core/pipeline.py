import json
import logging
import re
import time

logger = logging.getLogger(__name__)

from core.retriever import query_dual_channel
from core.llm import call_llm_simple
from core.task_types import TaskType
from models.schemas import (
    ChatResponse, SourceRef, EntityRef,
    RefinementOption, NearMissResult, RefinementContext,
)
from db.settings_store import get_setting_float, get_setting_int
from db.chat_store import get_session_round_count, get_session_history
from db.sqlite_db import get_connection


def process_query(session_id: str, user_message: str) -> tuple[ChatResponse, int]:
    """Retrieval-based pipeline: search question fingerprints, return navigation options.
    Three-bucket partitioning: high_conf (stage 2), near_miss (stage 4), discard (stage 3).
    Returns (ChatResponse, round_count)."""
    start_time = time.time()
    round_count = get_session_round_count(session_id) + 1

    # 1. Search question fingerprints
    threshold = get_setting_float("confidence_threshold", 0.3)
    near_miss_threshold = get_setting_float("near_miss_threshold", 0.15)
    matches = query_dual_channel(user_message, top_k=10)

    # 2. Three-bucket partitioning
    high_conf = [m for m in matches if m["confidence"] >= threshold]
    near_miss = [m for m in matches if near_miss_threshold <= m["confidence"] < threshold]

    # 3a. High confidence → stage 1 (direct content display)
    if high_conf:
        entity_refs = [
            {"entity_type": m["entity_type"], "entity_id": m["entity_id"],
             "matched_sections": m.get("matched_sections", [])}
            for m in high_conf
        ]
        content_items = retrieve_content(entity_refs)
        sources = _build_sources(high_conf)
        elapsed = round((time.time() - start_time) * 1000)
        return ChatResponse(
            reply="根据您的问题，我找到了以下相关资料：",
            stage=1,
            sources=sources,
            session_id=session_id,
            content_items=content_items,
            response_time_ms=elapsed,
        ), round_count

    # 3b. Near miss → stage 4 (progressive refinement)
    if near_miss:
        return _build_refinement_response(
            session_id, user_message, user_message, near_miss, 1, start_time
        ), round_count

    # 3c. Nothing → stage 3
    resp = _no_results_response(session_id, user_message)
    resp.response_time_ms = round((time.time() - start_time) * 1000)
    return resp, round_count


def process_refinement(
    session_id: str,
    original_query: str,
    refinement_text: str,
    refinement_round: int,
    keywords: list[str] | None = None,
    refined_query_from_option: str = "",
) -> tuple[ChatResponse, int]:
    """Handle a refinement round for progressive guidance.
    Uses LLM-rewritten query instead of naive concatenation.
    Returns (ChatResponse, round_count)."""
    start_time = time.time()
    round_count = get_session_round_count(session_id) + 1
    max_rounds = get_setting_int("max_refinement_rounds", 3)

    # Build refined query: prefer pre-generated from option, else LLM rewrite
    if refined_query_from_option:
        refined_query = refined_query_from_option
        logger.info("[refine] Using pre-generated refined_query: %s", refined_query)
    else:
        refined_query = _rewrite_query_with_llm(original_query, refinement_text, keywords or [])
        logger.info("[refine] LLM-rewritten query: %s", refined_query)

    # Re-search with refined query
    threshold = get_setting_float("confidence_threshold", 0.3)
    near_miss_threshold = get_setting_float("near_miss_threshold", 0.15)
    matches = query_dual_channel(refined_query, top_k=10)

    high_conf = [m for m in matches if m["confidence"] >= threshold]
    near_miss = [m for m in matches if near_miss_threshold <= m["confidence"] < threshold]

    # Success: refined query hit high confidence → stage 1 (direct content)
    if high_conf:
        entity_refs = [
            {"entity_type": m["entity_type"], "entity_id": m["entity_id"],
             "matched_sections": m.get("matched_sections", [])}
            for m in high_conf
        ]
        content_items = retrieve_content(entity_refs)
        sources = _build_sources(high_conf)
        elapsed = round((time.time() - start_time) * 1000)
        return ChatResponse(
            reply="根据您补充的信息，我找到了以下相关资料：",
            stage=1,
            sources=sources,
            session_id=session_id,
            content_items=content_items,
            response_time_ms=elapsed,
        ), round_count

    # Max rounds exhausted with near misses → stage 5
    if refinement_round >= max_rounds and near_miss:
        return _build_near_miss_response(
            session_id, original_query, refined_query, near_miss, start_time
        ), round_count

    # Still in buffer zone, more rounds available → stage 4
    if near_miss:
        return _build_refinement_response(
            session_id, original_query, refined_query,
            near_miss, refinement_round + 1, start_time
        ), round_count

    # Nothing at all → stage 3
    resp = _no_results_response(session_id, refined_query)
    resp.response_time_ms = round((time.time() - start_time) * 1000)
    return resp, round_count


def _rewrite_query_with_llm(original_query: str, user_selection: str, keywords: list[str]) -> str:
    """Use LLM to rewrite the user's query incorporating their refinement selection."""
    kw_str = "、".join(keywords) if keywords else ""
    prompt = (
        "请将以下用户问题根据补充信息重写为一个更精确的技术检索查询。\n"
        "要求：直接输出重写后的查询语句，不要解释，不要加引号。\n\n"
        f"原始问题：{original_query}\n"
        f"用户补充：{user_selection}\n"
    )
    if kw_str:
        prompt += f"关键术语：{kw_str}\n"

    try:
        raw, _ = call_llm_simple(prompt, task_type=TaskType.QUERY_REWRITE)
        rewritten = raw.strip().strip('"').strip("'")
        if rewritten:
            return rewritten
    except Exception:
        logger.warning("[rewrite] LLM rewrite failed, falling back to concatenation")

    # Fallback: concatenation with keyword repetition for vector weighting
    if keywords:
        return f"{original_query} {' '.join(keywords * 2)}"
    return f"{original_query} {user_selection}"


def _no_results_response(session_id: str, user_message: str = "") -> ChatResponse:
    """Return a response when no matching fingerprints are found."""
    # Record the no-result query for admin analytics (Feature 5)
    if user_message:
        try:
            import uuid
            from datetime import datetime
            conn = get_connection()
            conn.execute(
                "INSERT INTO no_result_queries (id, query_text, created_at) VALUES (?, ?, ?)",
                (uuid.uuid4().hex, user_message, datetime.utcnow().isoformat()),
            )
            conn.commit()
            conn.close()
        except Exception:
            pass
    return ChatResponse(
        reply="抱歉，在已审核的知识库中未找到相关记录。您可以尝试换个描述方式，或联系人工专家补充该知识资产。",
        stage=3,
        sources=[],
        session_id=session_id,
    )


def _build_sources(matches: list[dict]) -> list[SourceRef]:
    """Convert fingerprint matches to SourceRef list."""
    sources = []
    for m in matches:
        sources.append(SourceRef(
            type=m["entity_type"],
            id=m["entity_id"],
            title=m.get("title", ""),
            relevance_score=m["confidence"],
        ))
    return sources


def retrieve_content(entity_refs: list[dict]) -> list[dict]:
    """Retrieve full content from SQLite for given entity references.
    No LLM call — pure database lookup."""
    results = []
    conn = get_connection()
    try:
        for ref in entity_refs:
            et = ref.get("entity_type", "")
            eid = ref.get("entity_id", "")
            if et == "doc":
                row = conn.execute(
                    "SELECT id, title, cleaned_content FROM documents WHERE id = ?",
                    (eid,),
                ).fetchone()
                if row:
                    results.append({
                        "entity_type": "doc",
                        "entity_id": eid,
                        "title": row["title"] or "",
                        "content": row["cleaned_content"] or "",
                        "matched_sections": ref.get("matched_sections", []),
                    })
            elif et == "ticket":
                row = conn.execute(
                    "SELECT id, ticket_number, phenomenon, cause, solution "
                    "FROM tickets WHERE id = ?",
                    (eid,),
                ).fetchone()
                if row:
                    results.append({
                        "entity_type": "ticket",
                        "entity_id": eid,
                        "title": row["ticket_number"] or "",
                        "ticket_number": row["ticket_number"] or "",
                        "phenomenon": row["phenomenon"] or "",
                        "cause": row["cause"] or "",
                        "solution": row["solution"] or "",
                    })
            elif et == "doc_image":
                row = conn.execute(
                    "SELECT id, title, cleaned_content, image_assets FROM documents WHERE id = ?",
                    (eid,),
                ).fetchone()
                if row:
                    results.append({
                        "entity_type": "doc_image",
                        "entity_id": eid,
                        "title": row["title"] or "",
                        "content": row["cleaned_content"] or "",
                        "image_url": ref.get("image_url", ""),
                    })
    finally:
        conn.close()
    return results


def _build_refinement_response(
    session_id: str,
    original_query: str,
    current_query: str,
    near_miss: list[dict],
    refinement_round: int,
    start_time: float,
) -> ChatResponse:
    """Build a stage=4 progressive refinement response."""
    max_rounds = get_setting_int("max_refinement_rounds", 3)

    # Build near miss result summaries
    nm_results = _matches_to_near_miss(near_miss)

    # Build refinement options using current_query (not original) so each round differs
    refinement_options = _build_refinement_options(current_query, near_miss, original_query)

    context = RefinementContext(
        original_query=original_query,
        current_query=current_query,
        refinement_round=refinement_round,
        max_rounds=max_rounds,
        near_miss_matches=nm_results,
    )

    elapsed = round((time.time() - start_time) * 1000)
    return ChatResponse(
        reply="检索到以下近似方向，请选择最接近您问题的技术特征：",
        stage=4,
        sources=[],
        session_id=session_id,
        refinement_options=refinement_options,
        refinement_context=context,
        near_miss_results=nm_results,
        response_time_ms=elapsed,
    )


def _build_near_miss_response(
    session_id: str,
    original_query: str,
    refined_query: str,
    near_miss: list[dict],
    start_time: float,
) -> ChatResponse:
    """Build a stage=5 near-miss exhausted response."""
    max_rounds = get_setting_int("max_refinement_rounds", 3)
    nm_results = _matches_to_near_miss(near_miss)

    context = RefinementContext(
        original_query=original_query,
        current_query=refined_query,
        refinement_round=max_rounds,
        max_rounds=max_rounds,
        near_miss_matches=nm_results,
    )

    elapsed = round((time.time() - start_time) * 1000)
    return ChatResponse(
        reply="经过多轮细化仍未找到精确匹配的结果，以下是一些近似的参考信息：",
        stage=5,
        sources=[],
        session_id=session_id,
        refinement_context=context,
        near_miss_results=nm_results,
        response_time_ms=elapsed,
    )


def _matches_to_near_miss(matches: list[dict]) -> list[NearMissResult]:
    """Convert match dicts to NearMissResult list with snippets."""
    results = []
    conn = get_connection()
    try:
        for m in matches:
            snippet = ""
            et = m["entity_type"]
            eid = m["entity_id"]
            if et == "doc":
                row = conn.execute(
                    "SELECT cleaned_content FROM documents WHERE id = ?", (eid,)
                ).fetchone()
                if row and row["cleaned_content"]:
                    snippet = row["cleaned_content"][:100]
            elif et == "ticket":
                row = conn.execute(
                    "SELECT phenomenon FROM tickets WHERE id = ?", (eid,)
                ).fetchone()
                if row and row["phenomenon"]:
                    snippet = row["phenomenon"][:100]
            results.append(NearMissResult(
                entity_type=et,
                entity_id=eid,
                title=m.get("title", ""),
                confidence=m["confidence"],
                snippet=snippet,
            ))
    finally:
        conn.close()
    return results


def _build_refinement_options(current_query: str, near_miss: list[dict], original_query: str = "") -> list[RefinementOption]:
    """Generate clarifying refinement options that narrow the user's query semantically.
    Uses current_query (which evolves each round) so options differ across rounds.
    Each option includes a pre-generated refined_query for direct re-search."""
    if len(near_miss) <= 2:
        return _keyword_refinement_options(current_query, near_miss)

    match_descriptions = "\n".join(
        f"- 文档{i+1} [{m['entity_type']}] 《{m.get('title', '')}》: "
        f"{m.get('question_text', '')} (置信度: {m['confidence']:.2f})"
        for i, m in enumerate(near_miss[:5])
    )

    # Build query context
    query_section = f"用户问题：{current_query}\n"
    if original_query and original_query != current_query:
        query_section = (
            f"用户原始问题：{original_query}\n"
            f"经过细化后的当前查询：{current_query}\n"
            f"（用户已经做过细化，请提取与之前不同的新技术实体方向）\n"
        )

    prompt = (
        "## 角色\n"
        "你是一名工业技术诊断专家，擅长从技术文档中提取区分性实体。\n\n"
        "## 任务\n"
        "用户提出了一个技术问题，系统检索到了一些近似但不够精确的参考文档。\n"
        "请分析这些参考文档之间的技术差异，提取出能够区分不同故障方向的关键实体。\n\n"
        f"## 输入\n{query_section}\n"
        f"参考文档：\n{match_descriptions}\n\n"
        "## 约束\n"
        "1. 严禁生成疑问句，选项不得以\"？\"或\"?\"结尾\n"
        "2. label必须是具体的技术实体描述（设备部件/故障现象/技术参数），"
        "例如\"电源模块过热\"、\"主轴轴承异响\"、\"PLC通信超时\"\n"
        "3. 每个选项必须包含2-3个从参考文档中提取的区分性检索关键词\n"
        "4. keywords必须是文档中实际出现的技术术语，不得自行编造\n"
        "5. description简要说明该方向对应的参考文档来源\n\n"
        "## 输出格式\n"
        "返回3-5个选项，严格JSON格式：\n"
        '{{"options": [{{"label": "故障/部件/参数描述", '
        '"description": "来源：相关文档标题", '
        '"keywords": ["术语1", "术语2", "术语3"]}}]}}\n\n'
        "注意：不要在options中包含refined_query字段，系统会自动构建检索查询。"
    )

    try:
        raw, _ = call_llm_simple(prompt, task_type=TaskType.GUIDANCE_GROUPING)
        options = _parse_refinement_options(raw, current_query)
        if options:
            return options
        logger.info("[refinement] LLM options failed validation, using keyword fallback")
    except Exception:
        logger.warning("[refinement] LLM call failed, using keyword fallback")
    return _keyword_refinement_options(current_query, near_miss)


def _extract_keywords_chinese(text: str, max_kw: int = 5) -> list[str]:
    """Extract keyword segments from Chinese/mixed text.

    Uses regex to pull out Chinese 2-4 char segments and non-Chinese words.
    This is a simple heuristic — no external segmentation library needed.
    """
    # Extract Chinese character runs (2-4 chars each) as pseudo-words
    cn_runs = re.findall(r'[\u4e00-\u9fff]{2,}', text)
    keywords: list[str] = []
    for run in cn_runs:
        # Slide 2-char bigrams from each run for better granularity
        if len(run) <= 4:
            keywords.append(run)
        else:
            for j in range(0, len(run) - 1, 2):
                keywords.append(run[j:j + 2])
    # Also grab any non-Chinese tokens (English words, numbers, model names)
    non_cn = re.findall(r'[A-Za-z0-9][\w\-\.]*[A-Za-z0-9]', text)
    keywords.extend(non_cn)
    # Deduplicate while preserving order
    seen: set[str] = set()
    unique: list[str] = []
    for kw in keywords:
        if kw not in seen:
            seen.add(kw)
            unique.append(kw)
    return unique[:max_kw]


def _keyword_refinement_options(current_query: str, near_miss: list[dict]) -> list[RefinementOption]:
    """Fallback: extract keywords from near-miss matches as refinement options.
    Uses keyword repetition for vector space weighting."""
    options = []
    for i, m in enumerate(near_miss[:5]):
        question = m.get("question_text", "")
        title = m.get("title", "")
        label = question if question else title
        if not label:
            continue
        kw_source = f"{title} {question}".strip()
        keywords = _extract_keywords_chinese(kw_source)
        # Programmatic refined_query with keyword repetition
        if keywords:
            refined = f"{current_query} {' '.join(keywords * 2)}"
        else:
            refined = current_query
        logger.info("[fallback-kw] near_miss[%d] title=%s keywords=%s", i, title, keywords)
        options.append(RefinementOption(
            id=str(i + 1),
            label=label,
            description=f"来源：{m['entity_type']} 《{title}》",
            keywords=keywords,
            refined_query=refined,
        ))
    return options


def _parse_refinement_options(raw: str, user_query: str = "") -> list[RefinementOption]:
    """Parse LLM-generated refinement options from JSON response.
    Validates labels (rejects question-style), constructs refined_query programmatically."""
    start = raw.find("{")
    end = raw.rfind("}") + 1
    if start < 0 or end <= start:
        return []

    data = json.loads(raw[start:end])
    raw_options = data.get("options", [])
    options = []
    rejected_count = 0
    for i, opt in enumerate(raw_options):
        label = opt.get("label", "").strip()
        if not label:
            continue
        # Question-mark interceptor: reject conversational labels
        if label.endswith("？") or label.endswith("?"):
            logger.warning("[refinement] Rejected question-style label: %s", label)
            rejected_count += 1
            continue
        keywords = opt.get("keywords", [])
        # Construct refined_query programmatically with keyword repetition for weighting
        if keywords:
            refined = f"{user_query} {' '.join(keywords * 2)}"
        else:
            refined = user_query
        options.append(RefinementOption(
            id=str(i + 1),
            label=label,
            description=opt.get("description", ""),
            keywords=keywords,
            refined_query=refined,
        ))
    # If more than half were rejected, signal failure (caller uses fallback)
    total_attempted = len(raw_options)
    if total_attempted > 0 and rejected_count > total_attempted / 2:
        logger.warning("[refinement] >50%% options rejected as questions (%d/%d), returning empty",
                       rejected_count, total_attempted)
        return []
    return options
