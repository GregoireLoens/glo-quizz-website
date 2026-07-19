# Build de production : génère /app/dist (servi par Caddy ou FastAPI StaticFiles)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM scratch AS dist
COPY --from=build /app/dist /dist
