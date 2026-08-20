import asyncio
from contextlib import asynccontextmanager
from functools import lru_cache
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from . import config, seo
from .db import init_db
from .game import ws as game_ws
from .game.manager import manager
from .routers import auth, games, leaderboard, profile, quizzes


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
app.include_router(profile.router)
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

    @lru_cache(maxsize=1)
    def _index_html() -> str:
        return (_static / "index.html").read_text(encoding="utf-8")

    # HEAD accepté : les moniteurs d'uptime sondent souvent sans corps.
    @app.api_route("/{full_path:path}", methods=["GET", "HEAD"], include_in_schema=False)
    async def spa_fallback(full_path: str):
        # Un chemin d'API inconnu doit répondre comme une API. Sans ça, il ressort
        # en 200 avec la page HTML : une URL mal orthographiée ou un endpoint retiré
        # passe alors pour un succès (constaté en vérifiant le retrait du CRUD quiz).
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="not_found")
        candidate = (_static / full_path).resolve()
        if full_path and candidate.is_file() and candidate.is_relative_to(_static.resolve()):
            return FileResponse(candidate)
        # La SPA rend le même index.html partout : on y réécrit titre, description et
        # balises de partage selon la route, seul moyen sans SSR d'être lisible par un
        # crawler ou un aperçu de lien. Le fichier est immuable dans l'image, donc lu
        # une fois pour toutes.
        return HTMLResponse(seo.render(_index_html(), full_path))
