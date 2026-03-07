"""Tests for API endpoints using FastAPI TestClient."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient
from main import app
from core.auth import create_token

client = TestClient(app, raise_server_exceptions=False)


def _admin_headers():
    token = create_token("admin-id", "admin", "admin")
    return {"Authorization": f"Bearer {token}"}


def _user_headers(user_id="user-1"):
    token = create_token(user_id, "testuser", "user")
    return {"Authorization": f"Bearer {token}"}


# --- Root ---

def test_root():
    resp = client.get("/")
    assert resp.status_code == 200
    assert "AI Technical Support System" in resp.json()["message"]


# --- Auth ---

def test_login_success():
    resp = client.post("/api/auth/login", json={
        "username": "admin", "password": "admin123"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "token" in data
    assert data["user"]["role"] == "admin"


def test_login_wrong_password():
    resp = client.post("/api/auth/login", json={
        "username": "admin", "password": "wrong"
    })
    assert resp.status_code == 401


def test_login_missing_fields():
    resp = client.post("/api/auth/login", json={
        "username": "", "password": ""
    })
    assert resp.status_code == 400


def test_me_endpoint():
    resp = client.get("/api/auth/me", headers=_admin_headers())
    assert resp.status_code == 200
    assert resp.json()["username"] == "admin"


def test_unauthenticated_access():
    resp = client.get("/api/auth/me")
    assert resp.status_code in (401, 403)


# --- Settings ---

def test_settings_requires_admin():
    resp = client.get("/api/settings", headers=_user_headers())
    assert resp.status_code == 403


def test_settings_get_masked_keys():
    resp = client.get("/api/settings", headers=_admin_headers())
    assert resp.status_code == 200
    data = resp.json()
    # API keys should be masked or empty
    for key in ("anthropic_api_key", "deepseek_api_key", "dashscope_api_key"):
        val = data.get(key, "")
        assert not val or val.startswith("****") or len(val) <= 4


# --- Feedback ---

def test_feedback_invalid_rating():
    resp = client.post("/api/feedback", json={
        "message_id": "msg-1", "rating": 5
    }, headers=_user_headers())
    assert resp.status_code == 400


def test_feedback_stats():
    resp = client.get("/api/feedback/stats", headers=_user_headers())
    assert resp.status_code == 200
    data = resp.json()
    assert "total_thumbs_up" in data
    assert "total_thumbs_down" in data


# --- Sessions ---

def test_sessions_list_empty():
    resp = client.get("/api/sessions", headers=_user_headers())
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert data["items"] == []


def test_session_not_found():
    resp = client.get("/api/sessions/nonexistent/messages", headers=_user_headers())
    assert resp.status_code == 404


# --- Docs ---

def test_docs_list():
    resp = client.get("/api/docs", headers=_admin_headers())
    assert resp.status_code == 200
    assert "items" in resp.json()


def test_docs_requires_auth():
    resp = client.get("/api/docs")
    assert resp.status_code in (401, 403)
