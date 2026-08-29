# syntax=docker/dockerfile:1
# Image de production du backend Medusa v2 (testée avec @medusajs 2.19).
# `medusa build` compile vers ./dist (backend + dashboard admin).
# Développement local : `pnpm dev` + docker-compose.yml (Postgres/Redis/…).

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat python3 make g++
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# ---- build (deps complètes + compilation) ----
FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# ---- runtime (deps de prod + sortie compilée) ----
FROM base AS runner
ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod
COPY --from=build /app/dist ./dist

RUN addgroup -g 1001 -S medusa \
    && adduser -S medusa -u 1001 \
    && chown -R medusa:medusa /app
USER medusa

EXPOSE 9000

# Déploiement mono-instance : migrations au démarrage.
# En multi-instance, sortir `medusa db:migrate` dans un job de release dédié.
CMD ["sh", "-c", "npx medusa db:migrate && npx medusa start"]
