# Imagen única: el backend (Hono) sirve la API y el build del frontend.
FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM base AS runtime
ENV NODE_ENV=production
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --prod --filter @ski/api...
COPY apps/api apps/api
COPY packages/shared packages/shared
COPY --from=build /app/apps/web/dist apps/web/dist
USER node
EXPOSE 3000
CMD ["node", "apps/api/src/index.ts"]
