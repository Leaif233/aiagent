"""Tests for authentication module."""
from core.auth import hash_password, verify_password, create_token, decode_token


def test_hash_and_verify_password():
    hashed = hash_password("mypassword")
    assert hashed != "mypassword"
    assert verify_password("mypassword", hashed)
    assert not verify_password("wrongpassword", hashed)


def test_create_and_decode_token():
    token = create_token("user123", "testuser", "admin")
    payload = decode_token(token)
    assert payload["sub"] == "user123"
    assert payload["username"] == "testuser"
    assert payload["role"] == "admin"
