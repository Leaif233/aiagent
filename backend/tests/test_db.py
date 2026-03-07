"""Tests for SQLite database and store functions."""
from db.sqlite_db import get_connection
from db.chat_store import upsert_session, insert_message, get_session_round_count, get_session_history


def test_init_db_creates_tables():
    conn = get_connection()
    tables = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    ).fetchall()
    conn.close()
    table_names = {r["name"] for r in tables}
    assert "documents" in table_names
    assert "tickets" in table_names
    assert "chat_sessions" in table_names
    assert "chat_messages" in table_names
    assert "users" in table_names
    assert "settings" in table_names


def test_default_admin_created():
    conn = get_connection()
    row = conn.execute(
        "SELECT username, role FROM users WHERE username = 'admin'"
    ).fetchone()
    conn.close()
    assert row is not None
    assert row["role"] == "admin"


def test_upsert_session_creates_new():
    upsert_session("sess-1", 0, user_id="user-1")
    count = get_session_round_count("sess-1")
    assert count == 0


def test_upsert_session_updates_existing():
    upsert_session("sess-2", 1, user_id="user-1")
    upsert_session("sess-2", 3)
    count = get_session_round_count("sess-2")
    assert count == 3


def test_insert_and_get_history():
    upsert_session("sess-3", 0, user_id="user-1")
    insert_message("sess-3", "user", "Hello")
    insert_message("sess-3", "assistant", "Hi there")
    history = get_session_history("sess-3")
    assert len(history) == 2
    assert history[0]["role"] == "user"
    assert history[0]["content"] == "Hello"
    assert history[1]["role"] == "assistant"


def test_get_session_round_count_missing():
    count = get_session_round_count("nonexistent")
    assert count == 0
