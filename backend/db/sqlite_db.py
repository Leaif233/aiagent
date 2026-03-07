import sqlite3
import os
from datetime import datetime

import config

DB_PATH = config.SQLITE_DB_PATH


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            category TEXT DEFAULT '',
            status TEXT DEFAULT '待处理',
            raw_content TEXT DEFAULT '',
            cleaned_content TEXT DEFAULT '',
            image_assets TEXT DEFAULT '[]',
            source_file TEXT DEFAULT '',
            last_edited_by TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tickets (
            id TEXT PRIMARY KEY,
            ticket_number TEXT NOT NULL,
            status TEXT DEFAULT '待处理',
            raw_content TEXT DEFAULT '',
            phenomenon TEXT DEFAULT '',
            cause TEXT DEFAULT '',
            solution TEXT DEFAULT '',
            last_edited_by TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            round_count INTEGER DEFAULT 0,
            resolved INTEGER DEFAULT 0
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            stage INTEGER DEFAULT 0,
            sources_json TEXT DEFAULT '[]',
            feedback INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS feedback_tickets (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            message_id TEXT NOT NULL,
            user_comment TEXT DEFAULT '',
            status TEXT DEFAULT '待处理',
            created_at TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS versions (
            id TEXT PRIMARY KEY,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            version_number INTEGER NOT NULL,
            snapshot_json TEXT NOT NULL,
            changed_by TEXT DEFAULT 'admin',
            change_reason TEXT DEFAULT '',
            created_at TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS audit_log (
            id TEXT PRIMARY KEY,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            action TEXT NOT NULL,
            changed_by TEXT DEFAULT 'admin',
            details TEXT DEFAULT '',
            created_at TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS question_fingerprints (
            id TEXT PRIMARY KEY,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            question_text TEXT NOT NULL,
            section_title TEXT DEFAULT '',
            created_at TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_qf_entity
        ON question_fingerprints(entity_type, entity_id)
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS no_result_queries (
            id TEXT PRIMARY KEY,
            query_text TEXT NOT NULL,
            user_id TEXT DEFAULT '',
            created_at TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            created_at TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS llm_usage_log (
            id TEXT PRIMARY KEY,
            task_type TEXT NOT NULL,
            provider TEXT NOT NULL,
            model TEXT NOT NULL,
            input_tokens INTEGER DEFAULT 0,
            output_tokens INTEGER DEFAULT 0,
            total_tokens INTEGER DEFAULT 0,
            latency_ms INTEGER DEFAULT 0,
            entity_id TEXT DEFAULT '',
            session_id TEXT DEFAULT '',
            success INTEGER DEFAULT 1,
            created_at TEXT NOT NULL
        )
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_usage_created
        ON llm_usage_log(created_at)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_usage_task
        ON llm_usage_log(task_type, created_at)
    """)

    # Insert default admin if not exists
    existing = cursor.execute(
        "SELECT id FROM users WHERE username = 'admin'"
    ).fetchone()
    if not existing:
        import uuid
        from core.auth import hash_password
        admin_id = uuid.uuid4().hex
        now = datetime.utcnow().isoformat()
        cursor.execute(
            "INSERT INTO users (id, username, password_hash, role, created_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (admin_id, "admin", hash_password("admin123"), "admin", now),
        )

    conn.commit()
    conn.close()
