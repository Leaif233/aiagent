from fastapi import APIRouter, Depends, HTTPException

from db.settings_store import get_all_settings, set_many_settings, get_setting
from db.chroma_client import get_docs_collection, get_tickets_collection
from core.auth import get_current_user, require_admin, CurrentUser
from models.schemas import SettingsUpdateRequest
import config

router = APIRouter(prefix="/api/settings", tags=["settings"])


API_KEY_FIELDS = {"anthropic_api_key", "deepseek_api_key", "dashscope_api_key"}


def _mask_keys(data: dict) -> dict:
    """Mask API key values, showing only last 4 chars."""
    result = dict(data)
    for key in API_KEY_FIELDS:
        val = result.get(key, "")
        if val and len(val) > 4:
            result[key] = "****" + val[-4:]
    return result


@router.get("")
async def read_settings(user: CurrentUser = Depends(require_admin)):
    """Return all settings merged with defaults, API keys masked."""
    return _mask_keys(get_all_settings())


@router.patch("")
async def update_settings(body: SettingsUpdateRequest, user: CurrentUser = Depends(require_admin)):
    """Bulk update settings. Skip masked API key values."""
    data = body.model_dump()
    if not data:
        return {"status": "no changes"}
    # Skip API keys that are still masked
    filtered = {
        k: v for k, v in data.items()
        if not (k in API_KEY_FIELDS and isinstance(v, str) and v.startswith("****"))
    }
    if filtered:
        # Validate task routing provider assignments
        from core.task_types import TaskType, validate_task_provider
        for key, value in filtered.items():
            if key.startswith("task_route_") and key.endswith("_provider") and value:
                task_name = key.replace("task_route_", "").replace("_provider", "")
                try:
                    tt = TaskType(task_name)
                    if not validate_task_provider(tt, value):
                        raise HTTPException(
                            status_code=400,
                            detail=f"服务商 '{value}' 不支持任务 '{task_name}' 所需的能力",
                        )
                except ValueError:
                    pass
        set_many_settings(filtered)
    return {"status": "updated", "keys": list(filtered.keys())}


@router.get("/status")
async def system_status(user: CurrentUser = Depends(require_admin)):
    """Return system health: Redis, ChromaDB, storage."""
    status = {
        "redis": "unknown",
        "chroma_docs": 0,
        "chroma_tickets": 0,
        "upload_dir": config.UPLOAD_DIR,
        "image_dir": config.IMAGE_DIR,
    }

    # Redis check
    try:
        import redis
        r = redis.from_url(config.REDIS_URL, socket_timeout=2)
        r.ping()
        status["redis"] = "connected"
    except Exception:
        status["redis"] = "disconnected"

    # ChromaDB counts
    try:
        status["chroma_docs"] = get_docs_collection().count()
        status["chroma_tickets"] = get_tickets_collection().count()
    except Exception:
        pass

    return status


@router.get("/llm-status")
async def llm_status(user: CurrentUser = Depends(get_current_user)):
    """Return LLM provider info, available providers, and per-task routing."""
    import os
    from core.task_types import TaskType, get_available_providers

    provider = get_setting("llm_provider") or "deepseek"

    if provider == "claude":
        model = get_setting("llm_model_claude") or "claude-sonnet-4-5-20250929"
        api_key = get_setting("anthropic_api_key") or config.ANTHROPIC_API_KEY
    else:
        model = get_setting("llm_model_deepseek") or "deepseek-chat"
        api_key = get_setting("deepseek_api_key") or os.getenv("DEEPSEEK_API_KEY", "")

    # Per-task routing config
    task_routing = {}
    for tt in TaskType:
        p = get_setting(f"task_route_{tt.value}_provider") or ""
        m = get_setting(f"task_route_{tt.value}_model") or ""
        task_routing[tt.value] = {"provider": p, "model": m}

    return {
        "provider": provider,
        "model": model,
        "configured": bool(api_key),
        "providers": get_available_providers(),
        "task_routing": task_routing,
    }


@router.get("/llm-usage")
async def llm_usage(
    days: int = 30,
    task_type: str = None,
    user: CurrentUser = Depends(require_admin),
):
    """Return aggregated LLM token usage statistics."""
    from db.usage_store import query_usage_stats
    return query_usage_stats(days=days, task_type=task_type)
