# Local Development Setup — Heritage Saturday (Capability 1)

Scope: this covers what's needed to run `apps/api` end-to-end against a local Postgres/Redis
for Capability 1 (roster import + basic game simulation). `apps/worker` and `apps/web` are not
scaffolded yet, so they aren't part of this stack — see `docker-compose.yml` for the plan to
add them later.

## Prerequisites
- Docker Desktop (or another Docker-compatible engine) running locally.
- Node.js + npm (workspace-based monorepo — see root `package.json`).

## 1. Clone and install
```bash
git clone <repo-url> heritage-saturday
cd heritage-saturday
npm install
```

## 2. Start Postgres + Redis
```bash
cp .env.example .env          # optional, for reference — docker-compose.yml has the values inlined
docker compose up -d postgres redis
docker compose ps             # wait until both show "healthy"
```

**Port note:** Postgres is mapped to host port **5433**, not the default 5432. Many dev
machines already run a local Postgres on 5432, which silently shadows Docker's port-forward
on `127.0.0.1`/`::1` — this was hit and confirmed while standing up this stack. If you don't
have a conflicting local Postgres, you can change the mapping back to `5432:5432` in
`docker-compose.yml`, just update `DATABASE_URL` in `apps/api/.env` to match.

## 3. Configure apps/api environment
```bash
cd apps/api
cp .env.example .env
```
`apps/api/.env.example` already matches the Docker Compose Postgres credentials
(`heritage` / `heritage` / `heritage_saturday` on port 5433) and includes `REDIS_URL`
(reserved for `apps/worker`, not consumed by the API in Capability 1 since simulation runs
synchronously per `company-docs/architecture.md` §6).

## 4. Run the Prisma migration
```bash
# from apps/api
npx prisma migrate dev --name init
```
This creates `apps/api/prisma/migrations/<timestamp>_init/migration.sql` and applies it to
the running Postgres container, then regenerates the Prisma Client.

To check sync status at any time:
```bash
npx prisma migrate status
```

## 5. Seed data
**Not available yet.** No seed script exists in this capability slice — this is a known
follow-up (see vision.md's DevOps section, which calls for a seed script as part of the full
stack). Once one exists (likely `apps/api/prisma/seed.ts` wired via Prisma's `seed` config),
document the command here and add a `db:seed` convenience target to the Makefile.

## 6. Run the API
```bash
# from apps/api
npm run start:dev
```
This runs NestJS directly on the host (not containerized — there is no `apps/api`
Dockerfile yet). It connects to Postgres/Redis in Docker over `localhost:5433` /
`localhost:6379`.

## Tearing down / resetting
```bash
# stop containers, keep data
docker compose stop

# stop and remove containers + volumes (wipes the database)
docker compose down -v
```

## Convenience commands
See the root `Makefile` for shortcuts: `make db-up`, `make db-down`, `make db-migrate`,
`make db-reset`, `make db-status`.

## Follow-ups (not in this Capability-1 slice)
- `apps/worker` and `apps/web` service definitions in `docker-compose.yml` once those apps
  are scaffolded.
- An `apps/api` Dockerfile, if/when the API needs to run containerized rather than on the host.
- Seed script + `db:seed` command.
- Storage bucket setup (Supabase Storage/S3-compatible) — not needed for Capability 1 since
  uploaded roster files are parsed in-memory and not required to be retained
  (`company-docs/architecture.md` §8).
- Deployment plan, logging/monitoring/backups beyond local dev — out of scope until a
  deployment target is chosen.
