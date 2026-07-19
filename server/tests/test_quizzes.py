from tests.conftest import auth_headers, register


def quiz_payload(title="Quiz test", **overrides):
    payload = {
        "title": title,
        "emoji": "🎯",
        "category": "Sciences",
        "questions": [
            {"text": "1 + 1 ?", "answers": ["1", "2", "3", "4"], "correctIndex": 1},
            {"text": "2 + 2 ?", "answers": ["2", "3", "4", "5"], "correctIndex": 2},
        ],
    }
    payload.update(overrides)
    return payload


def test_create_and_list(client):
    session = register(client, "Auteur")
    r = client.post("/api/quizzes", json=quiz_payload(), headers=auth_headers(session))
    assert r.status_code == 201
    quiz_id = r.json()["id"]

    listing = client.get("/api/quizzes").json()
    entry = next(q for q in listing if q["id"] == quiz_id)
    assert entry["questionCount"] == 2
    assert entry["author"]["username"] == "Auteur"

    mine = client.get("/api/quizzes/mine", headers=auth_headers(session)).json()
    assert [q["id"] for q in mine] == [quiz_id]


def test_details_owner_only(client):
    owner = register(client, "Auteur")
    other = register(client, "Curieux")
    quiz_id = client.post("/api/quizzes", json=quiz_payload(), headers=auth_headers(owner)).json()["id"]

    r = client.get(f"/api/quizzes/{quiz_id}", headers=auth_headers(owner))
    assert r.status_code == 200
    assert r.json()["questions"][0]["correctIndex"] == 1

    assert client.get(f"/api/quizzes/{quiz_id}", headers=auth_headers(other)).status_code == 403


def test_update_and_delete(client):
    session = register(client, "Auteur")
    quiz_id = client.post("/api/quizzes", json=quiz_payload(), headers=auth_headers(session)).json()["id"]

    updated = quiz_payload(title="Nouveau titre")
    updated["questions"] = updated["questions"][:1]
    r = client.put(f"/api/quizzes/{quiz_id}", json=updated, headers=auth_headers(session))
    assert r.status_code == 200

    detail = client.get(f"/api/quizzes/{quiz_id}", headers=auth_headers(session)).json()
    assert detail["title"] == "Nouveau titre"
    assert len(detail["questions"]) == 1

    assert client.delete(f"/api/quizzes/{quiz_id}", headers=auth_headers(session)).status_code == 204
    assert client.get(f"/api/quizzes/{quiz_id}", headers=auth_headers(session)).status_code == 404


def test_update_requires_owner(client):
    owner = register(client, "Auteur")
    other = register(client, "Pirate")
    quiz_id = client.post("/api/quizzes", json=quiz_payload(), headers=auth_headers(owner)).json()["id"]
    r = client.put(f"/api/quizzes/{quiz_id}", json=quiz_payload(), headers=auth_headers(other))
    assert r.status_code == 403


def test_validation(client):
    session = register(client, "Auteur")
    headers = auth_headers(session)
    bad_category = quiz_payload(category="Inexistante")
    assert client.post("/api/quizzes", json=bad_category, headers=headers).status_code == 422

    three_answers = quiz_payload()
    three_answers["questions"][0]["answers"] = ["a", "b", "c"]
    assert client.post("/api/quizzes", json=three_answers, headers=headers).status_code == 422

    bad_index = quiz_payload()
    bad_index["questions"][0]["correctIndex"] = 5
    assert client.post("/api/quizzes", json=bad_index, headers=headers).status_code == 422
