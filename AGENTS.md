# Midi Quizz — instructions de développement

Fichier d'instructions unique du dépôt, valable pour n'importe quel agent de code. `CLAUDE.md`
ne fait que l'importer pour Claude Code : toute modification se fait **ici**.

Site de quiz multijoueur temps réel (façon Kahoot). Auth « no-KYC » : pseudo + code unique `XXXX-XXXX` généré serveur, montré une seule fois. V1 complète et vérifiée E2E (voir `changelog.md`, local non versionné).

## Façon de travailler

- **Effort de réflexion : `high` par défaut**, et **monter en `max`** dès que ça devient coton — bug non reproductible, race condition temps réel (boucle `run()`, reconnexion WS), refonte d'architecture, arbitrage design system, sécurité/durcissement VPS. Ne pas rester en effort bas « pour aller vite » sur ces sujets.
- **Réponses concises.** Le strict nécessaire pour comprendre : le résultat d'abord, puis seulement ce qui change la suite. Pas de préambule, pas de reformulation de la demande, pas de récap de ce qui vient d'être lu à l'écran, pas de tableau ni de titres pour trois lignes. Effort maximal sur le travail, minimal sur le volume de texte — concis ne veut pas dire télégraphique : phrases complètes, termes techniques explicites.

## Contraintes non négociables

1. **Tout en Docker, rien ne s'installe sur la machine hôte.** Pas de `npm`/`pip`/navigateur installé localement : toute commande passe par `docker compose exec` ou un conteneur jetable (`docker run --rm`). Les vérifs navigateur se font avec `zenika/alpine-chrome` (screenshots) ou `zenika/alpine-chrome:with-puppeteer` (E2E), en `--network host`.
2. **Un seul worker uvicorn, toujours.** L'état des parties vit en mémoire (`server/app/game/manager.py`) — jamais de `--workers N`, pas de Redis. C'est un choix d'architecture assumé (cible : VPS perso derrière Caddy).
3. **Anti-triche côté serveur** : `correct_index` ne doit JAMAIS quitter le serveur avant le message `reveal` ; le chronométrage fait foi côté serveur (`time.monotonic()`), le timer client est purement cosmétique ; toutes les validations hôte-only sont revérifiées serveur.
4. **Le code unique utilisateur n'existe en clair qu'une fois** : réponse du register, puis uniquement le hash bcrypt en base. Côté client il ne transite que par le state de navigation React (`navigate(state)`) — jamais URL, jamais storage, pas de re-fetch possible.
5. **`front/` est la référence design, ne pas y toucher.** Design system : fond `ink #211F1A`, cartes `card #28261F`, texte `cream #F5F3EC`, accents `citron #C7F45C` / `violet #9C8DF2` / `coral #F0492E`, Fredoka (titres) + Inter (UI), pilules `rounded-full`, cartes 24–28px, halos flous (`GlowBackdrop`), **aucune ombre portée** (`shadow-*` interdit). Tokens déclarés dans `client/src/index.css` (`@theme` Tailwind v4) — les réutiliser, pas de couleurs en dur.
6. Codes (partie 6 chars, user 8 chars) sur l'alphabet sans ambigus `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (`server/app/config.py`) ; toute saisie est normalisée (upper, sans tirets/espaces).
7. **Points ≠ classement.** Le classement d'une partie (`_rank_key`, podium **et** Elo) se joue d'abord au **nombre de bonnes réponses** ; les points (`compute_points`, bonus de vitesse) ne départagent que les ex æquo — la rapidité ne doit jamais faire passer devant quelqu'un qui a réussi plus de questions (décision glo, 28/07). Le classement durable, lui, est l'**Elo** (`server/app/elo.py`). Deux invariants : une partie à moins de 2 joueurs n'est **jamais** classée, et l'ordre d'arrivée dans le salon ne départage jamais l'Elo (vrais ex æquo = nul).

## Commandes

```bash
docker compose up                                  # dev → http://localhost:5173 (proxy /api et /ws vers server:8000)
docker compose exec server python -m pytest        # tests serveur (doivent rester verts)
docker compose exec client npx tsc --noEmit        # typecheck front (zéro erreur exigé)
docker compose exec server python -m app.seed      # seed démo (imprime le code du compte « Demo »)
docker compose exec server python -m app.import_openquizzdb /app/openquizzdb   # corpus CC BY-SA
docker compose exec server python -m app.import_quiz_maison /app/quiz_maison   # corpus maison
docker compose exec server sh -c 'rm -f /app/data/quizz.db*'   # reset base (puis re-seed)
docker compose restart client                      # après modification de package.json
```

## Architecture

