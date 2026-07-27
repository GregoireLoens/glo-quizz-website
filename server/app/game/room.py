from __future__ import annotations

import asyncio
import json
import logging
import random
import time
from contextlib import suppress
from dataclasses import dataclass, field
from typing import Any

from fastapi import WebSocket

from .. import config, db

logger = logging.getLogger("midi-quizz.room")


def compute_points(duration: float, elapsed: float, correct: bool) -> int:
    """Scoring dégressif : 1000 pts en instantané, plancher à 250, 0 si faux/absent."""
    if not correct:
        return 0
    elapsed = min(max(elapsed, 0.0), duration)
    return max(config.POINTS_FLOOR, round(config.POINTS_BASE * (duration - elapsed) / duration))


@dataclass
class PlayerState:
    user_id: int
    username: str
    ws: WebSocket | None = None
    connected: bool = False
    ready: bool = False
    score: int = 0
    correct_count: int = 0
    lives: int = 0  # mode Survie uniquement (0 en mode classique)
    eliminated_at: int | None = None  # index de la question fatale (Survie)
    answers: dict[int, tuple[int, float]] = field(default_factory=dict)
    joined_at: float = field(default_factory=time.monotonic)


class GameRoom:
    def __init__(self, code: str, game_id: int, host_id: int, settings: dict[str, Any]):
        self.code = code
        self.game_id = game_id
        self.host_id = host_id
        self.settings: dict[str, Any] = {
            "questionCount": config.DEFAULT_QUESTION_COUNT,
            "timePerQuestion": config.DEFAULT_TIME_PER_QUESTION,
            "quizId": None,
            "quizTitle": None,
            "quizQuestionTotal": None,
            "randomMix": False,
            "survival": False,
            "categories": None,  # modes Aléatoire/Survie : thèmes autorisés (None = tous)
            **settings,
        }
        self.phase: str = "lobby"  # lobby | question | reveal | finished
        self.players: dict[int, PlayerState] = {}
        self.questions: list[dict] = []
        self.questions_played: int = 0
        self.survival_threshold: int = 1  # fin quand vivants <= seuil (0 si partie solo)
        self.current_index: int = -1
        self.question_started_at: float = 0.0
        self.started_at: float = 0.0
        self.duration_sec: int = 0
        self.last_reveal: dict | None = None
        self.final_ranking: list[dict] | None = None
        self.all_answered = asyncio.Event()
        self.lock = asyncio.Lock()
        self.run_task: asyncio.Task | None = None
        self.last_activity = time.monotonic()

    # ---------- helpers ----------

    def touch(self) -> None:
        self.last_activity = time.monotonic()

    def players_payload(self) -> list[dict]:
        return [
            {
                "id": p.user_id,
                "username": p.username,
                "ready": p.ready,
                "connected": p.connected,
                "score": p.score,
                "correctCount": p.correct_count,
                "lives": p.lives,
                "answered": self.current_index in p.answers,
            }
            for p in sorted(self.players.values(), key=lambda p: p.joined_at)
        ]

    def _alive(self) -> list[PlayerState]:
        return [p for p in self.players.values() if p.lives > 0]

    def _ranking_payload(self) -> list[dict]:
        if self.settings["survival"]:
            # survivants d'abord, puis par longévité (éliminé le plus tard), puis au score
            ordered = sorted(
                self.players.values(),
                key=lambda p: (
                    0 if p.lives > 0 else 1,
                    -(p.eliminated_at if p.eliminated_at is not None else 10**9),
                    -p.score,
                    -p.correct_count,
                    p.joined_at,
                ),
            )
        else:
            ordered = sorted(
                self.players.values(),
                key=lambda p: (-p.score, -p.correct_count, p.joined_at),
            )
        return [
            {
                "rank": i + 1,
                "playerId": p.user_id,
                "username": p.username,
                "score": p.score,
                "correctCount": p.correct_count,
                "lives": p.lives,
            }
            for i, p in enumerate(ordered)
        ]

    def _question_payload(self, index: int) -> dict:
        q = self.questions[index]
        return {
            "index": index,
            # en Survie le nombre total de questions n'est pas connu d'avance
            "total": None if self.settings["survival"] else len(self.questions),
            "text": q["text"],
            "answers": q["answers"],
            # titre du quiz d'origine — contexte affiché en modes Aléatoire/Survie uniquement
            "theme": q.get("theme"),
            "duration": self.settings["timePerQuestion"],
        }

    def to_state(self, for_user_id: int) -> dict:
        state: dict[str, Any] = {
            "phase": self.phase,
            "hostId": self.host_id,
            "players": self.players_payload(),
            "settings": self.settings,
            "question": None,
            "reveal": None,
            "ranking": None,
            "yourAnswer": None,
            "durationSec": self.duration_sec,
        }
        if self.phase in ("question", "reveal") and 0 <= self.current_index < len(self.questions):
            q = self._question_payload(self.current_index)
            if self.phase == "question":
                q["elapsed"] = round(time.monotonic() - self.question_started_at, 2)
            state["question"] = q
            me = self.players.get(for_user_id)
            if me is not None and self.current_index in me.answers:
                state["yourAnswer"] = me.answers[self.current_index][0]
        if self.phase == "reveal":
            state["reveal"] = self.last_reveal
        if self.phase == "finished":
            state["ranking"] = self.final_ranking
        state["questionsPlayed"] = self.questions_played if self.phase == "finished" else None
        return state

    async def _send(self, ws: WebSocket, msg: dict) -> None:
        with suppress(Exception):
            await ws.send_text(json.dumps(msg, ensure_ascii=False))

    async def broadcast(self, msg: dict) -> None:
        sockets = [p.ws for p in self.players.values() if p.connected and p.ws is not None]
        if sockets:
            await asyncio.gather(*(self._send(ws, msg) for ws in sockets))

    async def broadcast_players(self) -> None:
        await self.broadcast({"type": "players", "players": self.players_payload(), "hostId": self.host_id})

    async def _error(self, user_id: int, code: str, message: str) -> None:
        p = self.players.get(user_id)
        if p is not None and p.ws is not None:
            await self._send(p.ws, {"type": "error", "code": code, "message": message})

    # ---------- connexion / déconnexion ----------

    async def handle_join(self, user_id: int, username: str, ws: WebSocket) -> bool:
        async with self.lock:
            self.touch()
            p = self.players.get(user_id)
            if p is None:
                if self.phase != "lobby":
                    await self._send(ws, {"type": "error", "code": "already_started",
                                          "message": "La partie a déjà commencé."})
                    with suppress(Exception):
                        await ws.close(code=4003)
                    return False
                p = PlayerState(user_id=user_id, username=username)
                self.players[user_id] = p
            old_ws = p.ws
            p.ws = ws
            p.connected = True
            if old_ws is not None and old_ws is not ws:
                with suppress(Exception):
                    await old_ws.close(code=4000)
            await self._send(ws, {"type": "joined", "you": {"id": user_id}, "state": self.to_state(user_id)})
            await self.broadcast_players()
            return True

    async def handle_disconnect(self, user_id: int, ws: WebSocket) -> None:
        async with self.lock:
            p = self.players.get(user_id)
            if p is None or (p.ws is not None and p.ws is not ws):
                return  # socket déjà remplacée par une reconnexion
            p.ws = None
            p.connected = False
            if self.phase == "lobby":
                del self.players[user_id]
                if user_id == self.host_id and self.players:
                    self.host_id = min(self.players.values(), key=lambda x: x.joined_at).user_id
            else:
                self._maybe_all_answered()
            self.touch()
            await self.broadcast_players()

    # ---------- messages ----------

    async def handle_message(self, user_id: int, msg: dict) -> None:
        msg_type = msg.get("type")
        if msg_type == "ready":
            await self._ready(user_id, msg)
        elif msg_type == "update_settings":
            await self._update_settings(user_id, msg)
        elif msg_type == "start":
            await self._start(user_id)
        elif msg_type == "answer":
            await self._answer(user_id, msg)
        elif msg_type == "play_again":
            await self._play_again(user_id)
        elif msg_type == "leave":
            p = self.players.get(user_id)
            if p is not None and p.ws is not None:
                with suppress(Exception):
                    await p.ws.close(code=4002)

    async def _ready(self, user_id: int, msg: dict) -> None:
        async with self.lock:
            if self.phase != "lobby":
                return
            p = self.players.get(user_id)
            if p is None:
                return
            p.ready = bool(msg.get("ready"))
            self.touch()
            await self.broadcast_players()

    async def _update_settings(self, user_id: int, msg: dict) -> None:
        if user_id != self.host_id:
            await self._error(user_id, "not_host", "Seul l'hôte peut modifier les réglages.")
            return
        if self.phase != "lobby":
            await self._error(user_id, "already_started", "La partie a déjà commencé.")
            return
        incoming = msg.get("settings") or {}
        quiz_info = None
        quiz_id = incoming.get("quizId")
        if incoming.get("survival") is True:
            if not self.settings["survival"]:
                quiz_info = await asyncio.to_thread(_survival_info)
                if quiz_info is None:
                    await self._error(user_id, "no_questions", "Aucune question disponible.")
                    return
        elif incoming.get("randomMix") is True:
            if not self.settings["randomMix"]:
                quiz_info = await asyncio.to_thread(_random_mix_info)
                if quiz_info is None:
                    await self._error(user_id, "no_questions", "Aucune question disponible.")
                    return
        elif quiz_id is not None and quiz_id != self.settings["quizId"]:
            quiz_info = await asyncio.to_thread(_load_quiz_info, quiz_id)
            if quiz_info is None:
                await self._error(user_id, "quiz_not_found", "Ce quiz n'existe pas.")
                return
        categories_update: tuple[list[str] | None, int] | None = None
        if "categories" in incoming:
            categories = _clean_categories(incoming.get("categories"))
            pool_total = await asyncio.to_thread(_count_question_pool, categories)
            if pool_total == 0:
                await self._error(user_id, "no_questions", "Aucune question dans ces thèmes.")
                return
            categories_update = (categories, pool_total)
        async with self.lock:
            if self.phase != "lobby":
                return
            qc = incoming.get("questionCount")
            if isinstance(qc, int) and qc in config.QUESTION_COUNT_CHOICES:
                self.settings["questionCount"] = qc
            tpq = incoming.get("timePerQuestion")
            if isinstance(tpq, int) and tpq in config.TIME_CHOICES:
                self.settings["timePerQuestion"] = tpq
            if quiz_info is not None:
                self.settings.update(quiz_info)
            if categories_update is not None and (self.settings["randomMix"] or self.settings["survival"]):
                self.settings["categories"], pool_total = categories_update
                if self.settings["randomMix"]:
                    self.settings["quizQuestionTotal"] = min(config.RANDOM_MIX_SIZE, pool_total)
            self.touch()
            await self.broadcast({"type": "settings_updated", "settings": self.settings})

    async def _start(self, user_id: int) -> None:
        if user_id != self.host_id:
            await self._error(user_id, "not_host", "Seul l'hôte peut lancer la partie.")
            return
        if self.phase != "lobby":
            await self._error(user_id, "already_started", "La partie a déjà commencé.")
            return
        quiz_id = self.settings["quizId"]
        if self.settings["survival"]:
            questions = await asyncio.to_thread(_load_survival_questions, self.game_id, self.settings)
        elif self.settings["randomMix"]:
            questions = await asyncio.to_thread(_load_random_questions, self.game_id, self.settings)
        elif quiz_id is None:
            await self._error(user_id, "no_quiz", "Choisis un quiz avant de lancer.")
            return
        else:
            questions = await asyncio.to_thread(_load_questions, quiz_id, self.game_id, self.settings)
        if not questions:
            await self._error(user_id, "no_questions", "Ce quiz n'a aucune question.")
            return
        async with self.lock:
            if self.phase != "lobby" or self.run_task is not None:
                return
            random.shuffle(questions)
            if self.settings["survival"]:
                self.questions = questions
                self.survival_threshold = 1 if len(self.players) >= 2 else 0
                for p in self.players.values():
                    p.lives = config.SURVIVAL_LIVES
                    p.eliminated_at = None
                await self.broadcast_players()  # les clients doivent voir les vies avant la 1re question
            else:
                self.questions = questions[: self.settings["questionCount"]]
            self.touch()
            self.run_task = asyncio.create_task(self.run())

    async def _answer(self, user_id: int, msg: dict) -> None:
        async with self.lock:
            if self.phase != "question":
                await self._error(user_id, "too_late", "Trop tard pour cette question.")
                return
            index = msg.get("questionIndex")
            answer_index = msg.get("answerIndex")
            if index != self.current_index or not isinstance(answer_index, int) or not 0 <= answer_index <= 3:
                await self._error(user_id, "invalid_answer", "Réponse invalide.")
                return
            p = self.players.get(user_id)
            if p is None:
                return
            if self.settings["survival"] and p.lives <= 0:
                await self._error(user_id, "eliminated", "Tu es éliminé — spectateur jusqu'à la fin.")
                return
            if index in p.answers:
                await self._error(user_id, "already_answered", "Réponse déjà enregistrée.")
                return
            elapsed = time.monotonic() - self.question_started_at
            p.answers[index] = (answer_index, elapsed)
            self.touch()
            if p.ws is not None:
                await self._send(p.ws, {"type": "answer_ack", "questionIndex": index})
            await self.broadcast({"type": "player_answered", "playerId": user_id})
            self._maybe_all_answered()

    def _maybe_all_answered(self) -> None:
        if self.phase != "question":
            return
        survival = bool(self.settings["survival"])
        active = [
            p for p in self.players.values()
            if p.connected and (not survival or p.lives > 0)
        ]
        if active and all(self.current_index in p.answers for p in active):
            self.all_answered.set()

    async def _play_again(self, user_id: int) -> None:
        if user_id != self.host_id:
            await self._error(user_id, "not_host", "Seul l'hôte peut relancer.")
            return
        if self.phase != "finished":
            return
        new_game_id = await asyncio.to_thread(_create_next_game, self.code, self.host_id, self.settings)
        async with self.lock:
            if self.phase != "finished":
                return
            self.game_id = new_game_id
            self.phase = "lobby"
            self.questions = []
            self.questions_played = 0
            self.current_index = -1
            self.last_reveal = None
            self.final_ranking = None
            self.duration_sec = 0
            self.run_task = None
            for uid in [uid for uid, p in self.players.items() if not p.connected]:
                del self.players[uid]
            for p in self.players.values():
                p.score = 0
                p.correct_count = 0
                p.lives = 0
                p.eliminated_at = None
                p.answers = {}
                p.ready = False
            self.touch()
            await self.broadcast({
                "type": "lobby_reset",
                "players": self.players_payload(),
                "settings": self.settings,
                "hostId": self.host_id,
            })

    # ---------- boucle de jeu autoritaire ----------

    async def run(self) -> None:
        try:
            self.started_at = time.monotonic()
            survival = bool(self.settings["survival"])
            i = 0
            while True:
                if i >= len(self.questions):
                    if not survival:
                        break
                    # Survie : recharge un lot de questions inédites ; pool épuisé → fin
                    seen = {q["text"].lower() for q in self.questions}
                    more = await asyncio.to_thread(
                        _load_more_survival_questions, seen, self.settings["categories"]
                    )
                    if not more:
                        break
                    random.shuffle(more)
                    self.questions.extend(more)
                async with self.lock:
                    self.phase = "question"
                    self.current_index = i
                    self.all_answered = asyncio.Event()
                    self.question_started_at = time.monotonic()
                    self.touch()
                await self.broadcast({"type": "question", **self._question_payload(i)})
                with suppress(asyncio.TimeoutError):
                    await asyncio.wait_for(
                        self.all_answered.wait(),
                        timeout=self.settings["timePerQuestion"] + config.ANSWER_GRACE_SECONDS,
                    )
                async with self.lock:
                    self.phase = "reveal"
                    self.last_reveal = self._score_question(i)
                    self.touch()
                await self.broadcast(self.last_reveal)
                await asyncio.sleep(config.REVEAL_SECONDS)
                i += 1
                if survival and len(self._alive()) <= self.survival_threshold:
                    break
            async with self.lock:
                self.phase = "finished"
                self.questions_played = i
                self.final_ranking = self._ranking_payload()
                self.duration_sec = round(time.monotonic() - self.started_at)
                self.touch()
            await asyncio.to_thread(self._persist_results)
            await self.broadcast({
                "type": "game_over",
                "durationSec": self.duration_sec,
                "questionsPlayed": self.questions_played,
                "ranking": self.final_ranking,
            })
        except Exception:
            logger.exception("La boucle de jeu %s a planté", self.code)

    def _score_question(self, index: int) -> dict:
        q = self.questions[index]
        duration = self.settings["timePerQuestion"]
        survival = bool(self.settings["survival"])
        results = []
        for p in self.players.values():
            if survival and p.lives <= 0:
                continue  # déjà éliminé : simple spectateur
            ans = p.answers.get(index)
            answer_index: int | None = None
            correct = False
            points = 0
            if ans is not None:
                answer_index, elapsed = ans
                correct = answer_index == q["correct_index"]
                points = compute_points(duration, elapsed, correct)
            if correct:
                p.correct_count += 1
            elif survival:
                p.lives -= 1
                if p.lives <= 0:
                    p.eliminated_at = index
            p.score += points
            results.append({
                "playerId": p.user_id,
                "answerIndex": answer_index,
                "correct": correct,
                "pointsEarned": points,
                "score": p.score,
                "lives": p.lives,
            })
        return {
            "type": "reveal",
            "questionIndex": index,
            "correctIndex": q["correct_index"],
            "results": results,
            "ranking": self._ranking_payload(),
        }

    def _persist_results(self) -> None:
        assert self.final_ranking is not None
        conn = db.connect()
        try:
            conn.executemany(
                "INSERT OR REPLACE INTO game_players (game_id, user_id, score, correct_count, rank)"
                " VALUES (?, ?, ?, ?, ?)",
                [
                    (self.game_id, r["playerId"], r["score"], r["correctCount"], r["rank"])
                    for r in self.final_ranking
                ],
            )
            conn.execute(
                "UPDATE games SET status = 'finished', finished_at = datetime('now'),"
                " quiz_id = ?, question_count = ?, time_per_question = ? WHERE id = ?",
                (self.settings["quizId"], self.questions_played, self.settings["timePerQuestion"], self.game_id),
            )
            if self.settings["quizId"] is not None:
                conn.execute(
                    "UPDATE quizzes SET play_count = play_count + 1 WHERE id = ?",
                    (self.settings["quizId"],),
                )
            conn.commit()
        finally:
            conn.close()


