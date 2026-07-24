"""Import de quiz OpenQuizzDB — https://www.openquizzdb.org (licence CC BY-SA).

Les fichiers JSON proviennent du miroir GitHub Zeuh/OpenQuizzDB (même licence).
Les quiz importés appartiennent au compte « OpenQuizzDB » : l'attribution est
ainsi visible partout où l'auteur du quiz est affiché.

Usage : python -m app.import_openquizzdb [dossier]   (défaut : /app/openquizzdb)

Idempotent : un quiz déjà importé (même titre, même owner) est ignoré.
"""
import html
import json
import re
import sys
from pathlib import Path

from . import db
from .security import generate_user_code, hash_code

DEFAULT_DIR = "/app/openquizzdb"
OWNER_USERNAME = "OpenQuizzDB"

# id OpenQuizzDB -> (catégorie du site, emoji). Seuls ces fichiers sont importés.
MANIFEST: dict[int, tuple[str, str]] = {
    79: ("Culture générale", "🧠"),
    123: ("Culture générale", "💡"),
    71: ("Sciences", "⚗️"),
    10: ("Sciences", "🦈"),
    39: ("Musique", "🎺"),
    95: ("Musique", "🎤"),
    26: ("Sport", "🥇"),
    72: ("Sport", "🏀"),
    63: ("Cinéma", "🦖"),
    90: ("Cinéma", "🌌"),
    120: ("Histoire", "🏺"),
    70: ("Histoire", "⚔️"),
    22: ("Géographie", "🗼"),
    115: ("Géographie", "🌍"),
    35: ("Jeux vidéo", "🎮"),
    102: ("Jeux vidéo", "⚡"),
}

MAX_TITLE = 80
MAX_QUESTION = 300
MAX_ANSWER = 120
MAX_QUESTIONS_PER_QUIZ = 50


def _load_json(path: Path) -> dict:
    raw = path.read_text(encoding="utf-8", errors="replace")
    # Quirk connu des fichiers OpenQuizzDB : `"difficulté": 2 / 5` (JSON invalide).
    raw = re.sub(r":\s*(\d+)\s*/\s*(\d+)", r': "\1/\2"', raw)
    # Certains fichiers contiennent des caractères de contrôle bruts dans les chaînes.
    raw = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", " ", raw)
    return json.loads(raw)


def _clean(text: str) -> str:
    text = html.unescape(text)
    text = re.sub(r"<[^>]+>", "", text)  # balises HTML éparses (<I>…</I>)
    return re.sub(r"\s+", " ", text).strip()


def _extract_questions(data: dict) -> list[tuple[str, list[str], int]]:
    """Aplati les niveaux (débutant → confirmé → expert) en questions valides."""
    quizz = data.get("quizz") or {}
    if isinstance(quizz, dict) and "fr" in quizz:
        quizz = quizz["fr"]
    levels = [quizz] if isinstance(quizz, list) else [v for v in quizz.values() if isinstance(v, list)]

    out: list[tuple[str, list[str], int]] = []
    seen: set[str] = set()
    for level in levels:
        for item in level:
            if not isinstance(item, dict):
                continue
            text = _clean(str(item.get("question", "")))
            answers = [_clean(str(a)) for a in item.get("propositions", [])]
            correct = _clean(str(item.get("réponse", "")))
            if (
                not text
                or len(text) > MAX_QUESTION
                or len(answers) != 4
                or any(not a or len(a) > MAX_ANSWER for a in answers)
                or correct not in answers
                or text.lower() in seen
            ):
                continue
            seen.add(text.lower())
            out.append((text, answers, answers.index(correct)))
            if len(out) >= MAX_QUESTIONS_PER_QUIZ:
                return out
    return out


def _title(data: dict) -> str:
    theme = _clean(str(data.get("thème", "")))
    theme = re.sub(r"\s*\([^)]*\)\s*$", "", theme)  # retire le sous-titre entre parenthèses
    return theme[:MAX_TITLE]


def _get_or_create_owner(conn) -> int:
    row = conn.execute(
        "SELECT id FROM users WHERE username_norm = ?", (OWNER_USERNAME.lower(),)
    ).fetchone()
    if row:
        return row["id"]
    code = generate_user_code()
    cur = conn.execute(
        "INSERT INTO users (username, username_norm, code_hash) VALUES (?, ?, ?)",
        (OWNER_USERNAME, OWNER_USERNAME.lower(), hash_code(code)),
    )
    print(f"Compte « {OWNER_USERNAME} » créé — code : {code}")
    return cur.lastrowid


def run(directory: str) -> None:
    base = Path(directory)
    files = sorted(base.glob("openquizzdb_*.json"))
    if not files:
        print(f"Aucun fichier openquizzdb_*.json dans {base}")
        return

    db.init_db()
    conn = db.connect()
    imported = skipped = 0
    try:
        owner_id = _get_or_create_owner(conn)
        for path in files:
            oqdb_id = int(re.search(r"_(\d+)\.json$", path.name).group(1))
            if oqdb_id not in MANIFEST:
                print(f"- {path.name} : absent du manifeste, ignoré")
                continue
            category, emoji = MANIFEST[oqdb_id]
            try:
                data = _load_json(path)
            except json.JSONDecodeError as exc:
                print(f"- {path.name} : JSON illisible ({exc}), ignoré")
                continue
            title = _title(data)
            questions = _extract_questions(data)
            if not title or not questions:
                print(f"- {path.name} : titre ou questions manquants, ignoré")
                continue
            if conn.execute(
                "SELECT 1 FROM quizzes WHERE owner_id = ? AND title = ?", (owner_id, title)
            ).fetchone():
                skipped += 1
                print(f"- {title} : déjà importé")
                continue
            cur = conn.execute(
                "INSERT INTO quizzes (owner_id, title, emoji, category) VALUES (?, ?, ?, ?)",
                (owner_id, title, emoji, category),
            )
            conn.executemany(
                "INSERT INTO questions (quiz_id, position, text, answers, correct_index)"
                " VALUES (?, ?, ?, ?, ?)",
                [
                    (cur.lastrowid, i, text, json.dumps(answers, ensure_ascii=False), correct)
                    for i, (text, answers, correct) in enumerate(questions)
                ],
            )
            imported += 1
            print(f"+ {title} ({category}, {len(questions)} questions)")
        conn.commit()
        print(f"Terminé : {imported} importés, {skipped} déjà présents.")
    finally:
        conn.close()


if __name__ == "__main__":
    run(sys.argv[1] if len(sys.argv) > 1 else DEFAULT_DIR)
