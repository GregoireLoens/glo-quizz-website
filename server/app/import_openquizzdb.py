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

from . import avatar, db
from .security import generate_user_code, hash_code

DEFAULT_DIR = "/app/openquizzdb"
OWNER_USERNAME = "OpenQuizzDB"

# id OpenQuizzDB -> (catégorie du site, emoji). Seuls ces fichiers sont importés.
# Couverture : tout le corpus importable du miroir, sauf les thèmes industrie X
# (106, 110, 162, 235), le doublon de titre « Comédies françaises » (250) et les
# quiz people, catégorie retirée du site le 20/08/2026 (décision glo).
MANIFEST: dict[int, tuple[str, str]] = {
    # Culture générale
    1: ("Culture générale", "🏷️"),      # Marques, logos et slogans
    33: ("Culture générale", "🐉"),      # Dragons hier et aujourd'hui
    44: ("Culture générale", "🚗"),      # Automobile
    58: ("Culture générale", "💇"),      # Les cheveux
    68: ("Culture générale", "🌉"),      # Ponts tout en longueur
    69: ("Culture générale", "🗿"),      # Sculpture
    77: ("Culture générale", "🌈"),      # Haut en couleur
    79: ("Culture générale", "🧠"),      # Culture générale
    86: ("Culture générale", "🖼️"),      # Musée du Louvre
    93: ("Culture générale", "🧚"),      # Personnages imaginaires
    101: ("Culture générale", "👩‍👧"),     # Les mamans
    111: ("Culture générale", "🌐"),     # Culture internationale
    113: ("Culture générale", "🎩"),     # Culture et personnalités
    119: ("Culture générale", "🔢"),     # Trouvez le nombre
    122: ("Culture générale", "🪅"),     # Folklore
    123: ("Culture générale", "💡"),     # Inventions
    125: ("Culture générale", "🔧"),     # Objets et instruments
    129: ("Culture générale", "🎨"),     # Couleurs
    132: ("Culture générale", "🚆"),     # Moyens de transport
    142: ("Culture générale", "😇"),     # Saints
    154: ("Culture générale", "🧩"),     # Culture générale 2
    155: ("Culture générale", "🎲"),     # Culture générale 3
    157: ("Culture générale", "🏎️"),     # Constructeurs automobiles
    161: ("Culture générale", "🔍"),     # Culture générale 4
    166: ("Culture générale", "👗"),     # Victime de la mode
    168: ("Culture générale", "💄"),     # Maquillage
    172: ("Culture générale", "📣"),     # Faits de société
    200: ("Culture générale", "🎯"),     # Incollable
    202: ("Culture générale", "🫖"),     # Céramique et poterie
    219: ("Culture générale", "🗨️"),     # Expressions connues
    226: ("Culture générale", "🔤"),     # Prénoms célèbres
    228: ("Culture générale", "🛹"),     # Culture jeune
    246: ("Culture générale", "🔮"),     # Mystères du monde
    249: ("Culture générale", "🧺"),     # Culture en vrac 3
    254: ("Culture générale", "🎒"),     # Culture en vrac 4
    259: ("Culture générale", "🎪"),     # Culture en vrac 5
    265: ("Culture générale", "👨‍🦳"),     # Albert célèbres
    266: ("Culture générale", "🗃️"),     # Culture en vrac 6
    294: ("Culture générale", "🎅"),     # Fête de Saint-Nicolas
    382: ("Culture générale", "📆"),     # C'était en 2019
    405: ("Culture générale", "👺"),     # Folklore japonais
    457: ("Culture générale", "✏️"),      # Orthoquizz
    543: ("Culture générale", "🗓️"),     # Rétrospective 2021
    550: ("Culture générale", "🔠"),     # Mots croisés
    555: ("Culture générale", "🔡"),     # Mots croisés 2
    # Sciences
    71: ("Sciences", "⚗️"),              # Chimie
    97: ("Sciences", "📏"),              # Unités de mesure
    126: ("Sciences", "🌡️"),             # Réchauffement climatique
    151: ("Sciences", "🔌"),             # Nikola Tesla
    164: ("Sciences", "🩺"),             # Santé et bien-être
    206: ("Sciences", "💊"),             # Magnésium
    393: ("Sciences", "🦠"),             # COVID-19
    541: ("Sciences", "😷"),             # La menace Omicron
    # Musique
    38: ("Musique", "🎹"),               # La new wave
    39: ("Musique", "🎺"),               # Instruments de musique
    56: ("Musique", "🥁"),               # Le reggae
    62: ("Musique", "🎛️"),               # Jean Michel Jarre
    85: ("Musique", "🎷"),               # Acid jazz
    95: ("Musique", "🎤"),               # Chanteurs internationaux
    103: ("Musique", "🎧"),              # Depeche Mode
    136: ("Musique", "📼"),              # Groupes eighties
    159: ("Musique", "🎙️"),              # Variété française
    182: ("Musique", "🎸"),              # Johnny Hallyday
    236: ("Musique", "🪩"),              # Tubes disco
    238: ("Musique", "🎀"),              # Britney Spears
    269: ("Musique", "🔊"),              # Artistes electro
    # Sport
    26: ("Sport", "🥇"),                 # Jeux olympiques
    60: ("Sport", "🤾"),                 # Sports collectifs
    72: ("Sport", "🏀"),                 # NBA : joueurs et franchises
    73: ("Sport", "⛹️"),                 # Basket européen
    84: ("Sport", "⚽"),                 # FC Barcelone
    108: ("Sport", "🏅"),                # Rio 2016
    138: ("Sport", "🏋️"),                # Haltérophilie
    143: ("Sport", "🎾"),                # Maria Sharapova
    144: ("Sport", "🥊"),                # Boxe
    150: ("Sport", "🏟️"),                # Foot dantan
    153: ("Sport", "🤸"),                # Sports pour tous
    176: ("Sport", "🚴"),                # Ironman
    191: ("Sport", "🧗"),                # Escalade
    211: ("Sport", "⛷️"),                # PyeongChang 2018
    212: ("Sport", "⛳"),                # Golf
    245: ("Sport", "🏆"),                # Russia 2018
    262: ("Sport", "🎾"),                # John McEnroe
    264: ("Sport", "⚽"),                # Foot 2010-2020
    268: ("Sport", "🥅"),                # Foot 2000-2010
    272: ("Sport", "👟"),                # Foot 1990-2000
    383: ("Sport", "🎾"),                # Sur le court
    # Cinéma
    2: ("Cinéma", "👑"),                 # Princesses Disney
    4: ("Cinéma", "🦸"),                 # Héros Marvel
    7: ("Cinéma", "💋"),                 # Marilyn Monroe
    15: ("Cinéma", "💕"),                # Couples mythiques du cinéma
    16: ("Cinéma", "🎬"),                # Steven Spielberg
    34: ("Cinéma", "🤠"),                # Clint Eastwood
    43: ("Cinéma", "🌹"),                # Belles du cinéma
    46: ("Cinéma", "🕶️"),                # Bruce Willis
    47: ("Cinéma", "🛸"),                # Le Cinquième Élément
    51: ("Cinéma", "🐬"),                # Le Grand Bleu
    52: ("Cinéma", "🦁"),                # Le Roi Lion
    55: ("Cinéma", "🎭"),                # Sophie Marceau
    57: ("Cinéma", "🎥"),                # Réalisatrices françaises
    59: ("Cinéma", "🏰"),                # Les Visiteurs
    63: ("Cinéma", "🦖"),                # Jurassic Park
    81: ("Cinéma", "🏹"),                # Hunger Games
    88: ("Cinéma", "🧸"),                # Toy Story a 20 ans
    89: ("Cinéma", "🌠"),                # Héros de Star Wars
    90: ("Cinéma", "🌌"),                # Star Wars
    92: ("Cinéma", "🎞️"),                # Petits secrets du cinéma
    163: ("Cinéma", "😂"),               # Comédies françaises
    201: ("Cinéma", "🦹"),               # Super-héroïnes
    214: ("Cinéma", "🏆"),               # Cérémonie des César
    241: ("Cinéma", "👾"),               # Alien : la saga
    243: ("Cinéma", "🧔"),               # Brad Pitt au cinéma
    256: ("Cinéma", "🍿"),               # Comédies au cinéma
    257: ("Cinéma", "💎"),               # Charlize Theron
    # Séries TV
    5: ("Séries TV", "📺"),              # Séries américaines
    18: ("Séries TV", "🖖"),             # Star Trek
    29: ("Séries TV", "🎉"),             # Patrick Sébastien
    31: ("Séries TV", "👽"),             # X-Files : la série
    36: ("Séries TV", "🧪"),             # Breaking Bad
    41: ("Séries TV", "🗡️"),             # Game of Thrones
    114: ("Séries TV", "🧽"),            # Bob l'éponge
    267: ("Séries TV", "💰"),            # La Casa de Papel
    273: ("Séries TV", "🎦"),            # Virginie à l'écran
    # Histoire
    8: ("Histoire", "⚱️"),               # Toutânkhamon
    70: ("Histoire", "⚔️"),              # Guerres et batailles
    94: ("Histoire", "🦌"),              # Chambord
    98: ("Histoire", "📅"),              # Grandes dates du 20e siècle
    120: ("Histoire", "🏺"),             # Égypte ancienne
    127: ("Histoire", "🏛️"),             # Histoire politique
    133: ("Histoire", "🐺"),             # Rome
    160: ("Histoire", "⚜️"),             # Histoire de France
    183: ("Histoire", "🌞"),             # Teotihuacan
    188: ("Histoire", "🛡️"),             # Gladiateurs
    # Géographie
    14: ("Géographie", "🐚"),            # Bretagne
    22: ("Géographie", "🗼"),            # Monuments du monde
    30: ("Géographie", "🏙️"),            # Bruxelles de nos jours
    61: ("Géographie", "📸"),            # Sites touristiques
    66: ("Géographie", "🕌"),            # Istanbul
    82: ("Géographie", "🪶"),            # Peuples du monde
    100: ("Géographie", "⛵"),           # L'appel du large
    104: ("Géographie", "🍁"),           # Canada
    105: ("Géographie", "🌅"),           # Méditerranée
    109: ("Géographie", "🇮🇹"),           # Italie
    112: ("Géographie", "🌴"),           # Nice
    115: ("Géographie", "🌍"),           # Géo pour tous
    117: ("Géographie", "🏞️"),           # La Durance
    121: ("Géographie", "🇧🇪"),           # Belgique
    130: ("Géographie", "🇬🇧"),           # Royaume-Uni
    134: ("Géographie", "🌊"),           # Histoires d'eaux
    135: ("Géographie", "❄️"),           # Antarctique
    208: ("Géographie", "🧘"),           # Auroville
    221: ("Géographie", "🦆"),           # Périgord
    231: ("Géographie", "🏘️"),           # Mouscron
    247: ("Géographie", "🌳"),           # Central Park
    251: ("Géographie", "🪧"),           # Surnoms des villes
    255: ("Géographie", "⛪"),           # Mont Saint-Michel
    # Jeux vidéo
    35: ("Jeux vidéo", "🎮"),            # Jeux et consoles Nintendo
    102: ("Jeux vidéo", "⚡"),           # Pokemon
    204: ("Jeux vidéo", "🕹️"),           # PlayStation 2
    261: ("Jeux vidéo", "🧝"),           # World of Warcraft
    # Littérature
    3: ("Littérature", "🪄"),            # Harry Potter
    87: ("Littérature", "🖋️"),           # Maxime Chattam
    124: ("Littérature", "🐕"),          # Tintin
    128: ("Littérature", "🕯️"),          # Romantisme
    139: ("Littérature", "📖"),          # Citations littéraires
    140: ("Littérature", "✒️"),           # Auteurs classiques
    233: ("Littérature", "💬"),          # Citations courtes
    244: ("Littérature", "📚"),          # Fiction pour tous
    # Gastronomie
    6: ("Gastronomie", "🍺"),            # Bières belges
    9: ("Gastronomie", "🧀"),            # Fromages de France
    11: ("Gastronomie", "🍰"),           # Desserts et pâtisseries
    17: ("Gastronomie", "🍬"),           # Sucre
    19: ("Gastronomie", "🍫"),           # Chocolat
    28: ("Gastronomie", "🌿"),           # Herbes et épices
    53: ("Gastronomie", "💧"),           # Eaux minérales
    67: ("Gastronomie", "🍎"),           # Pommes
    80: ("Gastronomie", "🌮"),           # Gastronomie étrangère
    96: ("Gastronomie", "🍷"),           # Vins divins
    99: ("Gastronomie", "🧃"),           # Boissons sans alcool
    158: ("Gastronomie", "🍇"),          # Vins d'ailleurs
    181: ("Gastronomie", "☕"),          # Garçon un café
    205: ("Gastronomie", "🥤"),          # Coca-Cola Company
    207: ("Gastronomie", "🥐"),          # Déjeuner du matin
    209: ("Gastronomie", "🍸"),          # Gin
    260: ("Gastronomie", "🥔"),          # Pomme de terre
    # Nature
    10: ("Nature", "🦈"),                # Requins
    12: ("Nature", "🍒"),                # Arbres fruitiers
    48: ("Nature", "🐜"),                # Fourmis
    49: ("Nature", "🦊"),                # Animaux et habitats
    50: ("Nature", "🐱"),                # Nos amis les chats
    65: ("Nature", "🌾"),                # Faune et flore des champs
    116: ("Nature", "🐾"),               # Animaux célèbres
    145: ("Nature", "🐦"),               # Oiseaux
    199: ("Nature", "🌋"),               # Volcans en activité
    203: ("Nature", "🌲"),               # Forêts de France
    224: ("Nature", "🌵"),               # Cactus
    237: ("Nature", "🐝"),               # Abeilles du rucher
    263: ("Nature", "🎍"),               # Jardin japonais
    413: ("Nature", "🕊️"),               # Colombophilie
    # High-tech
    32: ("High-tech", "💻"),             # Logiciels et applications web
    37: ("High-tech", "🐧"),             # Linux
    45: ("High-tech", "📱"),             # Les réseaux sociaux
    223: ("High-tech", "🪙"),            # Crypto-monnaies
    232: ("High-tech", "🐡"),            # OpenBSD
    234: ("High-tech", "⌨️"),             # Franglais du net
    239: ("High-tech", "🤳"),            # Instagram
    403: ("High-tech", "🍏"),            # iPhone
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
        "INSERT INTO users (username, username_norm, code_hash, avatar_color) VALUES (?, ?, ?, ?)",
        (OWNER_USERNAME, OWNER_USERNAME.lower(), hash_code(code), avatar.default_color(OWNER_USERNAME)),
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
