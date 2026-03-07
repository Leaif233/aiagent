import json

from core.llm import call_llm_simple, call_llm_multimodal
from core.task_types import TaskType
from db.settings_store import get_setting

DEFAULT_CLEANING_PROMPT = (
    "请从以下工单原始文本中提取结构化信息。\n"
    "严格按照JSON格式返回，不要添加任何其他文字：\n"
    '{"phenomenon": "现象描述", "cause": "根因分析", "solution": "解决方案"}\n\n'
    "工单原始文本：\n"
)


def clean_ticket_text(raw_text: str) -> dict:
    """Use LLM to extract structured fields from raw ticket text.

    Returns:
        {"phenomenon": str, "cause": str, "solution": str}
    """
    custom_prompt = get_setting("cleaning_prompt")
    if custom_prompt:
        prompt = f"{custom_prompt}\n\n工单原始文本：\n{raw_text}"
    else:
        prompt = f"{DEFAULT_CLEANING_PROMPT}{raw_text}"

    reply, _usage = call_llm_simple(prompt, task_type=TaskType.TEXT_CLEANING)

    try:
        start = reply.find("{")
        end = reply.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(reply[start:end])
    except (json.JSONDecodeError, KeyError):
        pass

    return {
        "phenomenon": raw_text[:200],
        "cause": "",
        "solution": "",
    }


DOC_CLEANING_PROMPT = (
    "请将以下技术文档原始文本整理为结构清晰的Markdown格式。\n"
    "要求：\n"
    "1. 保留所有技术细节和关键信息，不要遗漏\n"
    "2. 使用合适的标题层级(##/###)组织内容\n"
    "3. 使用列表、表格等Markdown元素提高可读性\n"
    "4. 修正明显的OCR错误或格式混乱\n"
    "5. 如果文本中包含图片引用(![image](url))，请保留原样\n"
    "6. 直接返回整理后的Markdown文本，不要添加额外说明\n\n"
    "文档原始文本：\n"
)


def clean_doc_text(raw_text: str, image_urls: list[str] = None,
                   image_base64_list: list[dict] = None) -> str:
    """Use LLM to clean and restructure document text into Markdown.
    When images are available, uses multimodal Claude for vision understanding.

    Returns cleaned markdown string. Falls back to raw_text on failure.
    """
    if not raw_text or not raw_text.strip():
        return ""

    # Truncate very long docs to avoid token limits
    text_to_clean = raw_text[:8000]

    image_hint = ""
    if image_urls:
        image_hint = (
            f"\n注意：文档中包含{len(image_urls)}张图片，"
            "请根据图片内容在合适的位置描述图片含义并保留图片引用。\n"
        )

    custom_prompt = get_setting("doc_cleaning_prompt")
    if custom_prompt:
        prompt = f"{custom_prompt}{image_hint}\n\n文档原始文本：\n{text_to_clean}"
    else:
        prompt = f"{DOC_CLEANING_PROMPT}{image_hint}{text_to_clean}"

    try:
        # Use multimodal when images are available
        if image_base64_list:
            reply, _usage = call_llm_multimodal(prompt, image_base64_list, task_type=TaskType.MULTIMODAL_CLEANING)
        else:
            reply, _usage = call_llm_simple(prompt, task_type=TaskType.DOC_CLEANING)
        if reply and reply.strip():
            return reply.strip()
    except Exception:
        pass

    return raw_text