# ---------- accès DB synchrones (appelés via asyncio.to_thread) ----------

def _clean_categories(value: Any) -> list[str] | None:
    """Normalise une sélection de thèmes : inconnus écartés, vide/invalide = None (tous)."""
    if not isinstance(value, list):
        return None
    picked = [c for c in config.CATEGORIES if c in value]
    return picked or None


def _pool_where(categories: list[str] | None) -> tuple[str, list]:
    """Clause WHERE du pool aléatoire (questions t jointes à leur quiz z)."""
    if not categories:
        return "", []
    return f" WHERE z.category IN ({','.join('?' * len(categories))})", list(categories)


def _count_question_pool(categories: list[str] | None) -> int:
    conn = db.connect()
    try:
        where, params = _pool_where(categories)
        return conn.execute(
            "SELECT COUNT(DISTINCT lower(t.text)) AS n FROM questions t"
            " JOIN quizzes z ON z.id = t.quiz_id" + where,
            params,
        ).fetchone()["n"]
    finally:
        conn.close()


def _load_quiz_info(quiz_id: int) -> dict | None:
    conn = db.connect()
    try:
        row = conn.execute(
            "SELECT q.id, q.title,"
            " (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) AS question_count"
            " FROM quizzes q WHERE q.id = ?",
            (quiz_id,),
        ).fetchone()
        if row is None:
            return None
        return {
            "quizId": row["id"],
            "quizTitle": row["title"],
            "quizQuestionTotal": row["question_count"],
            "randomMix": False,
            "survival": False,
            "categories": None,
        }
    finally:
        conn.close()


