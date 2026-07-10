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

## CI and the pre-push hook

Every push and pull request runs `.github/workflows/ci.yml`, which has three jobs:

| Job | Covers |
|---|---|
| `check` | cold build (proves the dependency ordering), typecheck, unit tests |
| `worker-smoke` | the BullMQ transport against a real Redis service |
| `e2e` | the HTTP suite against a real Postgres service |

**CI is the gate, and it is enforced.** `main` is a protected branch: all three checks must
pass before a pull request can merge, and the rule applies to admins too. A direct push to
`main` is rejected by the server:

```
remote: error: GH006: Protected branch update failed for refs/heads/main.
remote: - 3 of 3 required status checks are expected.
```

So the workflow is: branch, open a PR, let CI run. `gh pr merge --auto` is enabled and will
merge for you the moment the three jobs go green. `strict` is on, so a branch must be up to
date with `main` before it can merge — rebase if GitHub says the branch is behind.

A `pre-push` hook (`.githooks/pre-push`, installed automatically by the root `prepare`
script) runs `npm run typecheck` and `npm test` when you push to `main`. It skips the e2e
and worker-smoke suites, which need Postgres and Redis; CI covers those. Bypass it with
`SKIP_HOOKS=1 git push`.

The hook is a **convenience, not the gate** — it catches a broken build before you spend a
CI round trip on it. Branch protection is what actually protects `main`.

*(Historical note: while this repo was private on a Free plan, none of this was possible.
The protection and ruleset APIs returned 403, and `PATCH allow_auto_merge=true` returned
200 while silently leaving the value `false`. Making the repo public unlocked all three.)*

## Running apps/web in a container

The default stack (`docker compose up -d postgres redis`) never builds an image. The `web`
service is behind a profile:

```sh
docker compose --profile web up --build web   # http://localhost:3000
```

`apps/api` still runs on the host (`npm run start:dev`), and the web container reaches it in
**two different ways**, which is the one subtlety here:

| Caller | Env var | Value | Why |
|---|---|---|---|
| Browser | `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | Inlined into the client bundle at *build* time; the browser runs on the host. |
| Server Components | `API_URL` | `http://host.docker.internal:3001` | Read at *runtime*. Inside the container `localhost` is the container, not the host. |

`apps/web/src/app/imports/page.tsx` and `games/[id]/box-score/page.tsx` are Server
Components that fetch the API, so without the `API_URL` split they would 500 inside a
container while the client-rendered pages kept working. `API_URL` is deliberately not
`NEXT_PUBLIC_*` — a container-internal hostname must never be baked into a client bundle.

Both default to `localhost:3001`, so running everything on the host needs no env at all.

## Follow-ups (not in this Capability-1 slice)
- An `apps/api` Dockerfile, if/when the API needs to run containerized rather than on the
  host. At that point the `web` service's `API_URL` becomes `http://api:3001` over compose
  DNS, and the `extra_hosts` mapping can go.
- (`apps/worker` is scaffolded but intentionally idle — nothing enqueues in Capability 1.)
- Storage bucket setup (Supabase Storage/S3-compatible) — not needed for Capability 1 since
  uploaded roster files are parsed in-memory and not required to be retained
  (`company-docs/architecture.md` §8).
- Deployment plan, logging/monitoring/backups beyond local dev — out of scope until a
  deployment target is chosen.
