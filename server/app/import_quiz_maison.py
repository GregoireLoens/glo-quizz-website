"""Import des quiz maison — fichiers JSON au format OpenTDB (`{"results": [...]}`).

Chaque entrée porte une `category` de la forme « Grand thème : Sous-thème » qui sert
de clé dans le MANIFEST ci-dessous : c'est lui, et non le fichier, qui décide de la
catégorie du site, du titre et de l'emoji du quiz produit. Deux clés sources qui
pointent vers le même titre fusionnent dans un seul quiz (cas des séries qui n'ont
qu'une poignée de questions chacune).

Les quiz importés appartiennent au compte « Midi Quizz » : contenu maison, à ne pas
confondre avec le corpus OpenQuizzDB (CC BY-SA) importé par `import_openquizzdb.py`.

Usage : python -m app.import_quiz_maison [dossier]   (défaut : /app/quiz_maison)

Idempotent : un quiz déjà importé (même titre, même owner) est ignoré.
"""
import html
import json
import random
import re
import sys
from pathlib import Path

from . import db
from .security import generate_user_code, hash_code

DEFAULT_DIR = "/app/quiz_maison"
OWNER_USERNAME = "Midi Quizz"

# category du JSON -> (catégorie du site, titre du quiz, emoji).
# Plusieurs sources partageant un même titre sont fusionnées dans un seul quiz.
MANIFEST: dict[str, tuple[str, str, str]] = {
    # Histoire — Japon
    "Histoire : Japon (Antiquité & période Heian)": ("Histoire", "Japon antique et période Heian", "⛩️"),
    "Histoire : Japon (Samouraïs & shoguns)": ("Histoire", "Samouraïs et shoguns", "⚔️"),
    "Histoire : Japon (Période Edo & unification)": ("Histoire", "Japon : Edo et l'unification", "🏯"),
    "Histoire : Japon (Ère Meiji à nos jours)": ("Histoire", "Japon : de Meiji à nos jours", "🎌"),
    # Histoire — rois de France
    "Histoire : Rois de France (Mérovingiens & Carolingiens)": ("Histoire", "Rois de France : Mérovingiens et Carolingiens", "🗝️"),
    "Histoire : Rois de France (Capétiens directs)": ("Histoire", "Rois de France : les Capétiens directs", "🏰"),
    "Histoire : Rois de France (Valois)": ("Histoire", "Rois de France : les Valois", "⚜️"),
    "Histoire : Rois de France (Bourbons)": ("Histoire", "Rois de France : les Bourbons", "👑"),
    "Histoire : Rois de France (Versailles & Roi-Soleil)": ("Histoire", "Versailles et le Roi-Soleil", "🌞"),
    "Histoire : Rois de France (Fin de la monarchie)": ("Histoire", "La fin de la monarchie", "⚖️"),
    # Histoire — Moyen Âge
    "Histoire : Moyen Âge (Société féodale)": ("Histoire", "La société féodale", "🛡️"),
    "Histoire : Moyen Âge (Croisades)": ("Histoire", "Les croisades", "✝️"),
    "Histoire : Moyen Âge (Guerre de Cent Ans)": ("Histoire", "La guerre de Cent Ans", "🏹"),
    "Histoire : Moyen Âge (Europe médiévale)": ("Histoire", "L'Europe médiévale", "🗺️"),
    "Histoire : Moyen Âge (Peste noire & religion)": ("Histoire", "Peste noire et religion", "🕯️"),
    "Histoire : Moyen Âge (Architecture gothique)": ("Histoire", "L'architecture gothique", "⛪"),
    # Manga & Anime
    "Manga & Anime : Dragon Ball": ("Manga & Anime", "Dragon Ball", "🐉"),
    "Manga & Anime : Naruto": ("Manga & Anime", "Naruto", "🍥"),
    "Manga & Anime : One Piece": ("Manga & Anime", "One Piece", "🏴‍☠️"),
    "Manga & Anime : Studio Ghibli": ("Manga & Anime", "Studio Ghibli", "🍃"),
    "Manga & Anime : Culture générale": ("Manga & Anime", "Manga et anime : culture générale", "📚"),
    # Cinq séries à 8-9 questions chacune : fusionnées, sinon le quiz n'est jouable
    # qu'en partie à 5 questions (voir config.QUESTION_COUNT_CHOICES).
    "Manga & Anime : L'Attaque des Titans": ("Manga & Anime", "Shōnen modernes", "🔥"),
    "Manga & Anime : Death Note": ("Manga & Anime", "Shōnen modernes", "🔥"),
    "Manga & Anime : My Hero Academia": ("Manga & Anime", "Shōnen modernes", "🔥"),
    "Manga & Anime : Demon Slayer": ("Manga & Anime", "Shōnen modernes", "🔥"),
    "Manga & Anime : Fullmetal Alchemist": ("Manga & Anime", "Shōnen modernes", "🔥"),
    # Jeux vidéo
    "Jeux Vidéo : Histoire & Culture générale": ("Jeux vidéo", "Jeux vidéo : culture générale", "🎮"),
    "Jeux Vidéo : Rétrogaming & Arcade": ("Jeux vidéo", "Rétrogaming et arcade", "👾"),
    "Jeux Vidéo : Nintendo (Mario & Kirby)": ("Jeux vidéo", "Nintendo : Mario, Kirby et Metroid", "🍄"),
    "Jeux Vidéo : Metroid": ("Jeux vidéo", "Nintendo : Mario, Kirby et Metroid", "🍄"),
    "Jeux Vidéo : The Legend of Zelda": ("Jeux vidéo", "The Legend of Zelda", "🗡️"),
    # Complète le quiz Pokémon d'OpenQuizzDB au lieu d'en créer un deuxième (voir MERGE_INTO).
    "Jeux Vidéo : Pokémon (jeux)": ("Jeux vidéo", "Pokemon", "⚡"),
    "Jeux Vidéo : PlayStation": ("Jeux vidéo", "PlayStation", "🕹️"),
    "Jeux Vidéo : Xbox & FPS": ("Jeux vidéo", "Xbox et FPS", "🎯"),
    "Jeux Vidéo : RPG Occidentaux": ("Jeux vidéo", "RPG occidentaux", "🧙"),
    "Jeux Vidéo : RPG Japonais & Souls-like": ("Jeux vidéo", "RPG japonais et Souls-like", "🔮"),
    "Jeux Vidéo : Plateforme, Aventure & Indé": ("Jeux vidéo", "Plateforme, aventure et indé", "🧗"),
    "Jeux Vidéo : Sport, Course & Simulation": ("Jeux vidéo", "Sport, course et simulation", "🏎️"),
    "Jeux Vidéo : MMORPG & Multijoueur en Ligne": ("Jeux vidéo", "MMORPG et jeux en ligne", "🌐"),
    "Jeux Vidéo : Esport & Compétition": ("Jeux vidéo", "Esport et compétition", "🏆"),
}

