import json

from fastapi import APIRouter, HTTPException, Depends

from db.sqlite_db import get_connection
from db.versioning import create_version_snapshot, log_audit
from models.schemas import RollbackRequest

router = APIRouter(prefix="/api", tags=["versions"])


@router.get("/versions/{entity_type}/{entity_id}")
async def get_version_history(entity_type: str, entity_id: str):
    """Get version history list (metadata only, no full snapshots)."""
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT id, version_number, changed_by, change_reason, created_at "
            "FROM versions WHERE entity_type = ? AND entity_id = ? "
            "ORDER BY version_number DESC",
            (entity_type, entity_id),
        ).fetchall()
    finally:
        conn.close()
    return {"items": [dict(r) for r in rows]}


@router.get("/versions/{entity_type}/{entity_id}/{version_id}")
async def get_version_snapshot(entity_type: str, entity_id: str, version_id: str):
    """Get a specific version's full snapshot."""
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM versions WHERE id = ? AND entity_type = ? AND entity_id = ?",
            (version_id, entity_type, entity_id),
        ).fetchone()
    finally:
        conn.close()
    if not row:
        return {"error": "not found"}
    result = dict(row)
    result["snapshot"] = json.loads(result.pop("snapshot_json"))
    return result


@router.post("/versions/{entity_type}/{entity_id}/rollback")
async def rollback_version(entity_type: str, entity_id: str, body: RollbackRequest):
    """Rollback an entity to a previous version."""
    version_id = body.version_id

    conn = get_connection()
    try:
        # Load target snapshot
        ver_row = conn.execute(
            "SELECT snapshot_json FROM versions WHERE id = ?", (version_id,)
        ).fetchone()
        if not ver_row:
            return {"error": "version not found"}
        snapshot = json.loads(ver_row["snapshot_json"])
    finally:
        conn.close()

    # Snapshot current state before rollback
    create_version_snapshot(entity_type, entity_id, "system", "rollback")

    # Apply snapshot to entity
    table = "documents" if entity_type == "document" else "tickets"
    conn = get_connection()
    try:
        if entity_type == "document":
            conn.execute(
                "UPDATE documents SET title=?, category=?, status=?, "
                "raw_content=?, cleaned_content=?, image_assets=?, updated_at=? WHERE id=?",
                (snapshot.get("title", ""), snapshot.get("category", ""),
                 snapshot.get("status", ""), snapshot.get("raw_content", ""),
                 snapshot.get("cleaned_content", ""), snapshot.get("image_assets", "[]"),
                 snapshot.get("updated_at", ""), entity_id),
            )
        else:
            conn.execute(
                "UPDATE tickets SET ticket_number=?, status=?, raw_content=?, "
                "phenomenon=?, cause=?, solution=?, updated_at=? WHERE id=?",
                (snapshot.get("ticket_number", ""), snapshot.get("status", ""),
                 snapshot.get("raw_content", ""), snapshot.get("phenomenon", ""),
                 snapshot.get("cause", ""), snapshot.get("solution", ""),
                 snapshot.get("updated_at", ""), entity_id),
            )
        conn.commit()
    finally:
        conn.close()

    log_audit(entity_type, entity_id, "rollback", "system", f"rolled back to version {version_id}")
    return {"status": "rolled_back"}


@router.get("/audit-log")
async def get_audit_log(entity_type: str = None, entity_id: str = None, limit: int = 50):
    """Query audit log with optional filters."""
    conn = get_connection()
    try:
        query = "SELECT * FROM audit_log WHERE 1=1"
        params = []
        if entity_type:
            query += " AND entity_type = ?"
            params.append(entity_type)
        if entity_id:
            query += " AND entity_id = ?"
            params.append(entity_id)
        query += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)
        rows = conn.execute(query, params).fetchall()
    finally:
        conn.close()
    return {"items": [dict(r) for r in rows]}
