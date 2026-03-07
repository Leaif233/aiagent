import os
import time

import anthropic

import config
from db.settings_store import get_setting, get_setting_int
from core.task_types import TaskType

_claude_client = None
_deepseek_client = None
_dashscope_client = None

BASE_SYSTEM_PROMPT = """你是一个集成在企业内部知识管理系统中的"智能客服助手"。你的核心使命是基于两个经过严格审核的数据库（技术文档库、工单库）为工程师提供确定性、权威性的解答。

安全红线：严禁调用状态为"待审核"的内容。
知识闭环：你所有的回答必须溯源至库内资产。

语言风格：
- 使用工程师习惯的术语，严禁使用含糊词（如"大概"、"可能"）。
- 多使用 Markdown 的标题、列表和加粗来提高可读性。
- 如果已审核库中无相关内容，请礼貌告知："抱歉，在已审核的知识库中未找到相关记录，您可以尝试联系人工专家补充该知识资产。"
"""

STAGE_INSTRUCTIONS = {
    1: "直接展示已审核的原始文档/工单内容，不做额外生成。",
    2: (
        "分析检索到的问题指纹列表，将相似的归纳为2-5个方向选项。\n"
        "每个方向用一句简短的标签描述，并列出属于该方向的条目索引。\n"
        '以JSON格式返回：{"options": [{"label": "方向标签", "description": "简要说明", "indices": [0, 1]}]}'
    ),
    3: (
        "未找到匹配的已审核知识。礼貌告知用户，建议换个描述方式或联系人工专家。"
    ),
}


def _get_claude_client():
    global _claude_client
    api_key = get_setting("anthropic_api_key") or config.ANTHROPIC_API_KEY
    if _claude_client is None and api_key:
        _claude_client = anthropic.Anthropic(api_key=api_key)
    return _claude_client


def _get_deepseek_client():
    global _deepseek_client
    if _deepseek_client is None:
        from openai import OpenAI
        api_key = get_setting("deepseek_api_key") or os.getenv("DEEPSEEK_API_KEY", "")
        base_url = get_setting("deepseek_base_url") or "https://api.deepseek.com"
        if api_key:
            _deepseek_client = OpenAI(api_key=api_key, base_url=base_url)
    return _deepseek_client


def _get_dashscope_client():
    global _dashscope_client
    if _dashscope_client is None:
        from openai import OpenAI
        api_key = get_setting("dashscope_api_key") or config.DASHSCOPE_API_KEY
        if api_key:
            _dashscope_client = OpenAI(
                api_key=api_key,
                base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
            )
    return _dashscope_client


def _resolve_provider_model(task_type: TaskType = None) -> tuple[str, str]:
    """Resolve provider+model for a given task type.
    Priority: per-task setting > global setting > hardcoded default.
    """
    provider = ""
    model = ""
    if task_type:
        provider = get_setting(f"task_route_{task_type.value}_provider") or ""
        model = get_setting(f"task_route_{task_type.value}_model") or ""
    if not provider:
        provider = get_setting("llm_provider") or "deepseek"
    if not model:
        if provider == "claude":
            model = get_setting("llm_model_claude") or "claude-sonnet-4-5-20250929"
        elif provider == "dashscope":
            model = get_setting("llm_model_qwen_vl") or "qwen3-vl-plus"
        else:
            model = get_setting("llm_model_deepseek") or "deepseek-chat"
    return provider, model


def _log_usage(task_type, provider, model, usage, latency_ms, success=True):
    """Log LLM usage to database. Never raises."""
    try:
        from db.usage_store import log_llm_usage
        inp = usage.get("input_tokens", 0) or usage.get("prompt_tokens", 0)
        out = usage.get("output_tokens", 0) or usage.get("completion_tokens", 0)
        total = usage.get("total_tokens", 0) or (inp + out)
        log_llm_usage(
            task_type=task_type.value if task_type else "unknown",
            provider=provider,
            model=model,
            input_tokens=inp,
            output_tokens=out,
            total_tokens=total,
            latency_ms=latency_ms,
            success=success,
        )
    except Exception:
        pass


