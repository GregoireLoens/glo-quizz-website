import sqlite3

from fastapi import Depends, Header, HTTPException

from .db import get_db
from .security import parse_token


def _user_from_header(authorization: str | None, db: sqlite3.Connection) -> sqlite3.Row | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    user_id = parse_token(authorization[len("Bearer "):])
    if user_id is None:
        return None
    return db.execute("SELECT id, username FROM users WHERE id = ?", (user_id,)).fetchone()


def get_current_user(
    authorization: str | None = Header(default=None),
    db: sqlite3.Connection = Depends(get_db),
) -> sqlite3.Row:
    user = _user_from_header(authorization, db)
    if user is None:
        raise HTTPException(status_code=401, detail="invalid_token")
    return user


def get_optional_user(
    authorization: str | None = Header(default=None),
    db: sqlite3.Connection = Depends(get_db),
) -> sqlite3.Row | None:
    return _user_from_header(authorization, db)
