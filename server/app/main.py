import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import config
from .db import init_db
from .game import ws as game_ws
from .game.manager import manager
from .routers import auth, games, leaderboard, quizzes


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    purge_task = asyncio.create_task(manager.purge_loop())
    yield
    purge_task.cancel()


app = FastAPI(title="Midi Quizz API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(quizzes.router)
app.include_router(leaderboard.router)
app.include_router(games.router)
app.include_router(game_ws.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


# En prod : sert le build du client (SPA) depuis STATIC_DIR, fallback sur index.html.
_static = Path(config.STATIC_DIR) if config.STATIC_DIR else None
if _static is not None and _static.is_dir():
    app.mount("/assets", StaticFiles(directory=_static / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        candidate = (_static / full_path).resolve()
        if full_path and candidate.is_file() and candidate.is_relative_to(_static.resolve()):
            return FileResponse(candidate)
        return FileResponse(_static / "index.html")