# Titres du manifeste qui complètent un quiz déjà importé par un autre corpus plutôt que
# d'en créer un doublon : titre -> owner du quiz cible. Seules les questions absentes sont
# ajoutées (comparaison sur l'énoncé), donc l'import reste idempotent. Si le quiz cible
# n'existe pas encore (import maison lancé avant l'autre corpus), le quiz est créé
# normalement sous « Midi Quizz » — relancer l'autre import ne le dédoublonnera pas.
MERGE_INTO: dict[str, str] = {
    "Pokemon": "OpenQuizzDB",
}

# Limites alignées sur schemas.QuizIn / QuestionIn — un quiz importé doit rester
# éditable depuis le site sans être rejeté par l'API.
MAX_TITLE = 80
MAX_QUESTION = 300
MAX_ANSWER = 120
MAX_QUESTIONS_PER_QUIZ = 50

DIFFICULTY_ORDER = {"easy": 0, "medium": 1, "hard": 2}


def _clean(text: str) -> str:
    text = html.unescape(text)
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"\s+", " ", text).strip()


def _shuffled(question: str, correct: str, incorrect: list[str]) -> tuple[list[str], int]:
    """Mélange les 4 réponses de façon déterministe (graine = énoncé).

    Sans graine fixe, deux imports du même fichier produiraient des ordres différents ;
    avec elle, la bonne réponse n'est ni toujours en tête ni à une position devinable.
    """
    answers = [correct, *incorrect]
    random.Random(question).shuffle(answers)
    return answers, answers.index(correct)


def _extract(results: list, source: str) -> tuple[dict[str, list], list[str]]:
    """Regroupe les questions valides par titre de quiz (ordre du MANIFEST)."""
    groups: dict[str, list[tuple[int, str, list[str], int]]] = {}
    unknown: set[str] = set()
    seen: set[str] = set()

    for item in results:
        if not isinstance(item, dict):
            continue
        entry = MANIFEST.get(str(item.get("category", "")))
        if entry is None:
            unknown.add(str(item.get("category", "")))
            continue
        _, title, _ = entry

        text = _clean(str(item.get("question", "")))
        correct = _clean(str(item.get("correct_answer", "")))
        incorrect = [_clean(str(a)) for a in item.get("incorrect_answers", [])]
        answers = [correct, *incorrect]
        if (
            not text
            or len(text) > MAX_QUESTION
            or len(answers) != 4
            or len(set(answers)) != 4
            or any(not a or len(a) > MAX_ANSWER for a in answers)
            or text.lower() in seen
        ):
            print(f"  ! question ignorée ({source}) : {text[:60] or '<vide>'}")
            continue
        seen.add(text.lower())

        rank = DIFFICULTY_ORDER.get(str(item.get("difficulty", "")), len(DIFFICULTY_ORDER))
        groups.setdefault(title, []).append((rank, text, *_shuffled(text, correct, incorrect)))

    # Ordre des quiz : celui du MANIFEST. Ordre des questions : facile -> difficile,
    # stable sur l'ordre du fichier à difficulté égale.
    order = list(dict.fromkeys(title for _, title, _ in MANIFEST.values()))
    ordered = {}
    for title in order:
        if title not in groups:
            continue
        questions = sorted(groups[title], key=lambda q: q[0])
        if len(questions) > MAX_QUESTIONS_PER_QUIZ:
            print(f"  ! {title} : {len(questions) - MAX_QUESTIONS_PER_QUIZ} question(s) coupée(s)"
                  f" (plafond {MAX_QUESTIONS_PER_QUIZ}, les plus difficiles)")
        ordered[title] = questions[:MAX_QUESTIONS_PER_QUIZ]
    return ordered, sorted(unknown)


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


