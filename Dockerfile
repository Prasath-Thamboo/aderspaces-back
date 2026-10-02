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
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# ---- runtime (deps de prod + sortie compilée) ----
FROM base AS runner
ENV NODE_ENV=production

RUN addgroup -g 1001 -S medusa \
    && adduser -S medusa -u 1001 \
    && chown medusa:medusa /app
USER medusa

COPY --chown=medusa:medusa package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod
# `dist/` est une application autonome (medusa-config.js, src/, public/admin) :
# elle doit être à la racine du répertoire de travail pour `medusa start`.
COPY --chown=medusa:medusa --from=build /app/dist ./

EXPOSE 9000

# Déploiement mono-instance : migrations au démarrage.
# En multi-instance, sortir `medusa db:migrate` dans un job de release dédié.
CMD ["sh", "-c", "npx medusa db:migrate && npx medusa start"]
