import sqlite3

from fastapi import APIRouter, Depends, HTTPException

from ..db import get_db
from ..deps import get_current_user
from ..schemas import LoginIn, RegisterIn
from ..security import create_token, generate_user_code, hash_code, verify_code

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _user_dict(row: sqlite3.Row) -> dict:
    return {"id": row["id"], "username": row["username"]}


@router.post("/register", status_code=201)
def register(payload: RegisterIn, db: sqlite3.Connection = Depends(get_db)):
    code = generate_user_code()
    try:
        cur = db.execute(
            "INSERT INTO users (username, username_norm, code_hash) VALUES (?, ?, ?)",
            (payload.username, payload.username.lower(), hash_code(code)),
        )
        db.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="username_taken")
    user_id = cur.lastrowid
    return {
        "token": create_token(user_id),
        "user": {"id": user_id, "username": payload.username},
        "code": code,
    }


@router.post("/login")
def login(payload: LoginIn, db: sqlite3.Connection = Depends(get_db)):
    row = db.execute(
        "SELECT id, username, code_hash FROM users WHERE username_norm = ?",
        (payload.username.strip().lower(),),
    ).fetchone()
    if row is None or not verify_code(payload.code, row["code_hash"]):
        raise HTTPException(status_code=401, detail="invalid_credentials")
    return {"token": create_token(row["id"]), "user": _user_dict(row)}


@router.get("/me")
def me(user: sqlite3.Row = Depends(get_current_user)):
    return _user_dict(user)
