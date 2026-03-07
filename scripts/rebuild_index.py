"""
Rebuild question fingerprint index for all verified entities.

Usage:
    cd backend
    python ../scripts/rebuild_index.py
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from db.sqlite_db import init_db, get_connection
from db.chroma_client import get_question_index_collection
from core.indexer import index_entity


def rebuild():
    """Clear and rebuild question_index for all verified docs and tickets."""
    init_db()

    # Clear existing question_index collection
    collection = get_question_index_collection()
    if collection.count() > 0:
        all_ids = collection.get()["ids"]
        if all_ids:
            collection.delete(ids=all_ids)
        print(f"Cleared {len(all_ids)} entries from question_index.")

    # Clear fingerprints table
    conn = get_connection()
    conn.execute("DELETE FROM question_fingerprints")
    conn.commit()
    print("Cleared question_fingerprints table.")

    # Rebuild docs
    rows = conn.execute(
        "SELECT id, title FROM documents WHERE status = '已审核'"
    ).fetchall()
    print(f"\nRebuilding index for {len(rows)} verified documents...")
    for i, row in enumerate(rows):
        try:
            index_entity("doc", row["id"])
            print(f"  [{i+1}/{len(rows)}] doc: {row['title']}")
        except Exception as e:
            print(f"  [{i+1}/{len(rows)}] FAILED doc {row['title']}: {e}")

    # Rebuild tickets
    rows = conn.execute(
        "SELECT id, ticket_number FROM tickets WHERE status = '已审核'"
    ).fetchall()
    print(f"\nRebuilding index for {len(rows)} verified tickets...")
    for i, row in enumerate(rows):
        try:
            index_entity("ticket", row["id"])
            print(f"  [{i+1}/{len(rows)}] ticket: {row['ticket_number']}")
        except Exception as e:
            print(f"  [{i+1}/{len(rows)}] FAILED ticket {row['ticket_number']}: {e}")

    conn.close()

    final_count = get_question_index_collection().count()
    print(f"\nDone! question_index now has {final_count} entries.")


if __name__ == "__main__":
    rebuild()
