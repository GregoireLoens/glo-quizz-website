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
    "Séries TV",
    "Histoire",
    "Géographie",
    "Jeux vidéo",
    "Littérature",
    "Gastronomie",
    "Nature",
    "People",
    "High-tech",
]

# Alphabet sans caractères ambigus (pas de O/0, I/1/L)
CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
GAME_CODE_LENGTH = 6
USER_CODE_LENGTH = 8

RANDOM_MIX_SIZE = 30           # taille du quiz virtuel « Mix aléatoire » (questions toutes catégories)
RANDOM_MIX_TITLE = "Mix aléatoire"

SURVIVAL_LIVES = 3             # mode Survie : vies au départ
SURVIVAL_BATCH = 30            # questions aléatoires chargées par lot (rechargé tant qu'il reste des vivants)
SURVIVAL_TITLE = "Mode Survie"

TIME_CHOICES = [15, 30, 60]
QUESTION_COUNT_CHOICES = [5, 10, 15, 20]
DEFAULT_QUESTION_COUNT = 10
DEFAULT_TIME_PER_QUESTION = 30

POINTS_BASE = 1000
POINTS_FLOOR = 250

# Classement Elo — alimenté par les seules parties multijoueurs (le solo ne compte pas).
# Les points restent la mécanique interne d'une partie ; l'Elo est le classement durable.
ELO_START = 1000               # rating de départ (doit rester aligné sur le DEFAULT de schema.sql)
ELO_K = 32                     # amplitude d'ajustement par partie une fois le rating calibré
ELO_K_PROVISIONAL = 48         # amplitude renforcée pendant les premières parties
ELO_PROVISIONAL_GAMES = 10     # parties classées avant de passer au K normal
ELO_FLOOR = 100                # plancher : un rating ne descend jamais en dessous
REVEAL_SECONDS = 4.0
ANSWER_GRACE_SECONDS = 0.5

ROOM_FINISHED_TTL = 120        # purge des rooms finies après 2 min
ROOM_INACTIVE_TTL = 1800       # purge des rooms inactives après 30 min
PURGE_INTERVAL = 60
