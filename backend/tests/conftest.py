"""Shared test fixtures for backend tests."""
import os
import sys
import tempfile

import pytest

# Ensure backend is on sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Set JWT secret before any imports
os.environ["JWT_SECRET"] = "test-secret-key-for-testing"

import config
from db.sqlite_db import init_db, get_connection

_tmp_dir = tempfile.mkdtemp()
_test_db = os.path.join(_tmp_dir, "test.db")


@pytest.fixture(autouse=True)
def fresh_db(monkeypatch):
    """Give each test a fresh SQLite database."""
    import db.sqlite_db as sqlite_mod
    monkeypatch.setattr(config, "SQLITE_DB_PATH", _test_db)
    monkeypatch.setattr(sqlite_mod, "DB_PATH", _test_db)
    # Remove old DB if exists
    if os.path.exists(_test_db):
        os.remove(_test_db)
    init_db()
    yield
