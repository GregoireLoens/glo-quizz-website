"""Seed de démo : utilisateurs, quiz et parties finies pour le classement.

Usage : python -m app.seed
"""
import json
import random

from . import db
from .security import generate_user_code, hash_code

QUIZZES = [
    {
        "title": "Capitales du monde",
        "emoji": "🌍",
        "category": "Géographie",
        "owner": "Sami",
        "questions": [
            ("Quelle est la capitale de l'Australie ?", ["Sydney", "Canberra", "Melbourne", "Perth"], 1),
            ("Quelle est la capitale du Canada ?", ["Toronto", "Vancouver", "Ottawa", "Montréal"], 2),
            ("Quelle est la capitale du Brésil ?", ["Rio de Janeiro", "São Paulo", "Brasília", "Salvador"], 2),
            ("Quelle est la capitale de la Suisse ?", ["Genève", "Zurich", "Lausanne", "Berne"], 3),
            ("Quelle est la capitale de la Turquie ?", ["Istanbul", "Ankara", "Izmir", "Antalya"], 1),
            ("Quelle est la capitale du Maroc ?", ["Casablanca", "Marrakech", "Rabat", "Fès"], 2),
            ("Quelle est la capitale du Japon ?", ["Osaka", "Kyoto", "Tokyo", "Nagoya"], 2),
            ("Quelle est la capitale administrative de l'Afrique du Sud ?", ["Le Cap", "Pretoria", "Johannesburg", "Durban"], 1),
            ("Quelle est la capitale de l'Argentine ?", ["Santiago", "Lima", "Buenos Aires", "Montevideo"], 2),
            ("Quelle est la capitale de l'Égypte ?", ["Alexandrie", "Le Caire", "Gizeh", "Louxor"], 1),
            ("Quelle est la capitale de la Nouvelle-Zélande ?", ["Auckland", "Christchurch", "Wellington", "Hamilton"], 2),
            ("Quelle est la capitale de la Norvège ?", ["Stockholm", "Copenhague", "Helsinki", "Oslo"], 3),
        ],
    },
    {
        "title": "Sciences au quotidien",
        "emoji": "🔬",
        "category": "Sciences",
        "owner": "Léa",
        "questions": [
            ("Quel gaz les plantes absorbent-elles pour la photosynthèse ?", ["Oxygène", "Dioxyde de carbone", "Azote", "Hydrogène"], 1),
            ("Quelle est la vitesse de la lumière dans le vide ?", ["300 000 km/s", "150 000 km/s", "1 000 km/s", "3 000 000 km/s"], 0),
            ("Quel organe produit l'insuline ?", ["Le foie", "Le pancréas", "Les reins", "La rate"], 1),
            ("Combien d'os compte le squelette humain adulte ?", ["186", "206", "226", "246"], 1),
            ("Quelle planète est la plus proche du Soleil ?", ["Vénus", "Mars", "Mercure", "La Terre"], 2),
            ("À quelle température l'eau bout-elle au niveau de la mer ?", ["90 °C", "100 °C", "110 °C", "120 °C"], 1),
            ("Quel est le symbole chimique du fer ?", ["F", "Fr", "Fe", "Ir"], 2),
            ("Quelle particule porte une charge négative ?", ["Le proton", "Le neutron", "L'électron", "Le photon"], 2),
            ("Quel métal est liquide à température ambiante ?", ["Le plomb", "Le mercure", "L'étain", "Le zinc"], 1),
            ("Combien de temps met la lumière du Soleil pour nous parvenir ?", ["8 secondes", "8 minutes", "8 heures", "8 jours"], 1),
        ],
    },
    {
        "title": "Classiques du cinéma",
        "emoji": "🎬",
        "category": "Cinéma",
        "owner": "Marco",
        "questions": [
            ("Qui a réalisé « Pulp Fiction » ?", ["Martin Scorsese", "Quentin Tarantino", "Steven Spielberg", "David Fincher"], 1),
            ("Dans quel film entend-on « Je suis ton père » ?", ["Star Trek", "L'Empire contre-attaque", "Le Retour du Jedi", "Un nouvel espoir"], 1),
            ("Quel film de 1997 raconte le naufrage d'un célèbre paquebot ?", ["Titanic", "Armageddon", "Poséidon", "En pleine tempête"], 0),
            ("Qui incarne Forrest Gump ?", ["Brad Pitt", "Tom Hanks", "Kevin Costner", "Robin Williams"], 1),
            ("Dans « Matrix », quelle pilule Neo choisit-il ?", ["La bleue", "La rouge", "La verte", "La jaune"], 1),
            ("Qui a réalisé « Les Dents de la mer » et « E.T. » ?", ["George Lucas", "Steven Spielberg", "James Cameron", "Ridley Scott"], 1),
            ("Quel personnage du « Parrain » est joué par Al Pacino ?", ["Vito", "Sonny", "Michael", "Fredo"], 2),
            ("Dans quel film Jack Nicholson devient-il fou dans un hôtel isolé ?", ["Vol au-dessus d'un nid de coucou", "Shining", "Batman", "Les Infiltrés"], 1),
            ("Quel film Pixar met en scène un rat cuisinier ?", ["Là-haut", "Ratatouille", "Wall-E", "Toy Story"], 1),
            ("Qui incarne le Joker dans « The Dark Knight » ?", ["Jared Leto", "Joaquin Phoenix", "Heath Ledger", "Jack Nicholson"], 2),
        ],
    },
    {
        "title": "Légendes de la musique",
        "emoji": "🎵",
        "category": "Musique",
        "owner": "Élise",
        "questions": [
            ("Quel groupe a sorti l'album « Abbey Road » ?", ["The Rolling Stones", "The Beatles", "The Who", "Pink Floyd"], 1),
            ("Qui est surnommé le « King of Pop » ?", ["Prince", "Michael Jackson", "Elvis Presley", "Stevie Wonder"], 1),
            ("Quel instrument Jimi Hendrix jouait-il ?", ["La basse", "La batterie", "La guitare", "Le piano"], 2),
            ("Quel duo français a signé « Get Lucky » ?", ["Justice", "Air", "Daft Punk", "Phoenix"], 2),
            ("Combien de cordes possède un violon ?", ["4", "5", "6", "7"], 0),
            ("Quel groupe interprète « Bohemian Rhapsody » ?", ["Led Zeppelin", "Queen", "David Bowie", "Elton John"], 1),
            ("De quel pays vient le groupe ABBA ?", ["Norvège", "Danemark", "Suède", "Finlande"], 2),
            ("Quel compositeur est devenu sourd à la fin de sa vie ?", ["Mozart", "Beethoven", "Bach", "Chopin"], 1),
        ],
    },
]

