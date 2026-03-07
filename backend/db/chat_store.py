import json
import uuid
from datetime import datetime

from db.sqlite_db import get_connection


def upsert_session(session_id: str, round_count: int, user_id: str = ""):
    """Create or update a chat session row."""
    conn = get_connection()
    try:
        now = datetime.utcnow().isoformat()
        existing = conn.execute(
            "SELECT id FROM chat_sessions WHERE id = ?", (session_id,)
        ).fetchone()
        if existing:
            conn.execute(
                "UPDATE chat_sessions SET round_count = ?, updated_at = ? WHERE id = ?",
                (round_count, now, session_id),
            )
        else:
            conn.execute(
                "INSERT INTO chat_sessions (id, user_id, created_at, updated_at, round_count) VALUES (?, ?, ?, ?, ?)",
                (session_id, user_id, now, now, round_count),
            )
        conn.commit()
    finally:
        conn.close()


def insert_message(session_id: str, role: str, content: str, stage: int = 0, sources: list = None) -> str:
    """Insert a chat message and return its ID."""
    conn = get_connection()
    try:
        msg_id = uuid.uuid4().hex
        now = datetime.utcnow().isoformat()
        sources_json = json.dumps(sources or [], ensure_ascii=False)
        conn.execute(
            "INSERT INTO chat_messages (id, session_id, role, content, stage, sources_json, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (msg_id, session_id, role, content, stage, sources_json, now),
        )
        conn.commit()
        return msg_id
    finally:
        conn.close()


def get_session_round_count(session_id: str) -> int:
    """Get the current round count for a session, or 0 if not found."""
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT round_count FROM chat_sessions WHERE id = ?", (session_id,)
        ).fetchone()
        return row["round_count"] if row else 0
    finally:
        conn.close()


def get_session_history(session_id: str) -> list[dict]:
    """Get chat history for a session as a list of {role, content} dicts."""
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC",
            (session_id,),
        ).fetchall()
        return [{"role": r["role"], "content": r["content"]} for r in rows]
    finally:
        conn.close()