def build_context_block(doc_results, ticket_results):
    """Build retrieved context string for the system prompt."""
    parts = []

    if doc_results and doc_results.get("documents", [[]])[0]:
        parts.append("【已检索到的技术文档】")
        docs = doc_results["documents"][0]
        metas = doc_results["metadatas"][0]
        dists = doc_results["distances"][0]
        for doc, meta, dist in zip(docs, metas, dists):
            confidence = 1 / (1 + dist)
            title = meta.get("title", "未知文档")
            parts.append(f"[{title}] (置信度: {confidence:.2f}): {doc[:500]}")

    if ticket_results and ticket_results.get("documents", [[]])[0]:
        parts.append("\n【已检索到的工单记录】")
        docs = ticket_results["documents"][0]
        metas = ticket_results["metadatas"][0]
        for doc, meta in zip(docs, metas):
            tid = meta.get("ticket_number", meta.get("ticket_id", ""))
            parts.append(f"[{tid}]: {doc[:500]}")

    return "\n".join(parts)


def call_llm(stage: int, context: str, messages: list[dict],
             task_type: TaskType = None) -> tuple[str, dict]:
    """Call LLM with dynamic system prompt. Returns (text, usage_dict)."""
    system_prompt = (
        f"{BASE_SYSTEM_PROMPT}\n\n"
        f"{context}\n\n"
        f"【当前阶段指令】\n{STAGE_INSTRUCTIONS[stage]}"
    )
    max_tokens = get_setting_int("llm_max_tokens", 2048)
    provider, model = _resolve_provider_model(task_type or TaskType.CHAT_DIALOGUE)

    start = time.time()
    usage = {}
    success = True
    try:
        if provider == "claude":
            text, usage = _call_claude(system_prompt, messages, max_tokens, model_override=model)
        elif provider == "dashscope":
            text, usage = _call_dashscope_text(system_prompt, messages, max_tokens, model_override=model)
        else:
            text, usage = _call_deepseek(system_prompt, messages, max_tokens, model_override=model)
        return text, usage
    except Exception:
        success = False
        raise
    finally:
        _log_usage(task_type or TaskType.CHAT_DIALOGUE, provider, model, usage,
                   round((time.time() - start) * 1000), success)


def _call_claude(system_prompt: str, messages: list[dict], max_tokens: int,
                 model_override: str = None) -> tuple[str, dict]:
    """Call Claude via Anthropic SDK. Returns (text, usage_dict)."""
    client = _get_claude_client()
    model = model_override or get_setting("llm_model_claude") or "claude-sonnet-4-5-20250929"
    response = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system_prompt,
        messages=messages,
    )
    usage = {}
    if hasattr(response, "usage") and response.usage:
        usage = {
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens,
            "total_tokens": response.usage.input_tokens + response.usage.output_tokens,
        }
    return response.content[0].text, usage


def _call_deepseek(system_prompt: str, messages: list[dict], max_tokens: int,
                   model_override: str = None) -> tuple[str, dict]:
    """Call DeepSeek via OpenAI-compatible SDK. Returns (text, usage_dict)."""
    client = _get_deepseek_client()
    model = model_override or get_setting("llm_model_deepseek") or "deepseek-chat"
    oai_messages = [{"role": "system", "content": system_prompt}] + messages
    response = client.chat.completions.create(
        model=model,
        max_tokens=max_tokens,
        messages=oai_messages,
    )
    usage = {}
    if hasattr(response, "usage") and response.usage:
        usage = {
            "prompt_tokens": response.usage.prompt_tokens,
            "completion_tokens": response.usage.completion_tokens,
            "total_tokens": response.usage.total_tokens,
        }
    return response.choices[0].message.content, usage


def call_llm_simple(prompt: str, task_type: TaskType = None) -> tuple[str, dict]:
    """Simple single-prompt LLM call. Returns (text, usage_dict)."""
    messages = [{"role": "user", "content": prompt}]
    max_tokens = get_setting_int("llm_max_tokens", 1024)
    provider, model = _resolve_provider_model(task_type)

    start = time.time()
    usage = {}
    success = True
    try:
        if provider == "claude":
            text, usage = _call_claude("", messages, max_tokens, model_override=model)
        elif provider == "dashscope":
            text, usage = _call_dashscope_text("", messages, max_tokens, model_override=model)
        else:
            text, usage = _call_deepseek("", messages, max_tokens, model_override=model)
        return text, usage
    except Exception:
        success = False
        raise
    finally:
        _log_usage(task_type, provider, model, usage,
                   round((time.time() - start) * 1000), success)


