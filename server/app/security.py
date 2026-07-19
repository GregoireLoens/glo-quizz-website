import secrets

import bcrypt
from itsdangerous import BadSignature, URLSafeSerializer

from . import config

_serializer = URLSafeSerializer(config.SECRET_KEY, salt="midi-quizz-session")


def generate_user_code() -> str:
    raw = "".join(secrets.choice(config.CODE_ALPHABET) for _ in range(config.USER_CODE_LENGTH))
    return f"{raw[:4]}-{raw[4:]}"


def generate_game_code() -> str:
    return "".join(secrets.choice(config.CODE_ALPHABET) for _ in range(config.GAME_CODE_LENGTH))


def normalize_code(code: str) -> str:
    return "".join(ch for ch in code.upper() if ch.isalnum())


def hash_code(code: str) -> str:
    return bcrypt.hashpw(normalize_code(code).encode(), bcrypt.gensalt()).decode()


def verify_code(code: str, code_hash: str) -> bool:
    try:
        return bcrypt.checkpw(normalize_code(code).encode(), code_hash.encode())
    except ValueError:
        return False


def create_token(user_id: int) -> str:
    return _serializer.dumps({"uid": user_id})


def parse_token(token: str) -> int | None:
    try:
        return int(_serializer.loads(token)["uid"])
    except (BadSignature, KeyError, TypeError, ValueError):
        return None
