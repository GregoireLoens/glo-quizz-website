# Midi Quizz

Site de quiz multijoueur temps réel (façon Kahoot) : création de quiz, salon avec code à 6 caractères, quiz synchronisé en WebSocket, scoring dégressif, classement général. Auth « no-KYC » : pseudo + code unique généré (pas d'email, pas de mot de passe).

## Stack

- **client/** — React 19 + Vite + TypeScript + Tailwind v4 + Zustand (design tokens des maquettes dans `src/index.css`)
- **server/** — FastAPI + SQLite (sqlite3 stdlib, `app/schema.sql`) + WebSockets natifs (état de partie en mémoire, boucle asyncio autoritaire)
- **front/** — maquettes HTML de référence (ne pas modifier)

## Développement (tout en Docker, rien à installer)

```bash
docker compose up               # http://localhost:5173
docker compose exec server python -m app.seed     # quiz + parties de démo (imprime le code du compte « Demo »)
docker compose exec server python -m pytest       # tests (auth, quiz, scoring, flux WebSocket)
docker compose exec client npx tsc --noEmit       # typecheck du front
```

Réinitialiser la base : `docker compose exec server sh -c 'rm -f /app/data/quizz.db*' && docker compose exec server python -m app.seed`

Pour tester le multijoueur : deux navigateurs (ou un onglet privé), deux comptes, l'un crée un salon, l'autre entre le code sur `/join`.

## Architecture rapide

- REST : `/api/auth/*` (register → code `XXXX-XXXX` affiché une seule fois, hash bcrypt en base), `/api/quizzes` (CRUD, owner-only pour les réponses), `/api/leaderboard?period=week|month|all`, `/api/games` (création de salon).
- WebSocket : `/ws/game/{code}?token=…` — la connexion vaut join, snapshot complet à chaque (re)connexion (le F5 en pleine partie reprend la question en cours), timer et scoring côté serveur (`app/game/room.py`), `correct_index` jamais envoyé avant le reveal.
- Scoring : `max(250, 1000 × temps_restant/temps_total)` si bonne réponse, sinon 0.

## Déploiement VPS (cible)

Un seul process uvicorn (**1 worker obligatoire** : l'état des parties est en mémoire) derrière Caddy/nginx : `/` → `client/dist` (build via `client/Dockerfile`), `/api/*` et `/ws/*` → `127.0.0.1:8000`. `SECRET_KEY` et `DB_PATH` par variables d'environnement. Sauvegarde : `sqlite3 quizz.db "VACUUM INTO 'backup.db'"`.
