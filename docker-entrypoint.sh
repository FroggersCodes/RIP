#!/bin/sh
# Container start: apply migrations, seed only if the DB is empty, then run.
set -e

echo "==> Applying database migrations..."
npm --workspace server run migrate:deploy

echo "==> Seeding if the database is empty..."
npm --workspace server run seed:ifempty

echo "==> Starting RIP..."
exec npm --workspace server run start
