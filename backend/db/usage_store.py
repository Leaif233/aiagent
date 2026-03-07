"""LLM usage logging and statistics."""

import uuid
from datetime import datetime

from db.sqlite_db import get_connection


def log_llm_usage(
    task_type: str,
    provider: str,
    model: str,
    input_tokens: int = 0,
    output_tokens: int = 0,
    total_tokens: int = 0,
    latency_ms: int = 0,
    entity_id: str = "",
    session_id: str = "",
    success: bool = True,
):
    """Insert one usage record."""
    conn = get_connection()
    try:
        conn.execute(
            """INSERT INTO llm_usage_log
               (id, task_type, provider, model, input_tokens, output_tokens,
                total_tokens, latency_ms, entity_id, session_id, success, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                uuid.uuid4().hex,
                task_type,
                provider,
                model,
                input_tokens,
                output_tokens,
                total_tokens,
                latency_ms,
                entity_id,
                session_id,
                1 if success else 0,
                datetime.utcnow().isoformat(),
            ),
        )
        conn.commit()
    finally:
        conn.close()


def query_usage_stats(days: int = 30, task_type: str = None) -> dict:
    """Aggregate usage stats for the dashboard."""
    conn = get_connection()
    try:
        where = "WHERE created_at >= datetime('now', ?)"
        params = [f"-{days} days"]
        if task_type:
            where += " AND task_type = ?"
            params.append(task_type)

        row = conn.execute(
            f"""SELECT
                COUNT(*) as call_count,
                COALESCE(SUM(input_tokens), 0) as total_input,
                COALESCE(SUM(output_tokens), 0) as total_output,
                COALESCE(SUM(total_tokens), 0) as total_tokens,
                COALESCE(AVG(latency_ms), 0) as avg_latency_ms,
                SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as error_count
            FROM llm_usage_log {where}""",
            params,
        ).fetchone()

        provider_rows = conn.execute(
            f"""SELECT provider, model,
                COUNT(*) as calls,
                COALESCE(SUM(total_tokens), 0) as tokens,
                COALESCE(AVG(latency_ms), 0) as avg_latency
            FROM llm_usage_log {where}
            GROUP BY provider, model ORDER BY calls DESC""",
            params,
        ).fetchall()

        task_rows = conn.execute(
            f"""SELECT task_type,
                COUNT(*) as calls,
                COALESCE(SUM(total_tokens), 0) as tokens,
                COALESCE(AVG(latency_ms), 0) as avg_latency
            FROM llm_usage_log {where}
            GROUP BY task_type ORDER BY calls DESC""",
            params,
        ).fetchall()

        daily_rows = conn.execute(
            f"""SELECT DATE(created_at) as day,
                SUM(total_tokens) as tokens,
                COUNT(*) as calls
            FROM llm_usage_log {where}
            GROUP BY DATE(created_at) ORDER BY day""",
            params,
        ).fetchall()

        return {
            "summary": dict(row) if row else {},
            "by_provider": [dict(r) for r in provider_rows],
            "by_task": [dict(r) for r in task_rows],
            "daily_trend": [dict(r) for r in daily_rows],
        }
    finally:
        conn.close()
