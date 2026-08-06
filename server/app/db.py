import sqlite3
from pathlib import Path

from . import avatar, config


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
        _migrate(conn)
        conn.commit()
    finally:
        conn.close()


def _columns(conn: sqlite3.Connection, table: str) -> set[str]:
    return {row["name"] for row in conn.execute(f"PRAGMA table_info({table})")}


def _migrate(conn: sqlite3.Connection) -> None:
    """Greffe les colonnes manquantes sur une base créée avant leur introduction.

    `CREATE TABLE IF NOT EXISTS` ne touche pas à une table existante : c'est ici, et
    nulle part ailleurs, que les nouvelles colonnes arrivent. Les ratings démarrent
    tous à `ELO_START` — l'historique des parties d'avant l'Elo n'est pas rejoué.
    """
    if "elo" not in _columns(conn, "users"):
        conn.execute(f"ALTER TABLE users ADD COLUMN elo INTEGER NOT NULL DEFAULT {config.ELO_START}")
        conn.execute("ALTER TABLE users ADD COLUMN elo_games INTEGER NOT NULL DEFAULT 0")
    if "elo_delta" not in _columns(conn, "game_players"):
        conn.execute("ALTER TABLE game_players ADD COLUMN elo_before INTEGER")
        conn.execute("ALTER TABLE game_players ADD COLUMN elo_delta INTEGER")
    if "avatar_color" not in _columns(conn, "users"):
        conn.execute("ALTER TABLE users ADD COLUMN avatar_color TEXT NOT NULL DEFAULT 'citron'")
        conn.execute("ALTER TABLE users ADD COLUMN avatar_symbol TEXT")
        # Les comptes d'avant l'avatar ne restent pas tous citron : la couleur dérivée du
        # pseudo rend les salons existants lisibles dès la première ouverture.
        rows = conn.execute("SELECT id, username FROM users").fetchall()
        conn.executemany(
            "UPDATE users SET avatar_color = ? WHERE id = ?",
            [(avatar.default_color(row["username"]), row["id"]) for row in rows],
        )


def get_db():
    conn = connect()
    try:
        yield conn
    finally:
        conn.close()
