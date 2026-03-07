import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from db.sqlite_db import get_connection
from core.auth import (
    hash_password, verify_password, create_token,
    get_current_user, require_admin, CurrentUser,
)
from models.schemas import LoginRequest, RegisterRequest

router = APIRouter(prefix="/api/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/login")
@limiter.limit("5/minute")
async def login(request: Request, body: LoginRequest):
    if not body.username or not body.password:
        raise HTTPException(status_code=400, detail="Username and password required")

    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT id, username, password_hash, role FROM users WHERE username = ?",
            (body.username,),
        ).fetchone()
    finally:
        conn.close()

    if not row or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_token(row["id"], row["username"], row["role"])
    return {
        "token": token,
        "user": {"id": row["id"], "username": row["username"], "role": row["role"]},
    }


@router.post("/register")
async def register(body: RegisterRequest, admin: CurrentUser = Depends(require_admin)):
    if not body.username or not body.password:
        raise HTTPException(status_code=400, detail="Username and password required")
    if body.role not in ("admin", "user"):
        raise HTTPException(status_code=400, detail="Invalid role")

    conn = get_connection()
    try:
        existing = conn.execute(
            "SELECT id FROM users WHERE username = ?", (body.username,)
        ).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="Username already exists")

        user_id = uuid.uuid4().hex
        now = datetime.utcnow().isoformat()
        conn.execute(
            "INSERT INTO users (id, username, password_hash, role, created_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (user_id, body.username, hash_password(body.password), body.role, now),
        )
        conn.commit()
    finally:
        conn.close()

    return {"user": {"id": user_id, "username": body.username, "role": body.role}}


@router.get("/me")
async def me(user: CurrentUser = Depends(get_current_user)):
    return {"id": user.user_id, "username": user.username, "role": user.role}
