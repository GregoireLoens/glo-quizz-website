import re

from pydantic import BaseModel, Field, field_validator

from . import avatar

USERNAME_RE = re.compile(r"^[\w\-]{3,20}$", re.UNICODE)


class RegisterIn(BaseModel):
    username: str

    @field_validator("username")
    @classmethod
    def check_username(cls, v: str) -> str:
        v = v.strip()
        if not USERNAME_RE.match(v):
            raise ValueError("3 à 20 caractères : lettres, chiffres, tirets ou underscores.")
        return v


class LoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=40)
    code: str = Field(min_length=1, max_length=20)


class AvatarIn(BaseModel):
    """Choix d'avatar. `symbol` à None = le joueur garde ses initiales."""

    color: str
    symbol: str | None = None

    @field_validator("color")
    @classmethod
    def check_color(cls, v: str) -> str:
        if v not in avatar.COLORS:
            raise ValueError(f"Couleur inconnue : {', '.join(avatar.COLORS)}.")
        return v

    @field_validator("symbol")
    @classmethod
    def check_symbol(cls, v: str | None) -> str | None:
        if v is not None and v not in avatar.SYMBOLS:
            raise ValueError(f"Symbole inconnu : {', '.join(avatar.SYMBOLS)}.")
        return v


# Pas de schéma d'entrée pour les quiz : aucun quiz n'entre plus par l'API. Les
# limites de format (titre, énoncé, 4 réponses, 50 questions) sont portées par les
# scripts d'import, seuls à écrire dans le catalogue — voir import_quiz_maison.py.


class GameCreateIn(BaseModel):
    quizId: int | None = None
    random: bool = False
