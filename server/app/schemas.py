import re

from pydantic import BaseModel, Field, field_validator

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


# Pas de schéma d'entrée pour les quiz : aucun quiz n'entre plus par l'API. Les
# limites de format (titre, énoncé, 4 réponses, 50 questions) sont portées par les
# scripts d'import, seuls à écrire dans le catalogue — voir import_quiz_maison.py.


class GameCreateIn(BaseModel):
    quizId: int | None = None
    random: bool = False