- `server/app/` — FastAPI + SQLite (sqlite3 stdlib, pas d'ORM, schéma dans `schema.sql`, idempotent, exécuté au lifespan). Endpoints REST **sync** (`def`, threadpool) ; depuis l'asyncio du jeu, accès DB via `asyncio.to_thread`.
  - `db.py` : `init_db()` = `schema.sql` puis `_migrate()`. `CREATE TABLE IF NOT EXISTS` n'ajoute rien à une table existante → toute nouvelle colonne se greffe là, en testant `PRAGMA table_info` avant l'`ALTER TABLE`. C'est le seul mécanisme de migration du projet.
  - `security.py` : bcrypt du code, tokens itsdangerous **datés** (`URLSafeTimedSerializer`, expiration `TOKEN_MAX_AGE` = 30 j), génération des codes.
  - `elo.py` : classement Elo, pur (aucun accès DB, donc testable seul). Une partie à N joueurs vaut les N(N-1)/2 duels, somme divisée par (N−1) pour qu'une partie à 8 pèse autant qu'un duel ; K = 48 pendant les 10 premières parties classées puis 32 ; départ 1000, plancher 100. Les parties antérieures à l'Elo ne sont **pas** rejouées : tout le monde est parti de 1000 à la mise en service (choix de glo, 28/07).
  - `import_openquizzdb.py` et `import_quiz_maison.py` : imports de corpus, lancés **à la main** (`python -m app.<module>`), jamais au démarrage. Tous deux idempotents par (owner, titre) et pilotés par un `MANIFEST` en tête de fichier — c'est lui qui décide de la catégorie, du titre et de l'emoji, pas le fichier source, qui n'est jamais retouché. Chacun a son compte propriétaire, ce qui rend la provenance lisible partout où l'auteur d'un quiz s'affiche : « OpenQuizzDB » pour le corpus CC BY-SA (`server/openquizzdb/`), « Midi Quizz » pour le contenu maison (`server/quiz_maison/`, format OpenTDB `{"results": […]}`). Le mélange des 4 réponses de `import_quiz_maison` est **déterministe** (graine = énoncé) : deux imports du même fichier produisent la même base.
  - `routers/` : `auth` (register/login/me), `quizzes` (**lecture seule** : `GET /api/categories` et `GET /api/quizzes` — la création, l'édition et la suppression ont été retirées le 06/08/2026, côté site comme côté API ; le catalogue ne s'alimente plus que par les scripts d'import, seuls à écrire dans `quizzes`/`questions`), `leaderboard` (Elo courant sur « depuis toujours » ; sur semaine/mois un rating instantané n'aurait pas de sens → tri sur la progression `SUM(elo_delta)`), `games` (création de salon → crée la `GameRoom` mémoire).
  - `game/room.py` : cœur du temps réel — `GameRoom` (players, settings, `asyncio.Lock`), boucle `run()` autoritaire (question → `all_answered`/timeout → reveal → sleep 4s), `compute_points()` = `max(250, round(1000 × (durée−écoulé)/durée))` si correct sinon 0, persistance en fin de partie seulement. `_apply_elo()` boucle dans la même transaction que l'insertion des `game_players` (dont il complète `elo_before`/`elo_delta`, laissés à NULL si la partie n'est pas classée) et met à jour `users.elo`/`elo_games` ; les places viennent de `_elo_groups()`, qui regroupe les `_rank_key` identiques — c'est là que se joue l'invariant « pas de départage par ordre d'arrivée ». `play_again` crée une **nouvelle ligne `games`** avec le même code (le code n'est pas UNIQUE en base ; l'unicité des salons actifs = clés du dict du manager).
  - `game/ws.py` : `/ws/game/{code}` — **auth par premier message** `{"type":"auth","token":…}` (timeout 5 s ; le token ne transite jamais en query string → pas dans les logs). La connexion vaut join ; une nouvelle socket du même user **remplace** l'ancienne (close 4000) = mécanisme de reconnexion ; snapshot complet `joined` à chaque (re)connexion. Codes de close applicatifs : 4001 token, 4003 partie commencée, 4004 salon inconnu, 4005 purge.
- `client/src/` — React 19 + Vite + TS strict + Tailwind v4 + Zustand.
  - `stores/gameStore.ts` : miroir client de l'état de partie, **une seule** porte d'entrée `apply(msg)` (style reducer) alimentée par `lib/ws.ts` (reconnexion auto backoff 0.5→5s).
  - `GamePage` = une seule route `/game/:code` qui rend Lobby/Playing/Results selon `phase` poussée par le serveur — ne pas introduire de navigation entre ces états.
  - Session persistée sous la clé localStorage `midi-quizz-auth` (format zustand persist).
- Types du protocole WS : `client/src/lib/types.ts` (`ServerMessage`/`ClientMessage`). **Toute évolution du protocole se fait des deux côtés en même temps** (Pydantic léger côté serveur dans `room.py`/`ws.py`).

## Vérification avant de conclure