def _meta(title: str) -> tuple[str, str]:
    """Catégorie et emoji du quiz, depuis la première entrée du MANIFEST qui le porte."""
    return next((cat, emoji) for cat, t, emoji in MANIFEST.values() if t == title)


def _merge_target(conn, title: str) -> int | None:
    """id du quiz d'un autre corpus à compléter, s'il existe déjà."""
    owner = MERGE_INTO.get(title)
    if owner is None:
        return None
    row = conn.execute(
        "SELECT q.id FROM quizzes q JOIN users u ON u.id = q.owner_id"
        " WHERE q.title = ? AND u.username_norm = ?",
        (title, owner.lower()),
    ).fetchone()
    return row["id"] if row else None


def _append(conn, quiz_id: int, questions: list) -> tuple[int, int]:
    """Ajoute à la suite les questions absentes du quiz. Renvoie (ajoutées, refusées)."""
    rows = conn.execute(
        "SELECT position, text FROM questions WHERE quiz_id = ?", (quiz_id,)
    ).fetchall()
    seen = {r["text"].lower() for r in rows}
    start = max((r["position"] for r in rows), default=-1) + 1
    fresh = [q for q in questions if q[1].lower() not in seen]
    room = max(MAX_QUESTIONS_PER_QUIZ - len(rows), 0)
    conn.executemany(
        "INSERT INTO questions (quiz_id, position, text, answers, correct_index)"
        " VALUES (?, ?, ?, ?, ?)",
        [
            (quiz_id, start + i, text, json.dumps(answers, ensure_ascii=False), correct)
            for i, (_, text, answers, correct) in enumerate(fresh[:room])
        ],
    )
    return min(len(fresh), room), max(len(fresh) - room, 0)


def run(directory: str) -> None:
    base = Path(directory)
    files = sorted(base.glob("*.json"))
    if not files:
        print(f"Aucun fichier .json dans {base}")
        return

    db.init_db()
    conn = db.connect()
    imported = skipped = 0
    try:
        owner_id = _get_or_create_owner(conn)
        for path in files:
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError) as exc:
                print(f"- {path.name} : illisible ({exc}), ignoré")
                continue
            results = data.get("results") if isinstance(data, dict) else data
            if not isinstance(results, list):
                print(f"- {path.name} : pas de liste `results`, ignoré")
                continue

            groups, unknown = _extract(results, path.name)
            for cat in unknown:
                print(f"- {path.name} : catégorie « {cat} » absente du manifeste, ignorée")

            for title, questions in groups.items():
                category, emoji = _meta(title)
                merge_id = _merge_target(conn, title)
                if merge_id is not None:
                    added, dropped = _append(conn, merge_id, questions)
                    skipped += 1
                    note = f", {dropped} au-delà du plafond" if dropped else ""
                    print(f"~ {title} : {added} question(s) ajoutée(s) au quiz existant{note}")
                    continue
                existing = conn.execute(
                    "SELECT id FROM quizzes WHERE owner_id = ? AND title = ?", (owner_id, title)
                ).fetchone()
                if existing:
                    conn.execute(
                        "UPDATE quizzes SET category = ?, emoji = ? WHERE id = ?",
                        (category, emoji, existing["id"]),
                    )
                    skipped += 1
                    print(f"- {title} : déjà importé (catégorie/emoji alignés sur le manifeste)")
                    continue
                cur = conn.execute(
                    "INSERT INTO quizzes (owner_id, title, emoji, category) VALUES (?, ?, ?, ?)",
                    (owner_id, title[:MAX_TITLE], emoji, category),
                )
                conn.executemany(
                    "INSERT INTO questions (quiz_id, position, text, answers, correct_index)"
                    " VALUES (?, ?, ?, ?, ?)",
                    [
                        (cur.lastrowid, i, text, json.dumps(answers, ensure_ascii=False), correct)
                        for i, (_, text, answers, correct) in enumerate(questions)
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
