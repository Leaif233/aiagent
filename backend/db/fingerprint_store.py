import uuid
from datetime import datetime

from db.sqlite_db import get_connection
from db.chroma_client import get_question_index_collection
from core.embeddings import embed_texts


def insert_fingerprint(
    entity_type: str,
    entity_id: str,
    question_text: str,
    section_title: str = "",
) -> str:
    """Insert a question fingerprint into SQLite and return its id."""
    fp_id = uuid.uuid4().hex
    now = datetime.utcnow().isoformat()
    conn = get_connection()
    conn.execute(
        "INSERT INTO question_fingerprints "
        "(id, entity_type, entity_id, question_text, section_title, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (fp_id, entity_type, entity_id, question_text, section_title, now),
    )
    conn.commit()
    conn.close()
    return fp_id


def get_fingerprints_by_entity(entity_type: str, entity_id: str) -> list[dict]:
    """Get all fingerprints for a given entity."""
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM question_fingerprints "
        "WHERE entity_type = ? AND entity_id = ? "
        "ORDER BY created_at",
        (entity_type, entity_id),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_fingerprints_by_entity(entity_type: str, entity_id: str):
    """Delete all fingerprints for a given entity from SQLite and ChromaDB."""
    conn = get_connection()
    rows = conn.execute(
        "SELECT id FROM question_fingerprints "
        "WHERE entity_type = ? AND entity_id = ?",
        (entity_type, entity_id),
    ).fetchall()
    fp_ids = [r["id"] for r in rows]

    if fp_ids:
        conn.execute(
            "DELETE FROM question_fingerprints "
            "WHERE entity_type = ? AND entity_id = ?",
            (entity_type, entity_id),
        )
        conn.commit()
        # Remove from ChromaDB
        col = get_question_index_collection()
        try:
            col.delete(ids=fp_ids)
        except Exception:
            pass
    conn.close()


def upsert_to_chroma(
    fingerprint_id: str,
    question_text: str,
    metadata: dict,
):
    """Embed a question fingerprint and upsert into ChromaDB."""
    embedding = embed_texts([question_text])[0]
    col = get_question_index_collection()
    col.upsert(
        ids=[fingerprint_id],
        embeddings=[embedding],
        documents=[question_text],
        metadatas=[metadata],
    )
