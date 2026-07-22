# Midi Quizz — instructions de développement

Site de quiz multijoueur temps réel (façon Kahoot). Auth « no-KYC » : pseudo + code unique `XXXX-XXXX` généré serveur, montré une seule fois. V1 complète et vérifiée E2E (voir `changelog.md`, local non versionné).

## Contraintes non négociables

1. **Tout en Docker, rien ne s'installe sur la machine hôte.** Pas de `npm`/`pip`/navigateur installé localement : toute commande passe par `docker compose exec` ou un conteneur jetable (`docker run --rm`). Les vérifs navigateur se font avec `zenika/alpine-chrome` (screenshots) ou `zenika/alpine-chrome:with-puppeteer` (E2E), en `--network host`.
2. **Un seul worker uvicorn, toujours.** L'état des parties vit en mémoire (`server/app/game/manager.py`) — jamais de `--workers N`, pas de Redis. C'est un choix d'architecture assumé (cible : VPS perso derrière Caddy).
3. **Anti-triche côté serveur** : `correct_index` ne doit JAMAIS quitter le serveur avant le message `reveal` ; le chronométrage fait foi côté serveur (`time.monotonic()`), le timer client est purement cosmétique ; toutes les validations hôte-only sont revérifiées serveur.
4. **Le code unique utilisateur n'existe en clair qu'une fois** : réponse du register, puis uniquement le hash bcrypt en base. Côté client il ne transite que par le state de navigation React (`navigate(state)`) — jamais URL, jamais storage, pas de re-fetch possible.
5. **`front/` est la référence design, ne pas y toucher.** Design system : fond `ink #211F1A`, cartes `card #28261F`, texte `cream #F5F3EC`, accents `citron #C7F45C` / `violet #9C8DF2` / `coral #F0492E`, Fredoka (titres) + Inter (UI), pilules `rounded-full`, cartes 24–28px, halos flous (`GlowBackdrop`), **aucune ombre portée** (`shadow-*` interdit). Tokens déclarés dans `client/src/index.css` (`@theme` Tailwind v4) — les réutiliser, pas de couleurs en dur.
6. Codes (partie 6 chars, user 8 chars) sur l'alphabet sans ambigus `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (`server/app/config.py`) ; toute saisie est normalisée (upper, sans tirets/espaces).

## Commandes

```bash
docker compose up                                  # dev → http://localhost:5173 (proxy /api et /ws vers server:8000)
docker compose exec server python -m pytest        # tests serveur (doivent rester verts)
docker compose exec client npx tsc --noEmit        # typecheck front (zéro erreur exigé)
docker compose exec server python -m app.seed      # seed démo (imprime le code du compte « Demo »)
docker compose exec server sh -c 'rm -f /app/data/quizz.db*'   # reset base (puis re-seed)
docker compose restart client                      # après modification de package.json
```

## Architecture

- `server/app/` — FastAPI + SQLite (sqlite3 stdlib, pas d'ORM, schéma dans `schema.sql`, idempotent, exécuté au lifespan). Endpoints REST **sync** (`def`, threadpool) ; depuis l'asyncio du jeu, accès DB via `asyncio.to_thread`.
  - `security.py` : bcrypt du code, tokens itsdangerous **datés** (`URLSafeTimedSerializer`, expiration `TOKEN_MAX_AGE` = 30 j), génération des codes.
  - `routers/` : `auth` (register/login/me), `quizzes` (CRUD, `correctIndex` renvoyé à l'owner uniquement, 403 sinon), `leaderboard` (agrégation `game_players` × période), `games` (création de salon → crée la `GameRoom` mémoire).
  - `game/room.py` : cœur du temps réel — `GameRoom` (players, settings, `asyncio.Lock`), boucle `run()` autoritaire (question → `all_answered`/timeout → reveal → sleep 4s), `compute_points()` = `max(250, round(1000 × (durée−écoulé)/durée))` si correct sinon 0, persistance en fin de partie seulement. `play_again` crée une **nouvelle ligne `games`** avec le même code (le code n'est pas UNIQUE en base ; l'unicité des salons actifs = clés du dict du manager).
  - `game/ws.py` : `/ws/game/{code}` — **auth par premier message** `{"type":"auth","token":…}` (timeout 5 s ; le token ne transite jamais en query string → pas dans les logs). La connexion vaut join ; une nouvelle socket du même user **remplace** l'ancienne (close 4000) = mécanisme de reconnexion ; snapshot complet `joined` à chaque (re)connexion. Codes de close applicatifs : 4001 token, 4003 partie commencée, 4004 salon inconnu, 4005 purge.
- `client/src/` — React 19 + Vite + TS strict + Tailwind v4 + Zustand.
  - `stores/gameStore.ts` : miroir client de l'état de partie, **une seule** porte d'entrée `apply(msg)` (style reducer) alimentée par `lib/ws.ts` (reconnexion auto backoff 0.5→5s).
  - `GamePage` = une seule route `/game/:code` qui rend Lobby/Playing/Results selon `phase` poussée par le serveur — ne pas introduire de navigation entre ces états.
  - Session persistée sous la clé localStorage `midi-quizz-auth` (format zustand persist).
- Types du protocole WS : `client/src/lib/types.ts` (`ServerMessage`/`ClientMessage`). **Toute évolution du protocole se fait des deux côtés en même temps** (Pydantic léger côté serveur dans `room.py`/`ws.py`).

## Vérification avant de conclure

1. `pytest` vert + `tsc --noEmit` sans erreur.
2. Multijoueur : test à 2 contextes navigateur (le script E2E puppeteer utilisé pour la v1 peut être recréé sur ce modèle : register via API, token dans localStorage, 2 pages, partie complète jusqu'au podium).
3. `document.body.innerText` est affecté par `text-transform: uppercase` — comparaisons de texte E2E en case-insensitive.
4. Ne jamais lancer pytest sans être sûr que `tests/conftest.py` force `DB_PATH` (base jetable) — sinon les tests écrasent la base de dev.

## Déploiement (fait le 21/07/2026)

Prod : **https://midi-quizz.gloens.fr** — VPS OVH, reverse proxy **Traefik v3** existant (TLS Let's Encrypt, routage par labels Docker, réseau externe `n8n_default`), domaine proxifié Cloudflare. Un seul conteneur `midi-quizz` (image multi-stage : build client → uvicorn 1 worker qui sert API + WS + SPA via `STATIC_DIR`). Tout est dans **`deploy/` (gitignoré**, contient secrets et notes VPS) : `Dockerfile`, `docker-compose.prod.yml`, `deploy.sh` (redéploiement = `./deploy/deploy.sh`, sync tar-over-ssh + build), `.env` (`SECRET_KEY` — ne jamais régénérer), et l'état des lieux complet `01-etat-des-lieux-vps.md`. En prod : `DOCS_ENABLED=0` (pas de `/docs`). Backup SQLite (`VACUUM INTO`) : pas encore de cron.

## Divers

- Identité git : configurée en local (`glo` / gregoire.loens59670@gmail.com). Remote : `origin` → `git@github.com:GregoireLoens/glo-quizz-website.git`.
- `changelog.md` : journal local **non versionné** (dans `.gitignore`) — le tenir à jour à chaque itération.
- Plan d'origine : `~/.claude/plans/structured-napping-boot.md`.