def call_llm_multimodal(prompt: str, images_b64: list[dict],
                        task_type: TaskType = None) -> tuple[str, dict]:
    """Multimodal LLM call with images. Routes by task_type config.
    Falls back: configured provider → dashscope → claude → text-only.

    Args:
        prompt: Text prompt
        images_b64: List of {"data": base64_str, "media_type": "image/png"}
        task_type: Optional task type for routing

    Returns (text, usage_dict).
    """
    tt = task_type or TaskType.MULTIMODAL_CLEANING
    provider, model = _resolve_provider_model(tt)
    start = time.time()
    usage = {}
    success = True

    try:
        # Try configured provider first
        if provider == "dashscope":
            client = _get_dashscope_client()
            if client:
                text, usage = _call_qwen3_vl(client, prompt, images_b64, model_override=model)
                return text, usage
        elif provider == "claude":
            client = _get_claude_client()
            if client:
                text, usage = _call_claude_multimodal(client, prompt, images_b64, model_override=model)
                return text, usage

        # Fallback chain: dashscope → claude → text-only
        ds = _get_dashscope_client()
        if ds:
            try:
                text, usage = _call_qwen3_vl(ds, prompt, images_b64)
                return text, usage
            except Exception:
                pass
        cl = _get_claude_client()
        if cl:
            try:
                text, usage = _call_claude_multimodal(cl, prompt, images_b64)
                return text, usage
            except Exception:
                pass
        text, usage = call_llm_simple(prompt, task_type=task_type)
        return text, usage
    except Exception:
        success = False
        raise
    finally:
        _log_usage(tt, provider, model, usage,
                   round((time.time() - start) * 1000), success)


def _call_dashscope_text(system_prompt: str, messages: list[dict], max_tokens: int,
                         model_override: str = None) -> tuple[str, dict]:
    """Call DashScope text model via OpenAI-compatible API."""
    client = _get_dashscope_client()
    model = model_override or get_setting("llm_model_qwen_vl") or "qwen3-vl-plus"
    oai_messages = [{"role": "system", "content": system_prompt}] + messages if system_prompt else messages
    response = client.chat.completions.create(
        model=model,
        max_tokens=max_tokens,
        messages=oai_messages,
    )
    usage = {}
    if hasattr(response, "usage") and response.usage:
        usage = {
            "prompt_tokens": response.usage.prompt_tokens,
            "completion_tokens": response.usage.completion_tokens,
            "total_tokens": response.usage.total_tokens,
        }
    return response.choices[0].message.content, usage


def _call_qwen3_vl(client, prompt: str, images_b64: list[dict],
                   model_override: str = None) -> tuple[str, dict]:
    """Call Qwen3-VL via DashScope OpenAI-compatible API."""
    content_parts = []
    for img in images_b64:
        mt = img.get("media_type", "image/png")
        content_parts.append({
            "type": "image_url",
            "image_url": {"url": f"data:{mt};base64,{img['data']}"},
        })
    content_parts.append({"type": "text", "text": prompt})

    model = model_override or get_setting("llm_model_qwen_vl") or "qwen3-vl-plus"
    max_tokens = get_setting_int("llm_max_tokens", 2048)

    response = client.chat.completions.create(
        model=model,
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": content_parts}],
    )
    usage = {}
    if hasattr(response, "usage") and response.usage:
        usage = {
            "prompt_tokens": response.usage.prompt_tokens,
            "completion_tokens": response.usage.completion_tokens,
            "total_tokens": response.usage.total_tokens,
        }
    return response.choices[0].message.content, usage


def _call_claude_multimodal(client, prompt: str, images_b64: list[dict],
                           model_override: str = None) -> tuple[str, dict]:
    """Call Claude with vision via Anthropic SDK."""
    content_parts = []
    for img in images_b64:
        content_parts.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": img.get("media_type", "image/png"),
                "data": img["data"],
            },
        })
    content_parts.append({"type": "text", "text": prompt})

    model = model_override or get_setting("llm_model_claude") or "claude-sonnet-4-5-20250929"
    max_tokens = get_setting_int("llm_max_tokens", 2048)

    response = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": content_parts}],
    )
    usage = {}
    if hasattr(response, "usage") and response.usage:
        usage = {
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens,
            "total_tokens": response.usage.input_tokens + response.usage.output_tokens,
        }
    return response.content[0].text, usage
