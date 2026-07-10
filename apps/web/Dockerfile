# Build context is the REPO ROOT, not apps/web: this is an npm-workspaces monorepo, so
# apps/web needs packages/shared's build output and the root node_modules.
#
#   docker compose --profile web build
#
# syntax=docker/dockerfile:1

# ---- builder -----------------------------------------------------------------
FROM node:24-alpine AS builder
WORKDIR /app

# Copy manifests first so `npm ci` is cached until a dependency actually changes.
# Every workspace's package.json must be present or npm refuses to resolve the lockfile.
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/worker/package.json ./apps/worker/
COPY packages/shared/package.json ./packages/shared/
COPY packages/importers/package.json ./packages/importers/
COPY packages/simulation-engine/package.json ./packages/simulation-engine/
COPY packages/validation/package.json ./packages/validation/

# The root `prepare` script runs `git config` — it is guarded, but there is no .git here.
RUN npm ci

COPY packages ./packages
COPY apps/web ./apps/web

# apps/web imports @heritage-saturday/shared from its dist/, so build the packages first.
# The root build script enforces dependency order; here only shared is needed.
RUN npm run build -w @heritage-saturday/shared

# NEXT_PUBLIC_* is inlined into the client bundle at BUILD time, not read at runtime.
# There is deliberately no NEXT_PUBLIC_API_URL: the browser calls this app's own
# /api/proxy/* route on the same origin, so the API address never leaves the server.
ARG NEXT_PUBLIC_DEV_USER_ID=dev-user-1
ENV NEXT_PUBLIC_DEV_USER_ID=$NEXT_PUBLIC_DEV_USER_ID

RUN npm run build -w @heritage-saturday/web

# ---- runtime -----------------------------------------------------------------
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Don't run as root.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# `output: standalone` traces from the workspace root (outputFileTracingRoot), so the
# standalone tree mirrors the monorepo layout: server.js sits under apps/web/.
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000

# API_URL and API_SHARED_SECRET (both server-side only) are injected at runtime by
# docker-compose; see apps/web/src/lib/config.ts for why neither is NEXT_PUBLIC_*.
CMD ["node", "apps/web/server.js"]
