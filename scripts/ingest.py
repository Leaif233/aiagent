"""
Ingestion script: Load sample docs and tickets into the system.

Usage:
    cd backend
    python ../scripts/ingest.py
"""
import sys
import os
import json
import uuid
from datetime import datetime

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

import config
from db.sqlite_db import init_db, get_connection
from db.chroma_client import get_docs_collection, get_tickets_collection
from core.embeddings import embed_texts
from core.indexer import index_entity


def ingest_docs():
    """Load markdown docs from data/docs/ into SQLite + ChromaDB."""
    docs_dir = os.path.join(os.path.dirname(__file__), "..", "data", "docs")
    if not os.path.isdir(docs_dir):
        print("No data/docs/ directory found, skipping.")
        return

    conn = get_connection()
    collection = get_docs_collection()
    count = 0

    for filename in os.listdir(docs_dir):
        if not filename.endswith(".md"):
            continue

        filepath = os.path.join(docs_dir, filename)
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        doc_id = uuid.uuid4().hex
        title = os.path.splitext(filename)[0].replace("_", " ").title()
        now = datetime.utcnow().isoformat()

        # Insert into SQLite as already approved
        conn.execute(
            """INSERT INTO documents
               (id, title, category, status, raw_content,
                cleaned_content, source_file, created_at, updated_at)
               VALUES (?, ?, 'Technical', '已审核', ?, ?, ?, ?, ?)""",
            (doc_id, title, content, content, filename, now, now),
        )

        # Chunk and embed
        chunks = chunk_text(content)
        ids = [f"{doc_id}_chunk_{i}" for i in range(len(chunks))]
        embeddings = embed_texts(chunks)
        metadatas = [
            {
                "doc_id": doc_id,
                "title": title,
                "category": "Technical",
                "status": "已审核",
                "chunk_index": i,
            }
            for i in range(len(chunks))
        ]

        collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=chunks,
            metadatas=metadatas,
        )
        count += 1
        print(f"  Ingested doc: {title} ({len(chunks)} chunks)")

        # Build question fingerprint index
        try:
            index_entity("doc", doc_id)
            print(f"    Indexed fingerprints for: {title}")
        except Exception as e:
            print(f"    Failed to index fingerprints: {e}")

    conn.commit()
    conn.close()
    print(f"Docs ingested: {count}")


def ingest_tickets():
    """Load sample tickets from data/tickets/ into SQLite + ChromaDB."""
    tickets_dir = os.path.join(os.path.dirname(__file__), "..", "data", "tickets")
    if not os.path.isdir(tickets_dir):
        print("No data/tickets/ directory found, skipping.")
        return

    json_path = os.path.join(tickets_dir, "sample_tickets.json")
    if not os.path.exists(json_path):
        print("No sample_tickets.json found, skipping.")
        return

    with open(json_path, "r", encoding="utf-8") as f:
        raw_tickets = json.load(f)

    conn = get_connection()
    collection = get_tickets_collection()
    count = 0

    for item in raw_tickets:
        ticket_id = uuid.uuid4().hex
        now = datetime.utcnow().isoformat()
        ticket_number = item.get("ticket_number", f"TKT-{ticket_id[:6].upper()}")
        phenomenon = item.get("phenomenon", "")
        cause = item.get("cause", "")
        solution = item.get("solution", "")
        raw_content = item.get("raw_content", "")
        # Build raw_content from structured fields if not provided
        if not raw_content and (phenomenon or cause or solution):
            raw_content = f"现象: {phenomenon}\n原因: {cause}\n对策: {solution}"

        conn.execute(
            """INSERT INTO tickets
               (id, ticket_number, status, raw_content,
                phenomenon, cause, solution, created_at, updated_at)
               VALUES (?, ?, '已审核', ?, ?, ?, ?, ?, ?)""",
            (
                ticket_id, ticket_number, raw_content,
                phenomenon, cause, solution,
                now, now,
            ),
        )

        # Embed combined text for semantic search
        combined = f"工单 {ticket_number}: 现象: {phenomenon} 原因: {cause} 对策: {solution}" if phenomenon else f"工单 {ticket_number}: {raw_content}"
        embeddings = embed_texts([combined])
        metadata = {
            "ticket_id": ticket_id,
            "ticket_number": ticket_number,
            "status": "已审核",
        }

        collection.upsert(
            ids=[ticket_id],
            embeddings=embeddings,
            documents=[combined],
            metadatas=[metadata],
        )
        count += 1
        print(f"  Ingested ticket: {ticket_number}")

        # Build question fingerprint index
        try:
            index_entity("ticket", ticket_id)
            print(f"    Indexed fingerprints for: {ticket_number}")
        except Exception as e:
            print(f"    Failed to index fingerprints: {e}")

    conn.commit()
    conn.close()
    print(f"Tickets ingested: {count}")


def chunk_text(text: str, max_chars: int = 2000) -> list[str]:
    """Split text into chunks by paragraphs."""
    paragraphs = text.split("\n\n")
    chunks = []
    current = ""

    for para in paragraphs:
        if len(current) + len(para) + 2 > max_chars and current:
            chunks.append(current.strip())
            current = para
        else:
            current = current + "\n\n" + para if current else para

    if current.strip():
        chunks.append(current.strip())

    return chunks if chunks else [text[:max_chars]]


if __name__ == "__main__":
    print("Initializing database...")
    init_db()

    print("\nIngesting documents...")
    ingest_docs()

    print("\nIngesting tickets...")
    ingest_tickets()

    print("\nDone!")