1. `pytest` vert + `tsc --noEmit` sans erreur.
2. Multijoueur : test à 2 contextes navigateur — script prêt dans `scripts/e2e-random.js` (register via API, token dans localStorage, 2 pages, partie complète jusqu'au podium). Lancement : `docker run --rm --network host -e NODE_PATH=/usr/src/app/node_modules -v "$PWD/scripts:/work" --entrypoint node zenika/alpine-chrome:with-puppeteer /work/e2e-random.js`.
3. `document.body.innerText` est affecté par `text-transform: uppercase` — comparaisons de texte E2E en case-insensitive.
4. Répondre dans `PlayingView` = **2 clics** : la carte sélectionne, seul « Valider → » envoie la réponse au serveur. Un E2E qui ne clique que les cartes n'envoie rien (questions au timeout, scores à 0). Couper animations/filtres en CSS dans le navigateur headless évite les gels de page.
5. Ne jamais lancer pytest sans être sûr que `tests/conftest.py` force `DB_PATH` (base jetable) — sinon les tests écrasent la base de dev.
6. Après les vérifs navigateur : supprimer les images Docker utilisées (`docker rmi zenika/alpine-chrome…`) et purger les comptes/parties de test de la base de dev — ne garder que ce qui sert.

## Déploiement (fait le 21/07/2026)

Prod : **https://midi-quizz.glocorp.fr** (basculé depuis gloens.fr le 01/08/2026, coupure nette — decision glo) — VPS OVH, domaine proxifié Cloudflare. Un seul conteneur (image multi-stage : build client → uvicorn 1 worker qui sert API + WS + SPA via `STATIC_DIR`). En prod : `DOCS_ENABLED=0` (pas de `/docs`). Backup SQLite (`VACUUM INTO`) : pas encore de cron.

**Depuis le 03/08/2026 le déploiement est géré par Coolify** — le Traefik monté à la main dans la stack n8n a disparu avec elle, ainsi que le réseau `n8n_default` :
- `deploy/Dockerfile` et `deploy/docker-compose.prod.yml` sont désormais **versionnés** : Coolify construit depuis GitHub et doit y accéder. Restent gitignorés `deploy/.env` et les notes VPS.
- `SECRET_KEY` vit dans les variables d'environnement Coolify (**ne jamais la régénérer**). La base SQLite est sur un volume Coolify monté sur `/data`.
- **Le routage ET les headers de sécurité sont dans les « custom labels » de l'application Coolify**, plus dans le compose. Piège : ces labels **remplacent** ceux que Coolify génère — ils doivent donc inclure aussi `traefik.enable`, les routers, les règles de host et les services. En oublier un met le site en 404 (constaté lors de la migration).
- TLS : **certificat d'origine Cloudflare** (expire le 30/07/2041) posé dans `/data/coolify/proxy/dynamic/`, sans ACME — Let's Encrypt ne peut pas aboutir derrière le proxy Cloudflare.
- Le dashboard Coolify n'est **pas exposé** (port 8000 fermé au public) : passer par un tunnel SSH `ssh -L 8000:localhost:8000 -L 6001:localhost:6001 -L 6002:localhost:6002 -i ~/.ssh/vps debian@217.182.65.235`.

**Déployer = pousser un tag `v*`** : `.github/workflows/deploy.yml` déclenche Coolify via SSH. Coolify construit la branche `main`, le tag doit donc être posé dessus.

**Demander la version à glo avant CHAQUE déploiement** (consigne du 28/07/2026) — avant de pousser le tag, jamais après. Lui proposer le numéro visé (ex. `0.2` pour une fonctionnalité, `0.1.1` pour un correctif) ou le maintien de la version courante s'il s'agit d'un simple redéploiement ; c'est **lui** qui tranche, ne pas décider seul. S'il y a bump : mettre à jour `APP_VERSION` (`client/src/lib/version.ts`), commiter, poser le tag annoté et le pousser, **puis** déployer — dans cet ordre, pour que le tag pointe exactement sur ce qui tourne en prod.

## Divers

- Identité git : configurée en local (`glo` / gregoire.loens59670@gmail.com). Remote : `origin` → `git@github.com:GregoireLoens/glo-quizz-website.git`.
- **Versionnage** (depuis le 28/07/2026, `v0.1`) : `client/src/lib/version.ts` (`APP_VERSION`) est la source de vérité, affichée dans le footer de l'accueil. Une version publiée = cette constante **et** un tag git annoté du même nom (`git tag -a v0.2 -m "…" && git push origin v0.2`) — les deux se bumpent ensemble, sinon le site ment sur ce qu'il exécute. `gh` n'est pas installé (rien ne s'installe sur l'hôte) : les Releases GitHub se créent depuis le site à partir du tag.
- `changelog.md` : journal local **non versionné** (dans `.gitignore`) — le tenir à jour à chaque itération.
- Plan d'origine : `~/.claude/plans/structured-napping-boot.md`.
