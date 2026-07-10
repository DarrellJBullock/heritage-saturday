# Heritage Saturday — local dev convenience commands (Capability 1 scope)
# Local Docker Compose only; no cloud provider/IaC involved.

.PHONY: db-up db-down db-stop db-migrate db-status db-seed db-reset worker-dev

## Start Postgres + Redis in the background
db-up:
	docker compose up -d postgres redis

## Stop and remove containers + volumes (wipes the database)
db-down:
	docker compose down -v

## Stop containers, keep data/volumes
db-stop:
	docker compose stop

## Run Prisma migrations against the running Postgres container
db-migrate:
	cd apps/api && npx prisma migrate dev

## Show Prisma migration status
db-status:
	cd apps/api && npx prisma migrate status

## Seed the stub-auth User rows the API and e2e suite require (idempotent)
db-seed:
	cd apps/api && npx prisma db seed

## Run the BullMQ simulation worker (needs `docker compose up -d redis` + REDIS_URL).
## Cap 1 enqueues nothing, so this idles by design — see apps/worker/README.md.
worker-dev:
	npm run start:dev -w @heritage-saturday/worker

## Full reset: wipe volumes, bring services back up, re-run migrations, reseed
db-reset: db-down db-up
	sleep 3
	$(MAKE) db-migrate
	$(MAKE) db-seed
