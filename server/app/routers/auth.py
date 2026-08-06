import sqlite3

from fastapi import APIRouter, Depends, HTTPException

from .. import avatar
from ..db import get_db
from ..deps import get_current_user
from ..schemas import AvatarIn, LoginIn, RegisterIn
from ..security import create_token, generate_user_code, hash_code, verify_code

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _user_dict(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "username": row["username"],
        "avatarColor": row["avatar_color"],
        "avatarSymbol": row["avatar_symbol"],
    }


@router.post("/register", status_code=201)
def register(payload: RegisterIn, db: sqlite3.Connection = Depends(get_db)):
    code = generate_user_code()
    # Couleur d'office dérivée du pseudo : le joueur la change à l'étape suivante de
    # l'inscription (POST /avatar), mais un compte n'est jamais sans marque.
    color = avatar.default_color(payload.username)
    try:
        cur = db.execute(
            "INSERT INTO users (username, username_norm, code_hash, avatar_color) VALUES (?, ?, ?, ?)",
            (payload.username, payload.username.lower(), hash_code(code), color),
        )
        db.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="username_taken")
    user_id = cur.lastrowid
    return {
        "token": create_token(user_id),
        "user": {
            "id": user_id,
            "username": payload.username,
            "avatarColor": color,
            "avatarSymbol": None,
        },
        "code": code,
    }


@router.post("/login")
def login(payload: LoginIn, db: sqlite3.Connection = Depends(get_db)):
    row = db.execute(
        "SELECT id, username, code_hash, avatar_color, avatar_symbol FROM users WHERE username_norm = ?",
        (payload.username.strip().lower(),),
    ).fetchone()
    if row is None or not verify_code(payload.code, row["code_hash"]):
        raise HTTPException(status_code=401, detail="invalid_credentials")
    return {"token": create_token(row["id"]), "user": _user_dict(row)}


@router.get("/me")
def me(user: sqlite3.Row = Depends(get_current_user)):
    return _user_dict(user)


@router.post("/avatar")
def set_avatar(
    payload: AvatarIn,
    user: sqlite3.Row = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    """Couleur et symbole du joueur. Une partie en cours garde l'avatar lu au join —
    le changement se voit à la reconnexion ou au salon suivant."""
    db.execute(
        "UPDATE users SET avatar_color = ?, avatar_symbol = ? WHERE id = ?",
        (payload.color, payload.symbol, user["id"]),
    )
    db.commit()
    return {
        "id": user["id"],
        "username": user["username"],
        "avatarColor": payload.color,
        "avatarSymbol": payload.symbol,
    }
