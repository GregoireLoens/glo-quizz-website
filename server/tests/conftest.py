import glob
import os
import tempfile

# Toujours une base jetable pour les tests — surtout pas celle du conteneur (DB_PATH env).
os.environ["DB_PATH"] = os.path.join(tempfile.mkdtemp(prefix="midiquizz-test-"), "test.db")

import pytest
from fastapi.testclient import TestClient

from app import config
from app.main import app


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
