import json
import re

from core.llm import call_llm_simple
from core.task_types import TaskType


def split_into_sections(content: str) -> list[dict]:
    """Split markdown content by heading lines (#~####).
    Returns list of {"section_title": str, "section_content": str}.
    """
    pattern = r'^(#{1,4})\s+(.+)$'
    lines = content.split('\n')
    sections = []
    current_title = ""
    current_lines = []

    for line in lines:
        match = re.match(pattern, line.strip())
        if match:
            if current_lines:
                text = '\n'.join(current_lines).strip()
                if text:
                    sections.append({"section_title": current_title, "section_content": text})
            current_title = match.group(2).strip()
            current_lines = []
        else:
            current_lines.append(line)

    if current_lines:
        text = '\n'.join(current_lines).strip()
        if text:
            sections.append({"section_title": current_title, "section_content": text})

    if not sections:
        sections.append({"section_title": "", "section_content": content.strip()})

    return sections


def extract_section_fingerprints(
    doc_id: str, section_title: str, section_content: str, doc_title: str
) -> list[dict]:
    """Extract 3-5 question fingerprints from a single document section."""
    context_hint = f"文档标题：{doc_title}\n"
    if section_title:
        context_hint += f"章节标题：{section_title}\n"

    prompt = (
        "以下是一篇技术文档中某个章节的内容，请提取3-5个用户可能会问的问题。\n"
        "每个问题用一句话描述，要具体、明确，紧扣本章节内容。\n\n"
        f"{context_hint}"
        f"章节内容：\n{section_content[:3000]}\n\n"
        '请以JSON数组格式返回：\n'
        '[{"question_text": "问题描述"}]'
    )
    raw, _usage = call_llm_simple(prompt, task_type=TaskType.FINGERPRINT_EXTRACTION)
    results = _parse_fingerprints(raw)
    for fp in results:
        fp["section_title"] = section_title
    return results


def extract_doc_fingerprints(
    doc_id: str, cleaned_content: str, title: str
) -> list[dict]:
    """Extract question fingerprints from a document, section by section."""
    sections = split_into_sections(cleaned_content)
    all_fingerprints = []

    for section in sections:
        if len(section["section_content"]) < 50:
            continue
        fps = extract_section_fingerprints(
            doc_id, section["section_title"], section["section_content"], title
        )
        all_fingerprints.extend(fps)

    # Fallback: if section splitting produced nothing, use whole-doc extraction
    if not all_fingerprints:
        prompt = (
            "以下是一篇技术文档，请提取3-8个用户可能会问的问题。\n"
            "每个问题用一句话描述，要具体、明确。\n\n"
            f"文档标题：{title}\n"
            f"文档内容：\n{cleaned_content[:3000]}\n\n"
            '请以JSON数组格式返回：\n'
            '[{"question_text": "问题描述", "section_title": "章节标题(可选)"}]'
        )
        raw, _usage = call_llm_simple(prompt, task_type=TaskType.FINGERPRINT_EXTRACTION)
        all_fingerprints = _parse_fingerprints(raw)

    return all_fingerprints


def extract_ticket_fingerprints(
    ticket_id: str, phenomenon: str, cause: str
) -> list[dict]:
    """Extract question fingerprints from a ticket using AI."""
    results = []
    # The phenomenon itself is the primary question fingerprint
    if phenomenon and phenomenon.strip():
        results.append({"question_text": phenomenon.strip(), "section_title": ""})

    # Use AI to generate 1-3 synonym variants
    prompt = (
        "以下是一个技术工单的故障现象描述，请生成1-3个不同表述方式的问题变体。\n"
        "每个变体用一句话描述，要保持语义一致但措辞不同。\n\n"
        f"故障现象：{phenomenon}\n"
        f"故障原因：{cause}\n\n"
        '请以JSON数组格式返回：[{"question_text": "问题变体"}]'
    )
    try:
        raw, _usage = call_llm_simple(prompt, task_type=TaskType.FINGERPRINT_EXTRACTION)
        variants = _parse_fingerprints(raw)
        for v in variants:
            v["section_title"] = ""
        results.extend(variants)
    except Exception:
        pass

    return results


def _parse_fingerprints(raw: str) -> list[dict]:
    """Parse JSON array of fingerprints from LLM response."""
    try:
        start = raw.find("[")
        end = raw.rfind("]") + 1
        if start >= 0 and end > start:
            items = json.loads(raw[start:end])
            results = []
            for item in items:
                qt = item.get("question_text", "").strip()
                if qt:
                    results.append({
                        "question_text": qt,
                        "section_title": item.get("section_title", ""),
                    })
            return results
    except (json.JSONDecodeError, KeyError):
        pass
    return []
