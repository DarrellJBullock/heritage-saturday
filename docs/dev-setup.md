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

`apps/api` still runs on the host (`npm run start:dev`), and **nothing in the browser ever
addresses it directly**, which is the one subtlety here:

| Caller | How it reaches the API | Why |
|---|---|---|
| Browser | `/api/proxy/*` on its own origin | The API is gated by `API_SHARED_SECRET`, which cannot ship in a client bundle. The proxy route attaches it server-side. |
| Server Components | `API_URL`, default `http://host.docker.internal:3001` | Read at *runtime*. Inside the container `localhost` is the container, not the host. |

`apps/web/src/app/imports/page.tsx` and `games/[id]/box-score/page.tsx` are Server
Components that fetch the API, so without `API_URL` they would 500 inside a container while
the client-rendered pages kept working. `API_URL` is deliberately not `NEXT_PUBLIC_*` — it is
paired with the secret, and a container-internal hostname must never reach a client bundle.

`API_URL` defaults to `localhost:3001`, so running everything on the host needs no env at all.

### Locking the API

The API trusts an `x-user-id` header (`AuthStubMiddleware`), so any caller can claim any
identity. That is fine on localhost and unacceptable on a reachable host. `ApiKeyMiddleware`
gates the API behind `API_SHARED_SECRET`, and with `NODE_ENV=production` the API **refuses to
boot** without it — a forgotten env var must not silently publish an open API. Set
`ALLOW_INSECURE_NO_API_KEY=true` to override deliberately; the local `api` compose service
does, since it is only reachable on a private network. CI does not — it runs both containers
with a real secret, so the gate is exercised the way it ships.

When the secret is set, give `apps/web` the same value so its proxy and Server Components can
present it. Local development leaves it unset entirely and the API logs a warning instead.

## Running apps/api in a container

Also profile-gated, so the default stack still builds nothing:

```sh
docker compose --profile api up --build api            # http://localhost:3001
docker compose --profile api run --rm api \
  npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
```

Migrations are deliberately **not** run on container start: coupling every restart to a
schema write is how concurrent replicas corrupt the migration table. Run them explicitly
with the command above, or from the host with `make db-migrate`.

The image is Debian slim, not Alpine. `schema.prisma` sets no `binaryTargets`, so Prisma
picks its query engine at `prisma generate` time for whatever platform it runs on — which
is why generate happens inside the image. On Alpine that would mean the musl engine and an
OpenSSL that Prisma 5 is fussy about; Debian sidesteps the whole class of problem.

It weighs ~1.6GB, because npm hoists every workspace's dependencies to the root
`node_modules`, so the runtime stage carries `next`, the Nest CLI, and `typescript` despite
needing none of them. Fine for local dev; slim it before deploying anywhere.

### Running the whole stack in containers

```sh
WEB_API_URL=http://api:3001 docker compose --profile api --profile web up --build
```

`web`'s `API_URL` then points at the `api` service over compose DNS instead of
`host.docker.internal`, and the `extra_hosts` mapping is unused.

## Follow-ups (not in this Capability-1 slice)
- Slim the API runtime image: install only `apps/api`'s production dependencies in the
  runtime stage and copy the generated Prisma client across.
- (`apps/worker` is scaffolded but intentionally idle — nothing enqueues in Capability 1.)
- Storage bucket setup (Supabase Storage/S3-compatible) — not needed for Capability 1 since
  uploaded roster files are parsed in-memory and not required to be retained
  (`company-docs/architecture.md` §8).
- Deployment plan, logging/monitoring/backups beyond local dev — out of scope until a
  deployment target is chosen.
