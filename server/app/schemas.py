import re

from pydantic import BaseModel, Field, field_validator

from . import config

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


class QuestionIn(BaseModel):
    text: str = Field(min_length=1, max_length=300)
    answers: list[str] = Field(min_length=4, max_length=4)
    correctIndex: int = Field(ge=0, le=3)

    @field_validator("text")
    @classmethod
    def strip_text(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("La question ne peut pas être vide.")
        return v

    @field_validator("answers")
    @classmethod
    def check_answers(cls, v: list[str]) -> list[str]:
        cleaned = [a.strip() for a in v]
        if any(not a for a in cleaned):
            raise ValueError("Les 4 réponses doivent être renseignées.")
        if any(len(a) > 120 for a in cleaned):
            raise ValueError("Réponse trop longue (120 caractères max).")
        return cleaned


class QuizIn(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    emoji: str = Field(min_length=1, max_length=8)
    category: str
    questions: list[QuestionIn] = Field(min_length=1, max_length=50)

    @field_validator("title")
    @classmethod
    def strip_title(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Le titre ne peut pas être vide.")
        return v

    @field_validator("category")
    @classmethod
    def check_category(cls, v: str) -> str:
        if v not in config.CATEGORIES:
            raise ValueError("Catégorie inconnue.")
        return v


class GameCreateIn(BaseModel):
    quizId: int | None = None
