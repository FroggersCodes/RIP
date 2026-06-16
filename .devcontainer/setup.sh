#!/usr/bin/env bash
# One-time setup for the Codespace: install, migrate, seed, build.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Installing dependencies (also generates the Prisma client)…"
npm install

echo "==> Applying database migrations…"
n=0
until npm --workspace server run migrate:deploy; do
  n=$((n + 1))
  if [ "$n" -ge 10 ]; then
    echo "Database not reachable after $n attempts." >&2
    exit 1
  fi
  echo "   database not ready yet, retrying ($n)…"
  sleep 3
done

echo "==> Seeding teams, players, templates, products…"
npm --workspace server run seed

echo "==> Building the web app…"
npm --workspace web run build

echo "==> Setup complete. The app will auto-start on port 4000 (forwarded to your browser)."
