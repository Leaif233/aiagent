import json
import uuid
from datetime import datetime

from db.sqlite_db import get_connection


def create_version_snapshot(entity_type: str, entity_id: str, changed_by: str, reason: str = "") -> str:
    """Read current row, serialize to JSON, insert into versions table. Returns version_id."""
    conn = get_connection()
    try:
        # Determine table
        table = "documents" if entity_type == "document" else "tickets"
        row = conn.execute(f"SELECT * FROM {table} WHERE id = ?", (entity_id,)).fetchone()
        if not row:
            return ""

        # Get next version number
        last = conn.execute(
            "SELECT MAX(version_number) as vn FROM versions WHERE entity_type = ? AND entity_id = ?",
            (entity_type, entity_id),
        ).fetchone()
        version_number = (last["vn"] or 0) + 1

        # Serialize row to JSON
        snapshot = {k: row[k] for k in row.keys()}
        snapshot_json = json.dumps(snapshot, ensure_ascii=False)

        version_id = uuid.uuid4().hex
        now = datetime.utcnow().isoformat()
        conn.execute(
            "INSERT INTO versions (id, entity_type, entity_id, version_number, snapshot_json, changed_by, change_reason, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (version_id, entity_type, entity_id, version_number, snapshot_json, changed_by, reason, now),
        )
        conn.commit()
        return version_id
    finally:
        conn.close()


def log_audit(entity_type: str, entity_id: str, action: str, changed_by: str, details: str = "") -> str:
    """Insert a row into audit_log. Returns log_id."""
    conn = get_connection()
    try:
        log_id = uuid.uuid4().hex
        now = datetime.utcnow().isoformat()
        conn.execute(
            "INSERT INTO audit_log (id, entity_type, entity_id, action, changed_by, details, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (log_id, entity_type, entity_id, action, changed_by, details, now),
        )
        conn.commit()
        return log_id
    finally:
        conn.close()
