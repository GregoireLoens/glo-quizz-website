import sqlite3

from fastapi import APIRouter, Depends, Query

from .. import config
from ..db import get_db

router = APIRouter(prefix="/api", tags=["quizzes"])

# Le catalogue est en lecture seule : il se peuple uniquement par les scripts
# d'import (`python -m app.import_openquizzdb`, `python -m app.import_quiz_maison`),
# qui écrivent directement en base. Aucun endpoint de création/édition/suppression
# n'est exposé — un compte ne peut donc pas publier de quiz dans le catalogue.

_LIST_SQL = """
SELECT q.id, q.title, q.emoji, q.category, q.play_count, q.created_at,
       u.id AS owner_id, u.username AS owner_name,
       u.avatar_color AS owner_color, u.avatar_symbol AS owner_symbol,
       (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) AS question_count
FROM quizzes q
JOIN users u ON u.id = q.owner_id
"""


def _quiz_summary(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "title": row["title"],
        "emoji": row["emoji"],
        "category": row["category"],
        "questionCount": row["question_count"],
        "playCount": row["play_count"],
        "author": {
            "id": row["owner_id"],
            "username": row["owner_name"],
            "avatarColor": row["owner_color"],
            "avatarSymbol": row["owner_symbol"],
        },
    }


@router.get("/categories")
def categories():
    return config.CATEGORIES


@router.get("/quizzes")
def list_quizzes(
    category: str | None = None,
    search: str | None = Query(default=None, max_length=80),
    sort: str = Query(default="popular", pattern="^(popular|recent)$"),
    limit: int = Query(default=12, ge=1, le=50),
    db: sqlite3.Connection = Depends(get_db),
):
    sql = _LIST_SQL
    where: list[str] = []
    params: list = []
    if category:
        where.append("q.category = ?")
        params.append(category)
    if search and search.strip():
        escaped = search.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        where.append(r"q.title LIKE ? ESCAPE '\'")
        params.append(f"%{escaped}%")
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY " + ("q.play_count DESC, q.created_at DESC" if sort == "popular" else "q.created_at DESC")
    sql += " LIMIT ?"
    params.append(limit)
    return [_quiz_summary(r) for r in db.execute(sql, params).fetchall()]
