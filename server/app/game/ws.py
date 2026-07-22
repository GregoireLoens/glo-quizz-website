import asyncio
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from .. import config, db
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

    # Auth par premier message {"type": "auth", "token": …} : le token ne transite
    # jamais en query string (access logs uvicorn, logs Cloudflare).
    token = ""
    try:
        raw = await asyncio.wait_for(websocket.receive_text(), timeout=config.WS_AUTH_TIMEOUT)
        first = json.loads(raw)
        if isinstance(first, dict) and first.get("type") == "auth" and isinstance(first.get("token"), str):
            token = first["token"]
    except (asyncio.TimeoutError, json.JSONDecodeError):
        pass
    except WebSocketDisconnect:
        return

    user_id = parse_token(token)
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
