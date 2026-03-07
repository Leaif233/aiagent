import json

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from db.sqlite_db import get_connection
from core.auth import get_current_user, CurrentUser


class BatchDeleteRequest(BaseModel):
    session_ids: list[str]

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.get("")
async def list_sessions(page: int = 1, page_size: int = 20, user: CurrentUser = Depends(get_current_user)):
    """List chat sessions with pagination, ordered by most recent. Users see only their own."""
    conn = get_connection()
    try:
        if user.role == "admin":
            total = conn.execute(
                "SELECT COUNT(*) as c FROM chat_sessions"
            ).fetchone()["c"]
        else:
            total = conn.execute(
                "SELECT COUNT(*) as c FROM chat_sessions WHERE user_id = ?",
                (user.user_id,),
            ).fetchone()["c"]

        offset = (page - 1) * page_size
        base_query = (
            "SELECT s.id, s.user_id, s.created_at, s.updated_at, s.round_count, "
            "(SELECT SUBSTR(m.content, 1, 50) FROM chat_messages m "
            " WHERE m.session_id = s.id AND m.role = 'user' "
            " ORDER BY m.created_at DESC LIMIT 1) as last_message "
            "FROM chat_sessions s "
        )
        if user.role == "admin":
            rows = conn.execute(
                base_query + "ORDER BY s.updated_at DESC LIMIT ? OFFSET ?",
                (page_size, offset),
            ).fetchall()
        else:
            rows = conn.execute(
                base_query + "WHERE s.user_id = ? ORDER BY s.updated_at DESC LIMIT ? OFFSET ?",
                (user.user_id, page_size, offset),
            ).fetchall()

        return {
            "items": [dict(r) for r in rows],
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    finally:
        conn.close()


@router.get("/{session_id}/messages")
async def get_session_messages(session_id: str, user: CurrentUser = Depends(get_current_user)):
    """Get all messages for a session."""
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT id, user_id FROM chat_sessions WHERE id = ?", (session_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Session not found")
        if user.role != "admin" and row["user_id"] != user.user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        rows = conn.execute(
            "SELECT id, role, content, stage, sources_json, feedback, created_at "
            "FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC",
            (session_id,),
        ).fetchall()

        items = []
        for r in rows:
            item = dict(r)
            item["sources"] = json.loads(item.pop("sources_json", "[]"))
            items.append(item)

        return {"items": items}
    finally:
        conn.close()


@router.delete("/{session_id}")
async def delete_session(session_id: str, user: CurrentUser = Depends(get_current_user)):
    """Delete a session and all its messages."""
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT id, user_id FROM chat_sessions WHERE id = ?", (session_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Session not found")
        if user.role != "admin" and row["user_id"] != user.user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        conn.execute(
            "DELETE FROM chat_messages WHERE session_id = ?", (session_id,)
        )
        conn.execute(
            "DELETE FROM chat_sessions WHERE id = ?", (session_id,)
        )
        conn.commit()
        return {"status": "deleted", "session_id": session_id}
    finally:
        conn.close()


@router.post("/batch-delete")
async def batch_delete_sessions(body: BatchDeleteRequest, user: CurrentUser = Depends(get_current_user)):
    """Delete multiple sessions and their messages."""
    if not body.session_ids:
        raise HTTPException(400, "No session IDs provided")

    conn = get_connection()
    try:
        deleted = 0
        for sid in body.session_ids:
            row = conn.execute(
                "SELECT id, user_id FROM chat_sessions WHERE id = ?", (sid,)
            ).fetchone()
            if not row:
                continue
            if user.role != "admin" and row["user_id"] != user.user_id:
                continue
            conn.execute("DELETE FROM chat_messages WHERE session_id = ?", (sid,))
            conn.execute("DELETE FROM chat_sessions WHERE id = ?", (sid,))
            deleted += 1
        conn.commit()
        return {"status": "deleted", "deleted_count": deleted}
    finally:
        conn.close()
