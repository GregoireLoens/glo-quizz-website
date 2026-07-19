import json
import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Query

from .. import config
from ..db import get_db
from ..deps import get_current_user
from ..schemas import QuizIn

router = APIRouter(prefix="/api", tags=["quizzes"])

_LIST_SQL = """
SELECT q.id, q.title, q.emoji, q.category, q.play_count, q.created_at,
       u.id AS owner_id, u.username AS owner_name,
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
        "author": {"id": row["owner_id"], "username": row["owner_name"]},
    }


@router.get("/categories")
def categories():
    return config.CATEGORIES


@router.get("/quizzes")
def list_quizzes(
    category: str | None = None,
    sort: str = Query(default="popular", pattern="^(popular|recent)$"),
    limit: int = Query(default=12, ge=1, le=50),
    db: sqlite3.Connection = Depends(get_db),
):
    sql = _LIST_SQL
    params: list = []
    if category:
        sql += " WHERE q.category = ?"
        params.append(category)
    sql += " ORDER BY " + ("q.play_count DESC, q.created_at DESC" if sort == "popular" else "q.created_at DESC")
    sql += " LIMIT ?"
    params.append(limit)
    return [_quiz_summary(r) for r in db.execute(sql, params).fetchall()]


@router.get("/quizzes/mine")
def my_quizzes(user: sqlite3.Row = Depends(get_current_user), db: sqlite3.Connection = Depends(get_db)):
    rows = db.execute(_LIST_SQL + " WHERE q.owner_id = ? ORDER BY q.created_at DESC", (user["id"],)).fetchall()
    return [_quiz_summary(r) for r in rows]


@router.get("/quizzes/{quiz_id}")
def get_quiz(
    quiz_id: int,
    user: sqlite3.Row = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    row = db.execute(_LIST_SQL + " WHERE q.id = ?", (quiz_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="quiz_not_found")
    if row["owner_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="not_owner")
    questions = db.execute(
        "SELECT text, answers, correct_index FROM questions WHERE quiz_id = ? ORDER BY position",
        (quiz_id,),
    ).fetchall()
    result = _quiz_summary(row)
    result["questions"] = [
        {"text": q["text"], "answers": json.loads(q["answers"]), "correctIndex": q["correct_index"]}
        for q in questions
    ]
    return result


def _insert_questions(db: sqlite3.Connection, quiz_id: int, payload: QuizIn) -> None:
    db.executemany(
        "INSERT INTO questions (quiz_id, position, text, answers, correct_index) VALUES (?, ?, ?, ?, ?)",
        [
            (quiz_id, i, q.text, json.dumps(q.answers, ensure_ascii=False), q.correctIndex)
            for i, q in enumerate(payload.questions)
        ],
    )


@router.post("/quizzes", status_code=201)
def create_quiz(
    payload: QuizIn,
    user: sqlite3.Row = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.execute(
        "INSERT INTO quizzes (owner_id, title, emoji, category) VALUES (?, ?, ?, ?)",
        (user["id"], payload.title, payload.emoji, payload.category),
    )
    quiz_id = cur.lastrowid
    _insert_questions(db, quiz_id, payload)
    db.commit()
    return {"id": quiz_id}


def _require_owner(db: sqlite3.Connection, quiz_id: int, user_id: int) -> None:
    row = db.execute("SELECT owner_id FROM quizzes WHERE id = ?", (quiz_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="quiz_not_found")
    if row["owner_id"] != user_id:
        raise HTTPException(status_code=403, detail="not_owner")


@router.put("/quizzes/{quiz_id}")
def update_quiz(
    quiz_id: int,
    payload: QuizIn,
    user: sqlite3.Row = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    _require_owner(db, quiz_id, user["id"])
    db.execute(
        "UPDATE quizzes SET title = ?, emoji = ?, category = ? WHERE id = ?",
        (payload.title, payload.emoji, payload.category, quiz_id),
    )
    db.execute("DELETE FROM questions WHERE quiz_id = ?", (quiz_id,))
    _insert_questions(db, quiz_id, payload)
    db.commit()
    return {"id": quiz_id}


@router.delete("/quizzes/{quiz_id}", status_code=204)
def delete_quiz(
    quiz_id: int,
    user: sqlite3.Row = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    _require_owner(db, quiz_id, user["id"])
    db.execute("DELETE FROM quizzes WHERE id = ?", (quiz_id,))
    db.commit()
