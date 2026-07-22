import sqlite3
from pathlib import Path

from . import config


def connect() -> sqlite3.Connection:
    # check_same_thread=False : une connexion vit le temps d'une requête mais le
    # threadpool anyio peut exécuter ouverture, endpoint et fermeture sur des
    # threads différents (surtout à travers BaseHTTPMiddleware). Usage toujours
    # séquentiel → sans danger.
    conn = sqlite3.connect(config.DB_PATH, timeout=10, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    Path(config.DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    conn = connect()
    try:
        conn.execute("PRAGMA journal_mode = WAL")
        schema = (Path(__file__).parent / "schema.sql").read_text(encoding="utf-8")
        conn.executescript(schema)
        conn.commit()
    finally:
        conn.close()


def get_db():
    conn = connect()
    try:
        yield conn
    finally:
        conn.close()