NPC_USERS = ["Élise", "Yanis", "Sofia", "Marco", "Nina", "Sami", "Léa", "Enzo", "Marc", "Camille"]


def run() -> None:
    db.init_db()
    conn = db.connect()
    try:
        if conn.execute("SELECT COUNT(*) AS n FROM users").fetchone()["n"] > 0:
            print("Base déjà peuplée — seed ignoré.")
            return

        user_ids: dict[str, int] = {}
        for name in NPC_USERS:
            cur = conn.execute(
                "INSERT INTO users (username, username_norm, code_hash) VALUES (?, ?, ?)",
                (name, name.lower(), hash_code(generate_user_code())),
            )
            user_ids[name] = cur.lastrowid

        demo_code = generate_user_code()
        conn.execute(
            "INSERT INTO users (username, username_norm, code_hash) VALUES (?, ?, ?)",
            ("Demo", "demo", hash_code(demo_code)),
        )

        quiz_ids: list[int] = []
        for quiz in QUIZZES:
            cur = conn.execute(
                "INSERT INTO quizzes (owner_id, title, emoji, category, play_count) VALUES (?, ?, ?, ?, ?)",
                (user_ids[quiz["owner"]], quiz["title"], quiz["emoji"], quiz["category"], 0),
            )
            quiz_id = cur.lastrowid
            quiz_ids.append(quiz_id)
            conn.executemany(
                "INSERT INTO questions (quiz_id, position, text, answers, correct_index) VALUES (?, ?, ?, ?, ?)",
                [
                    (quiz_id, i, text, json.dumps(answers, ensure_ascii=False), correct)
                    for i, (text, answers, correct) in enumerate(quiz["questions"])
                ],
            )

        # Parties finies factices, étalées dans le temps pour tester les filtres du classement.
        rng = random.Random(42)
        days_offsets = [1, 2, 3, 4, 6, 8, 12, 16, 22, 28, 40, 55, 70, 90, 2, 5, 9, 25, 3, 1]
        for i, days in enumerate(days_offsets):
            participants = rng.sample(list(user_ids.items()), k=rng.randint(3, 5))
            quiz_id = rng.choice(quiz_ids)
            host_id = participants[0][1]
            cur = conn.execute(
                "INSERT INTO games (code, quiz_id, host_id, question_count, time_per_question,"
                " status, finished_at) VALUES (?, ?, ?, ?, ?, 'finished', datetime('now', ?))",
                (f"SEED{i:02d}", quiz_id, host_id, 10, 30, f"-{days} days"),
            )
            game_id = cur.lastrowid
            scored = []
            for _, uid in participants:
                correct = rng.randint(3, 10)
                score = sum(rng.randint(250, 1000) for _ in range(correct))
                scored.append((uid, score, correct))
            scored.sort(key=lambda s: -s[1])
            conn.executemany(
                "INSERT INTO game_players (game_id, user_id, score, correct_count, rank) VALUES (?, ?, ?, ?, ?)",
                [(game_id, uid, score, correct, rank + 1) for rank, (uid, score, correct) in enumerate(scored)],
            )
            conn.execute("UPDATE quizzes SET play_count = play_count + 1 WHERE id = ?", (quiz_id,))

        conn.commit()
        print("Seed terminé :")
        print(f"  - {len(NPC_USERS) + 1} utilisateurs, {len(QUIZZES)} quiz, {len(days_offsets)} parties finies")
        print(f"  - Compte de démo : pseudo « Demo », code {demo_code}")
    finally:
        conn.close()


if __name__ == "__main__":
    run()
