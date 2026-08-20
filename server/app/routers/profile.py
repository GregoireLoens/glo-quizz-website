"""Profil du joueur connecté : rating, statistiques et historique de parties.

`game_players` conservait depuis toujours le détail de chaque partie (score, rang,
`elo_before`, `elo_delta`) sans que rien ne le relise en dehors de l'agrégat de
période du classement. C'est ce que cet endpoint expose, pour l'écran `/me`.
"""
import sqlite3

from fastapi import APIRouter, Depends, Query

from ..db import get_db
from ..deps import get_current_user

router = APIRouter(prefix="/api/me", tags=["profile"])

# Une partie ne compte comme victoire que si quelqu'un a été battu : finir premier
# d'une partie solo n'en est pas une (c'est aussi la règle de l'Elo, voir elo.py).
_STATS_SQL = """
SELECT COUNT(*) AS games,
       SUM(CASE
             WHEN gp.rank = 1
              AND (SELECT COUNT(*) FROM game_players x WHERE x.game_id = g.id) > 1
             THEN 1 ELSE 0
           END) AS wins,
       SUM(CASE WHEN gp.elo_delta IS NOT NULL THEN 1 ELSE 0 END) AS rated_games,
       COALESCE(SUM(gp.correct_count), 0) AS correct_count,
       COALESCE(SUM(g.question_count), 0) AS question_count
FROM game_players gp
JOIN games g ON g.id = gp.game_id AND g.status = 'finished'
WHERE gp.user_id = ?
"""

_HISTORY_SQL = """
SELECT g.id AS game_id, g.finished_at, g.question_count,
       gp.score, gp.correct_count, gp.rank, gp.elo_before, gp.elo_delta,
       q.title AS quiz_title, q.emoji AS quiz_emoji,
       (SELECT COUNT(*) FROM game_players x WHERE x.game_id = g.id) AS player_count
FROM game_players gp
JOIN games g ON g.id = gp.game_id AND g.status = 'finished'
LEFT JOIN quizzes q ON q.id = g.quiz_id
WHERE gp.user_id = ?
ORDER BY g.finished_at DESC, g.id DESC
LIMIT ?
"""

# Même ordre que le classement « depuis toujours » (leaderboard._ALL_TIME_SQL) : à
# rating égal, celui qui a joué le moins de parties classées passe devant.
_RANK_SQL = """
SELECT COUNT(*) + 1 AS rank
FROM users
WHERE elo_games > 0
  AND (elo > :elo OR (elo = :elo AND elo_games < :games))
"""


@router.get("")
def profile(
    limit: int = Query(default=20, ge=1, le=100),
    user: sqlite3.Row = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    # `get_current_user` ne remonte que l'identité : le rating se relit ici.
    me = db.execute("SELECT elo, elo_games FROM users WHERE id = ?", (user["id"],)).fetchone()
    stats = db.execute(_STATS_SQL, (user["id"],)).fetchone()
    history = db.execute(_HISTORY_SQL, (user["id"], limit)).fetchall()

    rank = None
    ranked_players = db.execute("SELECT COUNT(*) FROM users WHERE elo_games > 0").fetchone()[0]
    if me["elo_games"] > 0:
        rank = db.execute(_RANK_SQL, {"elo": me["elo"], "games": me["elo_games"]}).fetchone()["rank"]

    return {
        "elo": me["elo"],
        "eloGames": me["elo_games"],
        "rank": rank,
        "rankedPlayers": ranked_players,
        "stats": {
            "games": stats["games"],
            "wins": stats["wins"] or 0,
            "ratedGames": stats["rated_games"] or 0,
            "correctCount": stats["correct_count"],
            "questionCount": stats["question_count"],
        },
        "games": [
            {
                "gameId": r["game_id"],
                "finishedAt": r["finished_at"],
                # `quiz_id` est NULL sur un Mix aléatoire, une partie en Survie, et sur
                # une partie dont le quiz a depuis été retiré du catalogue : le titre
                # est simplement absent, au client de dire « partie aléatoire ».
                "quizTitle": r["quiz_title"],
                "quizEmoji": r["quiz_emoji"],
                "rank": r["rank"],
                "playerCount": r["player_count"],
                "score": r["score"],
                "correctCount": r["correct_count"],
                "questionCount": r["question_count"],
                "eloBefore": r["elo_before"],
                "eloDelta": r["elo_delta"],
            }
            for r in history
        ],
    }
