# Image de production Midi Quizz — un seul conteneur.
# Contexte de build = racine du repo (voir docker-compose.prod.yml : context: ..).
# Stage 1 : build du client React (Vite) -> /client/dist
# Stage 2 : serveur FastAPI qui sert l'API + le WebSocket + la SPA (STATIC_DIR).

FROM node:22-alpine AS client-build
WORKDIR /client
COPY client/package.json client/package-lock.json* ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
COPY server/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY server/app ./app
COPY server/openquizzdb ./openquizzdb
COPY server/quiz_maison ./quiz_maison
COPY --from=client-build /client/dist ./static
ENV STATIC_DIR=/app/static \
    DB_PATH=/data/quizz.db \
    DOCS_ENABLED=0
EXPOSE 8000
# 1 worker obligatoire : l'état des parties vit en mémoire.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
