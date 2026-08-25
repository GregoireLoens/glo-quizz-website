import asyncio
import json
import logging
from contextlib import suppress

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from .. import config, db
from ..security import parse_token
from .manager import manager

logger = logging.getLogger("midi-quizz.ws")

router = APIRouter()


async def _heartbeat(room, websocket: WebSocket) -> None:
    """Maintient un trafic applicatif visible par le navigateur.

    Les pings WebSocket de la couche transport ne remontent pas au JavaScript et ne
    permettent donc pas au watchdog client de distinguer une socket half-open.
    """
    while True:
        await asyncio.sleep(config.WS_HEARTBEAT_INTERVAL)
        if not await room._send(websocket, {"type": "ping"}):
            await room.broadcast_players()
            return


def _fetch_user(user_id: int):
    conn = db.connect()
    try:
        return conn.execute(
            "SELECT id, username, avatar_color, avatar_symbol FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
    finally:
        conn.close()


@router.websocket("/ws/game/{code}")
async def game_ws(websocket: WebSocket, code: str):
    await websocket.accept()

    # Auth par premier message {"type": "auth", "token": …} : le token ne transite
    # jamais en query string (access logs uvicorn, logs Cloudflare).
    token = ""
    try:
        raw = await asyncio.wait_for(
            websocket.receive_text(), timeout=config.WS_AUTH_TIMEOUT
        )
        first = json.loads(raw)
        if (
            isinstance(first, dict)
            and first.get("type") == "auth"
            and isinstance(first.get("token"), str)
        ):
            token = first["token"]
    except (asyncio.TimeoutError, json.JSONDecodeError):
        pass
    except WebSocketDisconnect:
        return

    user_id = parse_token(token)
    if user_id is None:
        await websocket.send_json(
            {"type": "error", "code": "invalid_token", "message": "Session invalide."}
        )
        await websocket.close(code=4001)
        return

    room = manager.get(code)
    if room is None:
        await websocket.send_json(
            {
                "type": "error",
                "code": "room_not_found",
                "message": "Cette partie n'existe pas ou est terminée.",
            }
        )
        await websocket.close(code=4004)
        return

    user = await asyncio.to_thread(_fetch_user, user_id)
    if user is None:
        await websocket.close(code=4001)
        return

    joined = await room.handle_join(
        user_id,
        user["username"],
        websocket,
        avatar_color=user["avatar_color"],
        avatar_symbol=user["avatar_symbol"],
    )
    if not joined:
        return

    heartbeat_task = asyncio.create_task(_heartbeat(room, websocket))
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
        heartbeat_task.cancel()
        with suppress(asyncio.CancelledError):
            await heartbeat_task
        await room.handle_disconnect(user_id, websocket)
