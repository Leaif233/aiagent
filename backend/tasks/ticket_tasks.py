from datetime import datetime

from tasks.celery_app import celery_app
from core.cleaner import clean_ticket_text
from db.sqlite_db import get_connection


@celery_app.task(bind=True)
def clean_ticket_task(self, ticket_id: str):
    """Async task: use LLM to extract structured fields from raw ticket."""
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT raw_content FROM tickets WHERE id = ?",
            (ticket_id,),
        ).fetchone()

        if not row:
            return {"status": "error", "error": "Ticket not found"}

        # Set intermediate status
        now = datetime.utcnow().isoformat()
        conn.execute(
            "UPDATE tickets SET status = 'AI清洗中', updated_at = ? WHERE id = ?",
            (now, ticket_id),
        )
        conn.commit()

        result = clean_ticket_text(row["raw_content"])

        now = datetime.utcnow().isoformat()
        conn.execute(
            """UPDATE tickets
               SET phenomenon = ?,
                   cause = ?,
                   solution = ?,
                   status = '待审核',
                   updated_at = ?
               WHERE id = ?""",
            (
                result.get("phenomenon", ""),
                result.get("cause", ""),
                result.get("solution", ""),
                now,
                ticket_id,
            ),
        )
        conn.commit()
        return {"status": "success", "ticket_id": ticket_id}
    except Exception as e:
        # Mark as failed instead of silently staying in 待处理
        try:
            now = datetime.utcnow().isoformat()
            conn.execute(
                "UPDATE tickets SET status = '处理失败', updated_at = ? WHERE id = ?",
                (now, ticket_id),
            )
            conn.commit()
        except Exception:
            pass
        return {"status": "error", "ticket_id": ticket_id, "error": str(e)}
    finally:
        conn.close()


@celery_app.task(bind=True)
def approve_ticket_task(self, ticket_id: str):
    """Async task: embed + build fingerprint index after ticket approval."""
    from core.embeddings import embed_texts
    from core.indexer import index_entity
    from db.chroma_client import get_tickets_collection

    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM tickets WHERE id = ?", (ticket_id,)
        ).fetchone()
        if not row:
            return {"status": "error", "ticket_id": ticket_id, "error": "not found"}

        phenomenon = row["phenomenon"] or ""
        cause = row["cause"] or ""
        solution = row["solution"] or ""
        combined = f"现象: {phenomenon}\n原因: {cause}\n对策: {solution}"

        if not combined.strip():
            return {"status": "error", "ticket_id": ticket_id, "error": "no content"}

        # Embed and upsert
        now = datetime.utcnow().isoformat()
        conn.execute(
            "UPDATE tickets SET status = '向量入库中', updated_at = ? WHERE id = ?",
            (now, ticket_id),
        )
        conn.commit()

        collection = get_tickets_collection()
        embeddings = embed_texts([combined])
        metadata = {
            "ticket_id": ticket_id,
            "ticket_number": row["ticket_number"],
            "status": "已审核",
        }
        collection.upsert(
            ids=[ticket_id], embeddings=embeddings,
            documents=[combined], metadatas=[metadata],
        )

        # Build fingerprint index
        now = datetime.utcnow().isoformat()
        conn.execute(
            "UPDATE tickets SET status = '索引构建中', updated_at = ? WHERE id = ?",
            (now, ticket_id),
        )
        conn.commit()

        try:
            index_entity("ticket", ticket_id)
        except Exception:
            pass

        # Final status
        now = datetime.utcnow().isoformat()
        conn.execute(
            "UPDATE tickets SET status = '已审核', updated_at = ? WHERE id = ?",
            (now, ticket_id),
        )
        conn.commit()
        return {"status": "success", "ticket_id": ticket_id}
    except Exception as e:
        try:
            now = datetime.utcnow().isoformat()
            conn.execute(
                "UPDATE tickets SET status = '索引失败', updated_at = ? WHERE id = ?",
                (now, ticket_id),
            )
            conn.commit()
        except Exception:
            pass
        return {"status": "error", "ticket_id": ticket_id, "error": str(e)}
    finally:
        conn.close()
