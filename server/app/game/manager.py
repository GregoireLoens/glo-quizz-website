from __future__ import annotations

import asyncio
import logging
import time
from contextlib import suppress

from .. import config, db
from ..security import generate_game_code
from .room import GameRoom

logger = logging.getLogger("midi-quizz.manager")


class GameManager:
    def __init__(self) -> None:
        self.rooms: dict[str, GameRoom] = {}

    def generate_unique_code(self) -> str:
        while True:
            code = generate_game_code()
            if code not in self.rooms:
                return code

    def create_room(self, code: str, game_id: int, host_id: int, settings: dict) -> GameRoom:
        room = GameRoom(code=code, game_id=game_id, host_id=host_id, settings=settings)
        self.rooms[code] = room
        return room

    def get(self, code: str) -> GameRoom | None:
        return self.rooms.get(code.upper())

    async def purge_loop(self) -> None:
        while True:
            await asyncio.sleep(config.PURGE_INTERVAL)
            try:
                await self.purge()
            except Exception:
                logger.exception("Échec de la purge des rooms")

    async def purge(self) -> None:
        now = time.monotonic()
        for code, room in list(self.rooms.items()):
            idle = now - room.last_activity
            expired = (
                (room.phase == "finished" and idle > config.ROOM_FINISHED_TTL)
                or (room.phase == "lobby" and not room.players and idle > 120)
                or idle > config.ROOM_INACTIVE_TTL
            )
            if not expired:
                continue
            if room.run_task is not None and not room.run_task.done():
                room.run_task.cancel()
            for p in room.players.values():
                if p.ws is not None:
                    with suppress(Exception):
                        await p.ws.close(code=4005)
            if room.phase != "finished":
                await asyncio.to_thread(_mark_abandoned, room.game_id)
            del self.rooms[code]
            logger.info("Room %s purgée (phase=%s, idle=%.0fs)", code, room.phase, idle)


def _mark_abandoned(game_id: int) -> None:
    conn = db.connect()
    try:
        conn.execute(
            "UPDATE games SET status = 'abandoned' WHERE id = ? AND status != 'finished'",
            (game_id,),
        )
        conn.commit()
    finally:
        conn.close()


manager = GameManager()