def random_mix_settings(question_total: int) -> dict:
    return {
        "quizId": None,
        "quizTitle": config.RANDOM_MIX_TITLE,
        "quizQuestionTotal": min(config.RANDOM_MIX_SIZE, question_total),
        "randomMix": True,
        "survival": False,
        "categories": None,
    }


def survival_settings() -> dict:
    return {
        "quizId": None,
        "quizTitle": config.SURVIVAL_TITLE,
        "quizQuestionTotal": None,  # illimité : jusqu'au dernier survivant
        "randomMix": False,
        "survival": True,
        "categories": None,
    }


def _survival_info() -> dict | None:
    return survival_settings() if _count_question_pool(None) else None


def _random_mix_info() -> dict | None:
    total = _count_question_pool(None)
    return random_mix_settings(total) if total else None


def _load_questions(quiz_id: int, game_id: int, settings: dict) -> list[dict]:
    conn = db.connect()
    try:
        rows = conn.execute(
            "SELECT text, answers, correct_index FROM questions WHERE quiz_id = ? ORDER BY position",
            (quiz_id,),
        ).fetchall()
        conn.execute(
            "UPDATE games SET status = 'playing', quiz_id = ?, question_count = ?, time_per_question = ?"
            " WHERE id = ?",
            (quiz_id, settings["questionCount"], settings["timePerQuestion"], game_id),
        )
        conn.commit()
        return [
            {"text": r["text"], "answers": json.loads(r["answers"]), "correct_index": r["correct_index"]}
            for r in rows
        ]
    finally:
        conn.close()


