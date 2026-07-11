# Build context is the REPO ROOT, not apps/api: this is an npm-workspaces monorepo and the
# API imports packages/{shared,importers,validation,simulation-engine} from their dist/.
#
#   docker compose --profile api up --build api
#
# Debian slim rather than Alpine on purpose. schema.prisma sets no `binaryTargets`, so the
# query engine is chosen at `prisma generate` time for the platform it runs on. Generating
# inside this image gets the right one — but on Alpine that means the musl engine plus an
# OpenSSL that Prisma 5 is picky about. Debian avoids the whole class of problem; `openssl`
# is installed explicitly because the slim image does not ship it.
#
# syntax=docker/dockerfile:1

# ---- builder -----------------------------------------------------------------
FROM node:24-bookworm-slim AS builder
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Manifests first so `npm ci` stays cached until a dependency actually changes. Every
# workspace's package.json must exist or npm refuses to resolve the lockfile.
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/worker/package.json ./apps/worker/
COPY packages/shared/package.json ./packages/shared/
COPY packages/importers/package.json ./packages/importers/
COPY packages/simulation-engine/package.json ./packages/simulation-engine/
COPY packages/validation/package.json ./packages/validation/

# The root `prepare` script shells out to git; it is guarded, and there is no .git here.
RUN npm ci

COPY packages ./packages
COPY apps/api ./apps/api

# Belt and braces: .dockerignore excludes these, but a stale tsbuildinfo makes
# `tsc --incremental` skip emitting .js entirely and the image crash-loops on a missing
# dist/main.js. A build cache that silently claims the work is done is not worth trusting
# to one ignore rule.
RUN find . -name '*.tsbuildinfo' -not -path './node_modules/*' -delete

# Dependency order matters: `--workspaces` is alphabetical and would build apps/* first.
RUN npm run build:packages

# Generate before `nest build`: apps/api's TypeScript imports @prisma/client's types.
RUN npm run prisma:generate -w @heritage-saturday/api
RUN npm run build -w @heritage-saturday/api

# ---- runtime -----------------------------------------------------------------
FROM node:24-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd -g 1001 nodejs \
  && useradd -u 1001 -g nodejs -m nestjs

# node_modules is copied wholesale rather than reinstalled with --omit=dev. The generated
# Prisma client lives in node_modules/.prisma, and regenerating it in the runtime stage
# would mean shipping the prisma CLI (a devDependency) anyway. Keeping it also lets
# `prisma migrate deploy` run against this image.
#
# The cost is real: ~1.6GB, because npm hoists every workspace's dependencies to the root
# node_modules — so this image carries next, the Nest CLI, and typescript even though the
# API needs none of them at runtime. Acceptable for a local-dev container. Slimming it means
# installing only apps/api's production deps in the runtime stage and copying the generated
# client across; do that before this image goes anywhere near a deployment.
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nestjs:nodejs /app/packages ./packages
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./apps/api/
# Schema + migrations ship so `prisma migrate deploy` can run against this image.
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/prisma ./apps/api/prisma
# Deploy entrypoint (migrate + start) for hosts that run migrations at deploy time. Not the
# default CMD — see the script's header and the note below.
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/docker-entrypoint.sh ./apps/api/docker-entrypoint.sh

USER nestjs
EXPOSE 3001

# Migrations are NOT run on start: that would couple every container restart to a schema
# write, and racing replicas is how you corrupt a migration table. Run them explicitly:
#   docker compose --profile api run --rm api npx prisma migrate deploy
# or from the host with `make db-migrate`.
CMD ["node", "apps/api/dist/main.js"]
