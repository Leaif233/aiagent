import json
import os
import uuid
from datetime import datetime

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends

import config
from core.auth import get_current_user, require_admin, CurrentUser
from db.sqlite_db import get_connection
from db.chroma_client import get_docs_collection
from db.versioning import create_version_snapshot, log_audit
from db.fingerprint_store import delete_fingerprints_by_entity
from tasks.doc_tasks import parse_document_task, approve_document_task
from models.schemas import BatchRequest, DocUpdateRequest

router = APIRouter(prefix="/api/docs", tags=["documents"])


@router.post("/upload")
async def upload_documents(files: list[UploadFile] = File(...), user: CurrentUser = Depends(require_admin)):
    """Batch upload PDF/PPT/Docx files and trigger async parsing."""
    results = []
    conn = get_connection()
    try:
        for file in files:
            doc_id = uuid.uuid4().hex
            now = datetime.utcnow().isoformat()

            # Save uploaded file
            safe_name = file.filename or f"{doc_id}.bin"
            save_path = os.path.join(config.UPLOAD_DIR, f"{doc_id}_{safe_name}")
            content = await file.read()
            with open(save_path, "wb") as f:
                f.write(content)

            # Insert metadata row
            title = os.path.splitext(safe_name)[0]
            conn.execute(
                """INSERT INTO documents
                   (id, title, category, status, source_file, created_at, updated_at)
                   VALUES (?, ?, '', '待处理', ?, ?, ?)""",
                (doc_id, title, safe_name, now, now),
            )

            # Trigger async parsing
            task = parse_document_task.delay(doc_id, save_path)
            results.append({
                "doc_id": doc_id,
                "filename": safe_name,
                "task_id": task.id,
            })

        conn.commit()
    finally:
        conn.close()

    return {"uploaded": len(results), "items": results}


@router.get("")
async def list_documents(status: str = None, search: str = None, page: int = 1, page_size: int = 20, user: CurrentUser = Depends(get_current_user)):
    """List documents with optional status filter, search, and pagination."""
    conn = get_connection()
    try:
        where_clauses = []
        params = []

        if status:
            where_clauses.append("status = ?")
            params.append(status)
        if search:
            where_clauses.append("(title LIKE ? OR cleaned_content LIKE ?)")
            params.extend([f"%{search}%", f"%{search}%"])

        where_sql = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

        total = conn.execute(
            f"SELECT COUNT(*) as c FROM documents{where_sql}", params
        ).fetchone()["c"]

        offset = (page - 1) * page_size
        rows = conn.execute(
            f"SELECT id, title, category, status, source_file, created_at, updated_at "
            f"FROM documents{where_sql} ORDER BY updated_at DESC LIMIT ? OFFSET ?",
            params + [page_size, offset],
        ).fetchall()

        return {"items": [dict(r) for r in rows], "total": total, "page": page, "page_size": page_size}
    finally:
        conn.close()


@router.post("/batch")
async def batch_documents(body: BatchRequest, user: CurrentUser = Depends(require_admin)):
    """Batch approve/reject/delete documents."""
    if body.action not in ("approve", "reject", "delete") or not body.ids:
        raise HTTPException(status_code=400, detail="Invalid action or empty ids")

    success = 0
    failed = 0
    for doc_id in body.ids:
        try:
            if body.action == "approve":
                await approve_document(doc_id, user)
            elif body.action == "reject":
                await reject_document(doc_id, user)
            elif body.action == "delete":
                await delete_document(doc_id, user)
            success += 1
        except Exception:
            failed += 1

    return {"success": success, "failed": failed}


@router.get("/{doc_id}")
async def get_document(doc_id: str, user: CurrentUser = Depends(get_current_user)):
    """Get single document detail including raw and cleaned content."""
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM documents WHERE id = ?", (doc_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Document not found")
        return dict(row)
    finally:
        conn.close()


