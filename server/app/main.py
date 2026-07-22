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


app = FastAPI(
    title="Midi Quizz API",
    lifespan=lifespan,
    docs_url="/docs" if config.DOCS_ENABLED else None,
    redoc_url=None,
    openapi_url="/openapi.json" if config.DOCS_ENABLED else None,
)

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

    @app.middleware("http")
    async def cache_headers(request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/assets/"):
            # Fichiers Vite hashés dans le nom → immuables.
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        elif response.headers.get("content-type", "").startswith("text/html"):
            # index.html : toujours revalider, sinon un HTML périmé peut référencer
            # des assets disparus après un déploiement.
            response.headers["Cache-Control"] = "no-cache"
        return response

    # HEAD accepté : les moniteurs d'uptime sondent souvent sans corps.
    @app.api_route("/{full_path:path}", methods=["GET", "HEAD"], include_in_schema=False)
    async def spa_fallback(full_path: str):
        candidate = (_static / full_path).resolve()
        if full_path and candidate.is_file() and candidate.is_relative_to(_static.resolve()):
            return FileResponse(candidate)
        return FileResponse(_static / "index.html")
