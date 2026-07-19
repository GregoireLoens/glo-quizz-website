import sqlite3

from fastapi import APIRouter, Depends, HTTPException

from .. import config
from ..db import get_db
from ..deps import get_current_user
from ..game.manager import manager
from ..schemas import GameCreateIn

router = APIRouter(prefix="/api", tags=["games"])


@router.post("/games", status_code=201)
def create_game(
    payload: GameCreateIn,
    user: sqlite3.Row = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    settings: dict = {}
    if payload.quizId is not None:
        row = db.execute(
            "SELECT q.id, q.title,"
            " (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) AS question_count"
            " FROM quizzes q WHERE q.id = ?",
            (payload.quizId,),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="quiz_not_found")
        settings = {"quizId": row["id"], "quizTitle": row["title"], "quizQuestionTotal": row["question_count"]}

    code = manager.generate_unique_code()
    cur = db.execute(
        "INSERT INTO games (code, quiz_id, host_id, question_count, time_per_question)"
        " VALUES (?, ?, ?, ?, ?)",
        (code, payload.quizId, user["id"], config.DEFAULT_QUESTION_COUNT, config.DEFAULT_TIME_PER_QUESTION),
    )
    db.commit()
    manager.create_room(code, cur.lastrowid, user["id"], settings)
    return {"code": code}


@router.get("/games/{code}")
def get_game(code: str):
    room = manager.get(code)
    if room is None:
        raise HTTPException(status_code=404, detail="game_not_found")
    return {
        "code": room.code,
        "status": room.phase,
        "playerCount": len(room.players),
        "joinable": room.phase == "lobby",
    }