@router.patch("/{doc_id}")
async def update_document(doc_id: str, body: DocUpdateRequest, user: CurrentUser = Depends(require_admin)):
    """Update cleaned content or metadata (editor saves)."""
    create_version_snapshot("document", doc_id, user.username, "update")
    log_audit("document", doc_id, "update", user.username)
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT id FROM documents WHERE id = ?", (doc_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Document not found")

        now = datetime.utcnow().isoformat()
        updates = body.model_dump(exclude_none=True)
        if not updates:
            raise HTTPException(status_code=400, detail="No valid fields to update")

        sets = [f"{k} = ?" for k in updates]
        vals = list(updates.values())
        sets.append("updated_at = ?")
        vals.append(now)
        vals.append(doc_id)

        conn.execute(
            f"UPDATE documents SET {', '.join(sets)} WHERE id = ?", vals
        )
        conn.commit()
        return {"status": "updated", "doc_id": doc_id}
    finally:
        conn.close()


@router.patch("/{doc_id}/approve")
async def approve_document(doc_id: str, user: CurrentUser = Depends(require_admin)):
    """Approve document: dispatch async task for embedding + indexing."""
    create_version_snapshot("document", doc_id, user.username, "approve")
    log_audit("document", doc_id, "approve", user.username)
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT id, cleaned_content FROM documents WHERE id = ?",
            (doc_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Document not found")

        cleaned = row["cleaned_content"] or ""
        if not cleaned.strip():
            raise HTTPException(status_code=400, detail="No cleaned content to embed")

        # Set intermediate status and dispatch async task
        now = datetime.utcnow().isoformat()
        conn.execute(
            "UPDATE documents SET status = '审核通过处理中', updated_at = ? WHERE id = ?",
            (now, doc_id),
        )
        conn.commit()

        task = approve_document_task.delay(doc_id)
        return {"status": "approved", "doc_id": doc_id, "task_id": task.id}
    finally:
        conn.close()


@router.patch("/{doc_id}/reject")
async def reject_document(doc_id: str, user: CurrentUser = Depends(require_admin)):
    """Reject document: set status to 已驳回."""
    create_version_snapshot("document", doc_id, user.username, "reject")
    log_audit("document", doc_id, "reject", user.username)
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT id FROM documents WHERE id = ?", (doc_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Document not found")

        now = datetime.utcnow().isoformat()
        conn.execute(
            "UPDATE documents SET status = '已驳回', updated_at = ? WHERE id = ?",
            (now, doc_id),
        )
        conn.commit()

        # Remove chunks from ChromaDB
        collection = get_docs_collection()
        existing = collection.get(where={"doc_id": doc_id})
        if existing["ids"]:
            collection.delete(ids=existing["ids"])

        delete_fingerprints_by_entity("doc", doc_id)
        return {"status": "rejected", "doc_id": doc_id}
    finally:
        conn.close()


@router.post("/{doc_id}/reclean")
async def reclean_document(doc_id: str, user: CurrentUser = Depends(require_admin)):
    """Re-trigger async parsing for a document."""
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT id, source_file FROM documents WHERE id = ?", (doc_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Document not found")

        # Find the uploaded file
        source = row["source_file"]
        file_path = os.path.join(config.UPLOAD_DIR, f"{doc_id}_{source}")
        if not os.path.exists(file_path):
            raise HTTPException(status_code=400, detail="Source file not found on disk")

        now = datetime.utcnow().isoformat()
        conn.execute(
            "UPDATE documents SET status = '待处理', updated_at = ? WHERE id = ?",
            (now, doc_id),
        )
        conn.commit()

        task = parse_document_task.delay(doc_id, file_path)
        return {"status": "recleaning", "doc_id": doc_id, "task_id": task.id}
    finally:
        conn.close()


@router.delete("/{doc_id}")
async def delete_document(doc_id: str, user: CurrentUser = Depends(require_admin)):
    """Delete document and remove its chunks from ChromaDB."""
    create_version_snapshot("document", doc_id, user.username, "delete")
    log_audit("document", doc_id, "delete", user.username)
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT id FROM documents WHERE id = ?", (doc_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Document not found")

        # Remove chunks from ChromaDB
        collection = get_docs_collection()
        existing = collection.get(where={"doc_id": doc_id})
        if existing["ids"]:
            collection.delete(ids=existing["ids"])

        conn.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
        conn.commit()
        delete_fingerprints_by_entity("doc", doc_id)
        return {"status": "deleted", "doc_id": doc_id}
    finally:
        conn.close()
