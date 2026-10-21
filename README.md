# Ski Friends

Web mobile-first para comparar destinos y alojamientos de un viaje de esquí entre amigos.
Producción: https://ski-friends.pandiello.dev

- Requisitos: [`functional-requirements.md`](functional-requirements.md)
- Diseño: [`docs/design.md`](docs/design.md)

## Estructura

```
apps/web         React + Vite + Tailwind (SPA)
apps/api         Node + Hono + Drizzle (API, worker de extracción; sirve el SPA en producción)
packages/shared  Schemas zod y utilidades compartidas
```

## Desarrollo local

Requisitos: Node 24+, Docker y pnpm (`corepack enable`).

```sh
cp .env.example .env
pnpm install
pnpm db:up          # Postgres 17 en localhost:5432
pnpm dev            # API en :3000 (aplica migraciones al arrancar) + Vite en :5173
```

Abre http://localhost:5173 (Vite redirige `/api` a la API).

## Base de datos

El esquema está en `apps/api/src/db/schema.ts`. Tras modificarlo:

```sh
pnpm db:generate    # genera una migración SQL en apps/api/drizzle/
```

Las migraciones se aplican automáticamente al arrancar la API (o con `pnpm db:migrate`).

## Producción (Coolify)

- **App**: build con el `Dockerfile` de la raíz, puerto `3000`, dominio `ski-friends.pandiello.dev`.
- **Base de datos**: recurso PostgreSQL 17 de Coolify; su URL interna va en `DATABASE_URL`.
- **Variables**: las de `.env.example`.

Para probar la imagen de producción en local: `docker compose --profile app up --build`.
