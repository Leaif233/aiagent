from db.sqlite_db import get_connection
from db.fingerprint_store import (
    insert_fingerprint,
    delete_fingerprints_by_entity,
    upsert_to_chroma,
)
from core.fingerprint_extractor import (
    extract_doc_fingerprints,
    extract_ticket_fingerprints,
)


def index_entity(entity_type: str, entity_id: str):
    """Extract question fingerprints and index into ChromaDB.

    Called when an entity's status changes to '已审核'.
    """
    # Delete old fingerprints first
    delete_fingerprints_by_entity(entity_type, entity_id)

    if entity_type == "doc":
        _index_doc(entity_id)
    elif entity_type == "ticket":
        _index_ticket(entity_id)


def _index_doc(doc_id: str):
    """Index a document by extracting question fingerprints."""
    conn = get_connection()
    row = conn.execute(
        "SELECT title, cleaned_content FROM documents WHERE id = ?",
        (doc_id,),
    ).fetchone()
    conn.close()
    if not row:
        return

    title = row["title"] or ""
    content = row["cleaned_content"] or ""
    if not content:
        return

    fingerprints = extract_doc_fingerprints(doc_id, content, title)
    _store_fingerprints("doc", doc_id, title, fingerprints)


def _index_ticket(ticket_id: str):
    """Index a ticket by extracting question fingerprints."""
    conn = get_connection()
    row = conn.execute(
        "SELECT ticket_number, phenomenon, cause FROM tickets WHERE id = ?",
        (ticket_id,),
    ).fetchone()
    conn.close()
    if not row:
        return

    phenomenon = row["phenomenon"] or ""
    cause = row["cause"] or ""
    if not phenomenon:
        return

    title = row["ticket_number"] or ticket_id
    fingerprints = extract_ticket_fingerprints(ticket_id, phenomenon, cause)
    _store_fingerprints("ticket", ticket_id, title, fingerprints)


def _store_fingerprints(
    entity_type: str,
    entity_id: str,
    title: str,
    fingerprints: list[dict],
):
    """Store fingerprints in SQLite and ChromaDB."""
    for fp in fingerprints:
        qt = fp.get("question_text", "").strip()
        if not qt:
            continue
        st = fp.get("section_title", "")
        fp_id = insert_fingerprint(entity_type, entity_id, qt, st)
        metadata = {
            "entity_type": entity_type,
            "entity_id": entity_id,
            "fingerprint_id": fp_id,
            "question_text": qt,
            "section_title": st,
            "title": title,
        }
        upsert_to_chroma(fp_id, qt, metadata)
