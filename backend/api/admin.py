from fastapi import APIRouter, Depends

from db.sqlite_db import get_connection
from db.settings_store import get_setting_float
from core.auth import require_admin, CurrentUser

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/stats")
async def get_stats(user: CurrentUser = Depends(require_admin)):
    """Dashboard stats: pending counts, verified, distribution, sessions, feedback, cost."""
    conn = get_connection()
    try:
        # Existing basic counts
        pending_docs = conn.execute(
            "SELECT COUNT(*) as c FROM documents WHERE status = '待审核'"
        ).fetchone()["c"]
        pending_tickets = conn.execute(
            "SELECT COUNT(*) as c FROM tickets WHERE status = '待审核'"
        ).fetchone()["c"]
        verified_docs = conn.execute(
            "SELECT COUNT(*) as c FROM documents WHERE status = '已审核'"
        ).fetchone()["c"]
        verified_tickets = conn.execute(
            "SELECT COUNT(*) as c FROM tickets WHERE status = '已审核'"
        ).fetchone()["c"]

        # Knowledge distribution by status
        docs_by_status = {}
        for row in conn.execute(
            "SELECT status, COUNT(*) as c FROM documents GROUP BY status"
        ).fetchall():
            docs_by_status[row["status"]] = row["c"]

        tickets_by_status = {}
        for row in conn.execute(
            "SELECT status, COUNT(*) as c FROM tickets GROUP BY status"
        ).fetchall():
            tickets_by_status[row["status"]] = row["c"]

        # Conversation stats
        total_sessions = conn.execute(
            "SELECT COUNT(*) as c FROM chat_sessions"
        ).fetchone()["c"]
        avg_row = conn.execute(
            "SELECT AVG(round_count) as a FROM chat_sessions"
        ).fetchone()
        avg_rounds = round(avg_row["a"] or 0, 1)

        stage_dist = {"1": 0, "3": 0, "4": 0, "5": 0}
        for row in conn.execute(
            "SELECT stage, COUNT(*) as c FROM chat_messages WHERE role = 'assistant' AND stage > 0 GROUP BY stage"
        ).fetchall():
            stage_dist[str(row["stage"])] = row["c"]

        # Feedback
        thumbs_up = conn.execute(
            "SELECT COUNT(*) as c FROM chat_messages WHERE feedback = 1"
        ).fetchone()["c"]
        thumbs_down = conn.execute(
            "SELECT COUNT(*) as c FROM chat_messages WHERE feedback = -1"
        ).fetchone()["c"]

        # Cost savings
        queries_resolved = thumbs_up + stage_dist.get("1", 0)
        cost_per = get_setting_float("cost_per_manual_query", 50.0)
        estimated_savings = round(queries_resolved * cost_per, 2)

        return {
            "pending_docs": pending_docs,
            "pending_tickets": pending_tickets,
            "verified_total": verified_docs + verified_tickets,
            "docs_by_status": docs_by_status,
            "tickets_by_status": tickets_by_status,
            "total_sessions": total_sessions,
            "avg_rounds": avg_rounds,
            "stage_distribution": stage_dist,
            "total_thumbs_up": thumbs_up,
            "total_thumbs_down": thumbs_down,
            "queries_resolved": queries_resolved,
            "estimated_savings": estimated_savings,
        }
    finally:
        conn.close()


@router.get("/pending")
async def get_pending_items(user: CurrentUser = Depends(require_admin)):
    """Combined list of all pending review items (docs + tickets)."""
    conn = get_connection()
    try:
        docs = conn.execute(
            "SELECT id, title as name, 'document' as type, status, created_at, updated_at "
            "FROM documents WHERE status = '待审核' ORDER BY updated_at DESC"
        ).fetchall()

        tickets = conn.execute(
            "SELECT id, ticket_number as name, 'ticket' as type, status, created_at, updated_at "
            "FROM tickets WHERE status = '待审核' ORDER BY updated_at DESC"
        ).fetchall()

        items = [dict(r) for r in docs] + [dict(r) for r in tickets]
        items.sort(key=lambda x: x["updated_at"], reverse=True)
        return {"items": items}
    finally:
        conn.close()


@router.get("/trends")
async def get_trends(days: int = 30, user: CurrentUser = Depends(require_admin)):
    """Time-series data: new docs, tickets, sessions per day."""
    conn = get_connection()
    try:
        from datetime import datetime, timedelta
        end = datetime.utcnow()
        start = end - timedelta(days=days)
        start_str = start.strftime("%Y-%m-%d")

        # Build date labels
        labels = []
        for i in range(days):
            d = start + timedelta(days=i + 1)
            labels.append(d.strftime("%Y-%m-%d"))

        # Query counts per day
        doc_rows = conn.execute(
            "SELECT SUBSTR(created_at, 1, 10) as day, COUNT(*) as c "
            "FROM documents WHERE created_at >= ? GROUP BY day",
            (start_str,),
        ).fetchall()
        doc_map = {r["day"]: r["c"] for r in doc_rows}

        ticket_rows = conn.execute(
            "SELECT SUBSTR(created_at, 1, 10) as day, COUNT(*) as c "
            "FROM tickets WHERE created_at >= ? GROUP BY day",
            (start_str,),
        ).fetchall()
        ticket_map = {r["day"]: r["c"] for r in ticket_rows}

        session_rows = conn.execute(
            "SELECT SUBSTR(created_at, 1, 10) as day, COUNT(*) as c "
            "FROM chat_sessions WHERE created_at >= ? GROUP BY day",
            (start_str,),
        ).fetchall()
        session_map = {r["day"]: r["c"] for r in session_rows}

        return {
            "labels": labels,
            "new_docs": [doc_map.get(d, 0) for d in labels],
            "new_tickets": [ticket_map.get(d, 0) for d in labels],
            "new_sessions": [session_map.get(d, 0) for d in labels],
        }
    finally:
        conn.close()


@router.get("/hot-topics")
async def get_hot_topics(limit: int = 10, user: CurrentUser = Depends(require_admin)):
    """Frequently asked questions from chat messages."""
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT SUBSTR(content, 1, 80) as topic, COUNT(*) as count, "
            "MAX(created_at) as last_asked "
            "FROM chat_messages WHERE role = 'user' "
            "GROUP BY SUBSTR(content, 1, 80) "
            "ORDER BY count DESC LIMIT ?",
            (limit,),
        ).fetchall()
    finally:
        conn.close()
    return {"items": [dict(r) for r in rows]}


@router.get("/no-result-queries")
async def get_no_result_queries(limit: int = 20, user: CurrentUser = Depends(require_admin)):
    """Top no-result search terms ranked by frequency."""
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT query_text as query, COUNT(*) as count, "
            "MAX(created_at) as last_asked "
            "FROM no_result_queries "
            "GROUP BY query_text "
            "ORDER BY count DESC LIMIT ?",
            (limit,),
        ).fetchall()
    finally:
        conn.close()
    return {"items": [dict(r) for r in rows]}