def _pool_rows_to_questions(rows: list) -> list[dict]:
    return [
        {
            "text": r["text"],
            "answers": json.loads(r["answers"]),
            "correct_index": r["correct_index"],
            "theme": r["theme"],
        }
        for r in rows
    ]


def _load_random_questions(game_id: int, settings: dict) -> list[dict]:
    """Quiz virtuel « Mix aléatoire » : questions distinctes piochées dans les thèmes choisis."""
    conn = db.connect()
    try:
        where, params = _pool_where(settings["categories"])
        rows = conn.execute(
            "SELECT t.text, t.answers, t.correct_index, z.title AS theme"
            " FROM questions t JOIN quizzes z ON z.id = t.quiz_id"
            + where
            + " GROUP BY lower(t.text) ORDER BY RANDOM() LIMIT ?",
            (*params, config.RANDOM_MIX_SIZE),
        ).fetchall()
        conn.execute(
            "UPDATE games SET status = 'playing', quiz_id = NULL, question_count = ?,"
            " time_per_question = ? WHERE id = ?",
            (settings["questionCount"], settings["timePerQuestion"], game_id),
        )
        conn.commit()
        return _pool_rows_to_questions(rows)
    finally:
        conn.close()


def _load_survival_questions(game_id: int, settings: dict) -> list[dict]:
    """Mode Survie : premier lot de questions aléatoires dans les thèmes choisis."""
    conn = db.connect()
    try:
        where, params = _pool_where(settings["categories"])
        rows = conn.execute(
            "SELECT t.text, t.answers, t.correct_index, z.title AS theme"
            " FROM questions t JOIN quizzes z ON z.id = t.quiz_id"
            + where
            + " GROUP BY lower(t.text) ORDER BY RANDOM() LIMIT ?",
            (*params, config.SURVIVAL_BATCH),
        ).fetchall()
        conn.execute(
            "UPDATE games SET status = 'playing', quiz_id = NULL, question_count = NULL,"
            " time_per_question = ? WHERE id = ?",
            (settings["timePerQuestion"], game_id),
        )
        conn.commit()
        return _pool_rows_to_questions(rows)
    finally:
        conn.close()


def _load_more_survival_questions(exclude_texts: set[str], categories: list[str] | None) -> list[dict]:
    """Lot suivant, sans re-poser une question déjà jouée dans cette partie."""
    conn = db.connect()
    try:
        where, params = _pool_where(categories)
        if exclude_texts:
            where += " AND " if where else " WHERE "
            where += f"lower(t.text) NOT IN ({','.join('?' * len(exclude_texts))})"
            params += list(exclude_texts)
        rows = conn.execute(
            "SELECT t.text, t.answers, t.correct_index, z.title AS theme"
            " FROM questions t JOIN quizzes z ON z.id = t.quiz_id"
            + where
            + " GROUP BY lower(t.text) ORDER BY RANDOM() LIMIT ?",
            (*params, config.SURVIVAL_BATCH),
        ).fetchall()
        return _pool_rows_to_questions(rows)
    finally:
        conn.close()


def _create_next_game(code: str, host_id: int, settings: dict) -> int:
    conn = db.connect()
    try:
        cur = conn.execute(
            "INSERT INTO games (code, quiz_id, host_id, question_count, time_per_question)"
            " VALUES (?, ?, ?, ?, ?)",
            (code, settings["quizId"], host_id, settings["questionCount"], settings["timePerQuestion"]),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()
