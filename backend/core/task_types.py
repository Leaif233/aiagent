"""Task type definitions and provider registry for model dispatch."""

from enum import Enum


class TaskType(str, Enum):
    TEXT_CLEANING = "text_cleaning"
    DOC_CLEANING = "doc_cleaning"
    MULTIMODAL_CLEANING = "multimodal_cleaning"
    FINGERPRINT_EXTRACTION = "fingerprint_extraction"
    GUIDANCE_GROUPING = "guidance_grouping"
    QUERY_REWRITE = "query_rewrite"
    CHAT_DIALOGUE = "chat_dialogue"


class Capability(str, Enum):
    TEXT = "text"
    VISION = "vision"


TASK_CAPABILITY = {
    TaskType.TEXT_CLEANING: Capability.TEXT,
    TaskType.DOC_CLEANING: Capability.TEXT,
    TaskType.MULTIMODAL_CLEANING: Capability.VISION,
    TaskType.FINGERPRINT_EXTRACTION: Capability.TEXT,
    TaskType.GUIDANCE_GROUPING: Capability.TEXT,
    TaskType.QUERY_REWRITE: Capability.TEXT,
    TaskType.CHAT_DIALOGUE: Capability.TEXT,
}


PROVIDER_REGISTRY = {
    "claude": {
        "capabilities": {Capability.TEXT, Capability.VISION},
        "api_key_setting": "anthropic_api_key",
        "default_text_model": "claude-sonnet-4-5-20250929",
        "default_vision_model": "claude-sonnet-4-5-20250929",
    },
    "deepseek": {
        "capabilities": {Capability.TEXT},
        "api_key_setting": "deepseek_api_key",
        "default_text_model": "deepseek-chat",
    },
    "dashscope": {
        "capabilities": {Capability.TEXT, Capability.VISION},
        "api_key_setting": "dashscope_api_key",
        "default_text_model": "qwen3-vl-plus",
        "default_vision_model": "qwen3-vl-plus",
    },
}


def validate_task_provider(task_type: TaskType, provider: str) -> bool:
    """Check if a provider supports the capability required by a task."""
    required = TASK_CAPABILITY.get(task_type)
    if not required:
        return True
    info = PROVIDER_REGISTRY.get(provider)
    if not info:
        return False
    return required in info["capabilities"]


def get_available_providers() -> dict:
    """Return providers with their configuration status."""
    from db.settings_store import get_setting
    result = {}
    for name, info in PROVIDER_REGISTRY.items():
        key = get_setting(info["api_key_setting"])
        result[name] = {
            "configured": bool(key),
            "capabilities": [c.value for c in info["capabilities"]],
        }
    return result
