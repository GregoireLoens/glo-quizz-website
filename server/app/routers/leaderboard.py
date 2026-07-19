import sqlite3
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query

from ..db import get_db
from ..deps import get_optional_user

router = APIRouter(prefix="/api", tags=["leaderboard"])

_PERIOD_DAYS = {"week": 7, "month": 30}


@router.get("/leaderboard")
def leaderboard(
    period: str = Query(default="all", pattern="^(week|month|all)$"),
    limit: int = Query(default=10, ge=3, le=100),
    user: sqlite3.Row | None = Depends(get_optional_user),
    db: sqlite3.Connection = Depends(get_db),
):
    since = None
    if period in _PERIOD_DAYS:
        since = (datetime.now(timezone.utc) - timedelta(days=_PERIOD_DAYS[period])).strftime("%Y-%m-%d %H:%M:%S")

    rows = db.execute(
        """
        SELECT u.id AS user_id, u.username,
               COUNT(*) AS games_played, SUM(gp.score) AS total_points
        FROM game_players gp
        JOIN games g ON g.id = gp.game_id AND g.status = 'finished'
        JOIN users u ON u.id = gp.user_id
        WHERE (:since IS NULL OR g.finished_at >= :since)
        GROUP BY u.id
        ORDER BY total_points DESC, games_played ASC
        """,
        {"since": since},
    ).fetchall()

    entries = [
        {
            "rank": i + 1,
            "userId": r["user_id"],
            "username": r["username"],
            "gamesPlayed": r["games_played"],
            "totalPoints": r["total_points"],
        }
        for i, r in enumerate(rows)
    ]

    me = None
    if user is not None:
        me = next((e for e in entries if e["userId"] == user["id"]), None)

    return {"entries": entries[:limit], "me": me}
