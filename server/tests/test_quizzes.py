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
