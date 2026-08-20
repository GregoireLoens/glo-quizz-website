from app import db
from tests.conftest import auth_headers, create_quiz, register


def test_list(client):
    session = register(client, "Auteur")
    quiz_id = create_quiz(session)

    listing = client.get("/api/quizzes").json()
    entry = next(q for q in listing if q["id"] == quiz_id)
    assert entry["questionCount"] == 2
    assert entry["author"]["username"] == "Auteur"


def test_catalogue_en_lecture_seule(client):
    """Aucun compte ne peut publier ni retoucher un quiz : le catalogue vient des imports."""
    session = register(client, "Auteur")
    headers = auth_headers(session)
    quiz_id = create_quiz(session)
    payload = {"title": "Pirate", "emoji": "🏴", "category": "Sciences", "questions": []}

    assert client.post("/api/quizzes", json=payload, headers=headers).status_code == 405
    assert client.get("/api/quizzes/mine", headers=headers).status_code == 404
    assert client.get(f"/api/quizzes/{quiz_id}", headers=headers).status_code == 404
    assert client.put(f"/api/quizzes/{quiz_id}", json=payload, headers=headers).status_code == 404
    assert client.delete(f"/api/quizzes/{quiz_id}", headers=headers).status_code == 404

    # le quiz est toujours là, intact
    assert any(q["id"] == quiz_id for q in client.get("/api/quizzes").json())


def test_search(client):
    session = register(client, "Auteur")
    create_quiz(session, title="Pokémon 1re génération")
    create_quiz(session, title="Cinéma français", category="Cinéma")

    hits = client.get("/api/quizzes", params={"search": "pok"}).json()
    assert [q["title"] for q in hits] == ["Pokémon 1re génération"]

    # insensible à la casse (ASCII) et combinable avec le filtre catégorie
    hits = client.get("/api/quizzes", params={"search": "CIN", "category": "Cinéma"}).json()
    assert [q["title"] for q in hits] == ["Cinéma français"]
    assert client.get("/api/quizzes", params={"search": "pok", "category": "Cinéma"}).json() == []

    # les jokers SQL sont neutralisés : « % » n'est pas un joker
    assert client.get("/api/quizzes", params={"search": "%"}).json() == []


def test_categorie_retiree_purgee_au_demarrage(client):
    """Une catégorie retirée de `config.CATEGORIES` disparaît aussi de la base.

    Le catalogue de prod est déjà peuplé : sortir « People » de la liste ne suffit pas,
    `db._purge_retired_categories` doit effacer les quiz au démarrage suivant. Les parties
    déjà jouées, elles, survivent avec un `quiz_id` à NULL.
    """
    session = register(client, "Auteur")
    survivant = create_quiz(session, title="Volcans", category="Nature")
    condamne = create_quiz(session, title="Potins de stars", category="People")

    conn = db.connect()
    try:
        conn.execute(
            "INSERT INTO games (code, quiz_id, host_id, status) VALUES ('PEOPLE', ?, ?, 'finished')",
            (condamne, session["user"]["id"]),
        )
        conn.commit()
        db._purge_retired_categories(conn)
        conn.commit()

        assert conn.execute("SELECT COUNT(*) FROM quizzes WHERE id = ?", (condamne,)).fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM quizzes WHERE id = ?", (survivant,)).fetchone()[0] == 1
        # questions en cascade, partie conservée mais orpheline
        assert conn.execute("SELECT COUNT(*) FROM questions WHERE quiz_id = ?", (condamne,)).fetchone()[0] == 0
        assert conn.execute("SELECT quiz_id FROM games WHERE code = 'PEOPLE'").fetchone()[0] is None
    finally:
        conn.close()

    assert "People" not in client.get("/api/categories").json()
    assert [q["title"] for q in client.get("/api/quizzes").json()] == ["Volcans"]
