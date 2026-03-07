from datetime import datetime

from db.sqlite_db import get_connection
import config

# Default settings with fallbacks from config.py
DEFAULTS = {
    "llm_provider": "deepseek",
    "llm_model_claude": "claude-sonnet-4-5-20250929",
    "llm_model_deepseek": "deepseek-chat",
    "llm_max_tokens": "2048",
    "anthropic_api_key": config.ANTHROPIC_API_KEY or "",
    "deepseek_api_key": "",
    "deepseek_base_url": "https://api.deepseek.com/v1",
    "embedding_provider": "dashscope",
    "embedding_model_local": config.EMBEDDING_MODEL,
    "embedding_model_dashscope": "text-embedding-v3",
    "dashscope_api_key": "",
    "confidence_threshold": str(config.CONFIDENCE_THRESHOLD),
    "near_miss_threshold": str(config.NEAR_MISS_THRESHOLD),
    "max_conversation_rounds": str(config.MAX_CONVERSATION_ROUNDS),
    "max_refinement_rounds": str(config.MAX_REFINEMENT_ROUNDS),
    "top_k_results": str(config.TOP_K_RESULTS),
    "chunk_size": "2000",
    "cleaning_prompt": "",
    "image_processing": "true",
    "upload_dir": config.UPLOAD_DIR,
    "image_dir": config.IMAGE_DIR,
    "cost_per_manual_query": "50",
    # Per-task model routing (empty = use global llm_provider)
    "task_route_text_cleaning_provider": "",
    "task_route_text_cleaning_model": "",
    "task_route_doc_cleaning_provider": "",
    "task_route_doc_cleaning_model": "",
    "task_route_multimodal_cleaning_provider": "dashscope",
    "task_route_multimodal_cleaning_model": "qwen3-vl-plus",
    "task_route_fingerprint_extraction_provider": "",
    "task_route_fingerprint_extraction_model": "",
    "task_route_guidance_grouping_provider": "",
    "task_route_guidance_grouping_model": "",
    "task_route_chat_dialogue_provider": "",
    "task_route_chat_dialogue_model": "",
}


def _load_env_defaults():
    """Load API keys from .env into defaults if not already set."""
    import os
    if not DEFAULTS["deepseek_api_key"]:
        DEFAULTS["deepseek_api_key"] = os.getenv("OPENAI_API_KEY", "")
    if not DEFAULTS["dashscope_api_key"]:
        DEFAULTS["dashscope_api_key"] = os.getenv("DASHSCOPE_API_KEY", "")


_load_env_defaults()


def get_setting(key: str, default: str = None) -> str:
    """Read a single setting, falling back to DEFAULTS then default param."""
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT value FROM settings WHERE key = ?", (key,)
        ).fetchone()
        if row:
            return row["value"]
        return DEFAULTS.get(key, default or "")
    finally:
        conn.close()


def get_setting_float(key: str, default: float) -> float:
    val = get_setting(key)
    try:
        return float(val) if val else default
    except (ValueError, TypeError):
        return default


def get_setting_int(key: str, default: int) -> int:
    val = get_setting(key)
    try:
        return int(float(val)) if val else default
    except (ValueError, TypeError):
        return default


def set_setting(key: str, value: str):
    """Upsert a single setting."""
    conn = get_connection()
    try:
        now = datetime.utcnow().isoformat()
        conn.execute(
            "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?",
            (key, str(value), now, str(value), now),
        )
        conn.commit()
    finally:
        conn.close()


def get_all_settings() -> dict:
    """Return all settings merged with defaults."""
    result = dict(DEFAULTS)
    conn = get_connection()
    try:
        rows = conn.execute("SELECT key, value FROM settings").fetchall()
        for row in rows:
            result[row["key"]] = row["value"]
    finally:
        conn.close()
    return result


def set_many_settings(data: dict):
    """Bulk upsert multiple settings."""
    conn = get_connection()
    try:
        now = datetime.utcnow().isoformat()
        for key, value in data.items():
            conn.execute(
                "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) "
                "ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?",
                (key, str(value), now, str(value), now),
            )
        conn.commit()
    finally:
        conn.close()
