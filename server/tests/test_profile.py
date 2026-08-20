"""Profil du joueur : rating, statistiques et historique de parties (`GET /api/me`)."""
from app import db
from tests.conftest import auth_headers, create_quiz, register


def _finished_game(user_ids: list[int], host_id: int, quiz_id: int | None, ranks: list[int],
                   question_count: int = 10, elo: list[tuple[int, int] | None] | None = None) -> int:
    """Écrit une partie terminée en base, comme le ferait `_persist_results`."""
    conn = db.connect()
    try:
        cur = conn.execute(
            "INSERT INTO games (code, quiz_id, host_id, question_count, time_per_question,"
            " status, finished_at) VALUES ('HIST01', ?, ?, ?, 30, 'finished', datetime('now'))",
            (quiz_id, host_id, question_count),
        )
        game_id = cur.lastrowid
        for i, uid in enumerate(user_ids):
            before, delta = (elo[i] if elo and elo[i] else (None, None))
            conn.execute(
                "INSERT INTO game_players (game_id, user_id, score, correct_count, rank,"
                " elo_before, elo_delta) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (game_id, uid, 1000 * (len(user_ids) - i), 8 - i, ranks[i], before, delta),
            )
        conn.commit()
        return game_id
    finally:
        conn.close()


def test_profil_vide(client):
    session = register(client, "Nouveau")
    data = client.get("/api/me", headers=auth_headers(session)).json()

    assert data["elo"] == 1000 and data["eloGames"] == 0
    assert data["rank"] is None  # jamais classé : pas de place au classement général
    assert data["stats"] == {"games": 0, "wins": 0, "ratedGames": 0, "correctCount": 0, "questionCount": 0}
    assert data["games"] == []


def test_profil_authentification_requise(client):
    assert client.get("/api/me").status_code == 401


def test_historique_et_statistiques(client):
    gagnant = register(client, "Gagnante")
    perdant = register(client, "Perdant")
    quiz_id = create_quiz(gagnant, title="Volcans", category="Nature")
    ids = [gagnant["user"]["id"], perdant["user"]["id"]]
    _finished_game(ids, ids[0], quiz_id, ranks=[1, 2], elo=[(1000, 16), (1000, -16)])

    data = client.get("/api/me", headers=auth_headers(gagnant)).json()
    assert data["stats"]["games"] == 1
    assert data["stats"]["wins"] == 1
    assert data["stats"]["ratedGames"] == 1

    (game,) = data["games"]
    assert game["quizTitle"] == "Volcans"
    assert game["rank"] == 1 and game["playerCount"] == 2
    assert game["eloBefore"] == 1000 and game["eloDelta"] == 16

    # le perdant voit la même partie, avec son propre résultat
    (perdue,) = client.get("/api/me", headers=auth_headers(perdant)).json()["games"]
    assert perdue["rank"] == 2 and perdue["eloDelta"] == -16
    assert client.get("/api/me", headers=auth_headers(perdant)).json()["stats"]["wins"] == 0


def test_partie_solo_ne_compte_pas_comme_victoire(client):
    """Finir premier tout seul n'est pas une victoire — même règle que l'Elo."""
    session = register(client, "Solitaire")
    uid = session["user"]["id"]
    _finished_game([uid], uid, None, ranks=[1])

    data = client.get("/api/me", headers=auth_headers(session)).json()
    assert data["stats"]["games"] == 1
    assert data["stats"]["wins"] == 0
    assert data["stats"]["ratedGames"] == 0
    # quiz_id NULL (mix aléatoire, survie, ou quiz retiré depuis) : pas de titre
    assert data["games"][0]["quizTitle"] is None


def test_rang_general_suit_le_classement(client):
    """Le rang renvoyé est celui du classement « depuis toujours », ex æquo compris."""
    premier = register(client, "Premiere")
    second = register(client, "Second")
    conn = db.connect()
    try:
        conn.execute("UPDATE users SET elo = 1200, elo_games = 5 WHERE id = ?", (premier["user"]["id"],))
        conn.execute("UPDATE users SET elo = 1100, elo_games = 5 WHERE id = ?", (second["user"]["id"],))
        conn.commit()
    finally:
        conn.close()

    assert client.get("/api/me", headers=auth_headers(premier)).json()["rank"] == 1
    data = client.get("/api/me", headers=auth_headers(second)).json()
    assert data["rank"] == 2 and data["rankedPlayers"] == 2
