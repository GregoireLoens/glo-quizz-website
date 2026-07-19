import asyncio
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from .. import db
from ..security import parse_token
from .manager import manager

logger = logging.getLogger("midi-quizz.ws")

router = APIRouter()


def _fetch_user(user_id: int):
    conn = db.connect()
    try:
        return conn.execute("SELECT id, username FROM users WHERE id = ?", (user_id,)).fetchone()
    finally:
        conn.close()


@router.websocket("/ws/game/{code}")
async def game_ws(websocket: WebSocket, code: str):
    await websocket.accept()

    user_id = parse_token(websocket.query_params.get("token", ""))
    if user_id is None:
        await websocket.send_json({"type": "error", "code": "invalid_token", "message": "Session invalide."})
        await websocket.close(code=4001)
        return

    room = manager.get(code)
    if room is None:
        await websocket.send_json({"type": "error", "code": "room_not_found",
                                   "message": "Cette partie n'existe pas ou est terminée."})
        await websocket.close(code=4004)
        return

    user = await asyncio.to_thread(_fetch_user, user_id)
    if user is None:
        await websocket.close(code=4001)
        return

    joined = await room.handle_join(user_id, user["username"], websocket)
    if not joined:
        return

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if isinstance(msg, dict) and isinstance(msg.get("type"), str):
                await room.handle_message(user_id, msg)
    except WebSocketDisconnect:
        pass
    finally:
        await room.handle_disconnect(user_id, websocket)
