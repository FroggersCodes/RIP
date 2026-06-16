#!/usr/bin/env bash
# Runs on every Codespace start: launch RIP on a single port (4000) serving the
# built web app + API. Idempotent — won't double-start.
set -euo pipefail
cd "$(dirname "$0")/.."

if pgrep -f "tsx src/index.ts" >/dev/null 2>&1; then
  echo "RIP is already running on http://localhost:4000"
  exit 0
fi

# Make sure the web build exists so the server can serve it.
if [ ! -f web/dist/index.html ]; then
  npm --workspace web run build || true
fi

echo "Starting RIP on http://localhost:4000 …"
SERVE_WEB=true nohup npm --workspace server run start > /tmp/rip.log 2>&1 &
echo "Logs: /tmp/rip.log   (for live-reload development instead, run: npm run dev)"
