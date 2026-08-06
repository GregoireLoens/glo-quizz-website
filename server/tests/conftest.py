import glob
import json
import os
import tempfile

# Toujours une base jetable pour les tests — surtout pas celle du conteneur (DB_PATH env).
os.environ["DB_PATH"] = os.path.join(tempfile.mkdtemp(prefix="midiquizz-test-"), "test.db")

import pytest
from fastapi.testclient import TestClient

from app import config, db
from app.main import app

DEFAULT_QUESTIONS = [
    {"text": "1 + 1 ?", "answers": ["1", "2", "3", "4"], "correctIndex": 1},
    {"text": "2 + 2 ?", "answers": ["2", "3", "4", "5"], "correctIndex": 2},
]


@pytest.fixture()
def client():
    for f in glob.glob(config.DB_PATH + "*"):
        os.remove(f)
    with TestClient(app) as c:
        yield c


def register(client: TestClient, username: str) -> dict:
    r = client.post("/api/auth/register", json={"username": username})
    assert r.status_code == 201, r.text
    return r.json()


def auth_headers(session: dict) -> dict:
    return {"Authorization": f"Bearer {session['token']}"}


def create_quiz(
    session: dict,
    title: str = "Quiz test",
    category: str = "Sciences",
    emoji: str = "🎯",
    questions: list[dict] | None = None,
) -> int:
    """Ajoute un quiz au catalogue, en écrivant directement en base.

    Le site n'expose plus de création de quiz : les scripts d'import sont le seul
    chemin d'écriture (`app.import_openquizzdb`, `app.import_quiz_maison`). Les tests
    peuplent donc la base de la même façon, plutôt que par une API qui n'existe plus.
    """
    conn = db.connect()
    try:
        cur = conn.execute(
            "INSERT INTO quizzes (owner_id, title, emoji, category) VALUES (?, ?, ?, ?)",
            (session["user"]["id"], title, emoji, category),
        )
        quiz_id = cur.lastrowid
        conn.executemany(
            "INSERT INTO questions (quiz_id, position, text, answers, correct_index) VALUES (?, ?, ?, ?, ?)",
            [
                (quiz_id, i, q["text"], json.dumps(q["answers"], ensure_ascii=False), q["correctIndex"])
                for i, q in enumerate(questions if questions is not None else DEFAULT_QUESTIONS)
            ],
        )
        conn.commit()
    finally:
        conn.close()
    return quiz_id
