import os
from pathlib import Path

DB_PATH = os.environ.get("DB_PATH", str(Path(__file__).resolve().parent.parent / "data" / "quizz.db"))
SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me")
STATIC_DIR = os.environ.get("STATIC_DIR", "")
DOCS_ENABLED = os.environ.get("DOCS_ENABLED", "1") == "1"

TOKEN_MAX_AGE = int(os.environ.get("TOKEN_MAX_AGE", 30 * 24 * 3600))  # validité des sessions : 30 jours
WS_AUTH_TIMEOUT = 5.0  # délai pour recevoir le message d'auth après ouverture de la socket

CATEGORIES = [
    "Culture générale",
    "Sciences",
    "Musique",
    "Sport",
    "Cinéma",
    "Histoire",
    "Géographie",
    "Jeux vidéo",
]

# Alphabet sans caractères ambigus (pas de O/0, I/1/L)
CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
GAME_CODE_LENGTH = 6
USER_CODE_LENGTH = 8

RANDOM_MIX_SIZE = 30           # taille du quiz virtuel « Mix aléatoire » (questions toutes catégories)
RANDOM_MIX_TITLE = "Mix aléatoire"

TIME_CHOICES = [15, 30, 60]
QUESTION_COUNT_CHOICES = [5, 10, 15, 20]
DEFAULT_QUESTION_COUNT = 10
DEFAULT_TIME_PER_QUESTION = 30

POINTS_BASE = 1000
POINTS_FLOOR = 250
REVEAL_SECONDS = 4.0
ANSWER_GRACE_SECONDS = 0.5

ROOM_FINISHED_TTL = 120        # purge des rooms finies après 2 min
ROOM_INACTIVE_TTL = 1800       # purge des rooms inactives après 30 min
PURGE_INTERVAL = 60
