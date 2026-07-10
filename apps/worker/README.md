# @heritage-saturday/worker

BullMQ consumer for the `simulation` queue, sharing `packages/simulation-engine` with
`apps/api` — the same pure engine, no duplicate implementation (architecture.md §35, §560).

## Status: scaffold, intentionally idle

Capability 1 runs simulation **synchronously inside `apps/api`** (architecture.md §545).
Nothing enqueues jobs yet, so a running worker simply waits. It exists now so the queue
contract and engine reuse are settled before the migration, not after.

When simulation moves off the request path (a "long game" or batch-simulate feature),
`GamesService` swaps its `simulateGame(input)` call for `queue.add(SIMULATE_JOB, input)`.
Because `SimulateJobData` *is* `SimulationInput`, that is a call-site change only.

## What this worker deliberately does not do

It does not touch Prisma. Persisting `Game` / `GameEvent` / `TeamGameStats` /
`PlayerGameStats` is one transaction owned by `GamesService` (architecture.md §6, step 3).
Duplicating it here would recreate exactly the duplicate-implementation risk this package
exists to avoid. Whoever moves simulation off the request path moves that persistence too.

## Running

Requires the compose stack's Redis and `REDIS_URL` (see `.env.example`):

```sh
docker compose up -d redis
make worker-dev          # or: npm run start:dev -w @heritage-saturday/worker
```

## Tests

`npm test -w @heritage-saturday/worker` covers the processor without a live Redis: it
asserts the job path is byte-identical to calling the engine directly (no transport drift),
that determinism holds through the queue, and that a missing `REDIS_URL` fails loudly.
