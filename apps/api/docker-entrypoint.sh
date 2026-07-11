#!/bin/sh
# Deployment entrypoint: apply pending migrations, then start the API.
#
# This is NOT the image's default CMD (that stays `node apps/api/dist/main.js`, so local
# `docker compose` never couples a container start to a schema write). It exists for hosts
# like Render that run migrations at deploy time on a single instance: point the platform's
# start command at this script. If you ever run multiple replicas, migrate in a pre-deploy
# step instead so replicas don't race the migration table.
set -e
cd /app
node_modules/.bin/prisma migrate deploy --schema apps/api/prisma/schema.prisma
exec node apps/api/dist/main.js
