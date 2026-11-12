#!/usr/bin/env bash
# Run the API + built front end in one process (what launchd starts).
set -euo pipefail
APP="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP/backend"
set -a; [ -f "$APP/.env" ] && . "$APP/.env"; set +a
: "${SESSION_SECRET:?SESSION_SECRET missing in lecture-magique/.env}"
# One worker on purpose: the login lockout counter lives in process memory.
# HOST=127.0.0.1 in .env: reachable only from this Mac, i.e. only through the family gateway (/lecture/).
# hosting/run.sh starts this script with LECTURE_HOST/LECTURE_PORT, which win over .env.
exec uv run --frozen uvicorn app.main:app --host "${LECTURE_HOST:-${HOST:-0.0.0.0}}" \
  --port "${LECTURE_PORT:-${PORT:-8090}}" --workers 1
