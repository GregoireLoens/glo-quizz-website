import sqlite3
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query

from ..db import get_db
from ..deps import get_optional_user

router = APIRouter(prefix="/api", tags=["leaderboard"])

_PERIOD_DAYS = {"week": 7, "month": 30}

# « Depuis toujours » : le rating actuel fait foi.
_ALL_TIME_SQL = """
    SELECT u.id AS user_id, u.username, u.avatar_color, u.avatar_symbol, u.elo,
           u.elo_games AS games_played, NULL AS elo_delta
    FROM users u
    WHERE u.elo_games > 0
    ORDER BY u.elo DESC, u.elo_games ASC
"""

# Sur une période, un rating instantané ne veut rien dire : on classe à la progression.
# `elo_delta IS NOT NULL` écarte d'office les parties solo, non classées.
_PERIOD_SQL = """
    SELECT u.id AS user_id, u.username, u.avatar_color, u.avatar_symbol, u.elo,
           COUNT(*) AS games_played, SUM(gp.elo_delta) AS elo_delta
    FROM game_players gp
    JOIN games g ON g.id = gp.game_id AND g.status = 'finished'
    JOIN users u ON u.id = gp.user_id
    WHERE g.finished_at >= :since AND gp.elo_delta IS NOT NULL
    GROUP BY u.id
    ORDER BY elo_delta DESC, games_played ASC, u.elo DESC
"""


@router.get("/leaderboard")
def leaderboard(
    period: str = Query(default="all", pattern="^(week|month|all)$"),
    limit: int = Query(default=10, ge=3, le=100),
    user: sqlite3.Row | None = Depends(get_optional_user),
    db: sqlite3.Connection = Depends(get_db),
):
    if period in _PERIOD_DAYS:
        since = (datetime.now(timezone.utc) - timedelta(days=_PERIOD_DAYS[period])).strftime(
            "%Y-%m-%d %H:%M:%S"
        )
        rows = db.execute(_PERIOD_SQL, {"since": since}).fetchall()
    else:
        rows = db.execute(_ALL_TIME_SQL).fetchall()

    entries = [
        {
            "rank": i + 1,
            "userId": r["user_id"],
            "username": r["username"],
            "avatarColor": r["avatar_color"],
            "avatarSymbol": r["avatar_symbol"],
            "elo": r["elo"],
            "eloDelta": r["elo_delta"],
            "gamesPlayed": r["games_played"],
        }
        for i, r in enumerate(rows)
    ]

    me = None
    if user is not None:
        me = next((e for e in entries if e["userId"] == user["id"]), None)

    return {"entries": entries[:limit], "me": me}
