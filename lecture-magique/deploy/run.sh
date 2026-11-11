#!/usr/bin/env bash
# Run the API + built front end in one process (what launchd starts).
set -euo pipefail
APP="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP/backend"
set -a; [ -f "$APP/.env" ] && . "$APP/.env"; set +a
: "${SESSION_SECRET:?SESSION_SECRET missing in lecture-magique/.env}"
# One worker on purpose: the login lockout counter lives in process memory.
exec uv run --frozen uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8090}" --workers 1
