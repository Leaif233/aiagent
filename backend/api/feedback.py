import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends

from db.sqlite_db import get_connection
from models.schemas import FeedbackRequest, FeedbackTicketRequest

router = APIRouter(prefix="/api/feedback", tags=["feedback"])


@router.post("")
async def submit_feedback(body: FeedbackRequest):
    """Submit thumbs up/down on a chat message."""
    if body.rating not in (1, -1):
        raise HTTPException(status_code=400, detail="Rating must be 1 or -1")

    conn = get_connection()
    try:
        conn.execute(
            "UPDATE chat_messages SET feedback = ? WHERE id = ?",
            (body.rating, body.message_id),
        )
        conn.commit()
    finally:
        conn.close()
    return {"status": "ok"}


@router.post("/ticket")
async def create_feedback_ticket(body: FeedbackTicketRequest):
    """Create a correction ticket from a chat conversation."""
    conn = get_connection()
    try:
        ticket_id = uuid.uuid4().hex
        now = datetime.utcnow().isoformat()
        conn.execute(
            "INSERT INTO feedback_tickets (id, session_id, message_id, user_comment, created_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (ticket_id, body.session_id, body.message_id, body.comment, now),
        )
        conn.commit()
    finally:
        conn.close()
    return {"ticket_id": ticket_id, "status": "created"}


@router.get("/stats")
async def feedback_stats():
    """Feedback summary counts for admin dashboard."""
    conn = get_connection()
    try:
        up = conn.execute(
            "SELECT COUNT(*) as c FROM chat_messages WHERE feedback = 1"
        ).fetchone()["c"]
        down = conn.execute(
            "SELECT COUNT(*) as c FROM chat_messages WHERE feedback = -1"
        ).fetchone()["c"]
        ft_open = conn.execute(
            "SELECT COUNT(*) as c FROM feedback_tickets WHERE status = '待处理'"
        ).fetchone()["c"]
        ft_resolved = conn.execute(
            "SELECT COUNT(*) as c FROM feedback_tickets WHERE status = '已处理'"
        ).fetchone()["c"]
    finally:
        conn.close()
    return {
        "total_thumbs_up": up,
        "total_thumbs_down": down,
        "feedback_tickets_open": ft_open,
        "feedback_tickets_resolved": ft_resolved,
    }


@router.get("/tickets")
async def list_feedback_tickets(status: str = None):
    """List feedback tickets with optional status filter."""
    conn = get_connection()
    try:
        if status:
            rows = conn.execute(
                "SELECT * FROM feedback_tickets WHERE status = ? ORDER BY created_at DESC",
                (status,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM feedback_tickets ORDER BY created_at DESC"
            ).fetchall()
    finally:
        conn.close()
    return {"items": [dict(r) for r in rows]}


@router.patch("/tickets/{ticket_id}")
async def resolve_feedback_ticket(ticket_id: str):
    """Mark a feedback ticket as resolved."""
    conn = get_connection()
    try:
        conn.execute(
            "UPDATE feedback_tickets SET status = '已处理' WHERE id = ?",
            (ticket_id,),
        )
        conn.commit()
    finally:
        conn.close()
    return {"status": "resolved"}
