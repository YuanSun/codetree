#!/usr/bin/env bash
# Start the app backends and the Caddy gateway. Ctrl-C stops everything.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(dirname "$HERE")"

. "$HERE/load-env.sh"
load_env "$HERE/.env"
export HOSTING_DIR="$HERE"
export FUND_DIR="$REPO/fund-accounting-academy"
export GATEWAY_PORT="${GATEWAY_PORT:-12999}"
export MATH_PORT="${MATH_PORT:-12998}"
export BUDGET_PORT="${BUDGET_PORT:-12997}"
export LECTURE_PORT="${LECTURE_PORT:-8090}"
export PATH="$HOME/.local/bin:$PATH"   # uv's standalone install location, for the Lecture Magique backend

command -v caddy >/dev/null || { echo "Caddy is not installed. Run: brew install caddy" >&2; exit 1; }
if [ -z "${NOTES_HASH:-}" ]; then
  echo "NOTES_HASH is not set in hosting/.env (needed to protect the family notes)." >&2
  echo "Create one with: caddy hash-password   and put it in hosting/.env" >&2
  exit 1
fi
export NOTES_USER="${NOTES_USER:-family}"
mkdir -p "$HERE/sites/notes"
[ -e "$HERE/sites/notes/index.html" ] || echo "<p>Notes not built yet. Run hosting/build-notes.sh</p>" > "$HERE/sites/notes/index.html"

pids=()
cleanup() { for p in "${pids[@]:-}"; do kill "$p" 2>/dev/null || true; done; }
trap cleanup EXIT INT TERM

( cd "$REPO/MathCompetition" && exec python3 server.py --host 127.0.0.1 --port "$MATH_PORT" --base-path /math ) &
pids+=($!)

# Family budget dashboard: needs its Python deps (prefers its own .venv) and the Postgres in its .env.
BUDGET_DIR="$REPO/budget-advisor/budget-dashboard"
if "$BUDGET_DIR/.venv/bin/streamlit" --version >/dev/null 2>&1; then STREAMLIT="$BUDGET_DIR/.venv/bin/streamlit"
else STREAMLIT="$(command -v streamlit || true)"; fi
if [ -n "$STREAMLIT" ] && [ -f "$BUDGET_DIR/.env" ]; then
  ( cd "$BUDGET_DIR" && exec "$STREAMLIT" run app.py --server.address 127.0.0.1 --server.port "$BUDGET_PORT" \
      --server.baseUrlPath budget --server.headless true --browser.gatherUsageStats false ) &
  pids+=($!)
else
  echo "Skipping /budget/: need streamlit installed and $BUDGET_DIR/.env (see budget-advisor/budget-dashboard/README.md)." >&2
fi

# Lecture Magique (FastAPI): started here on 127.0.0.1, so it is reachable only through /lecture/.
# Needs its .env and a built front end (lecture-magique/SETUP.md). If it already runs as its own launchd
# service on the same port (RUN_BY not set to gateway), the gateway just proxies to that one.
LECTURE_DIR="$REPO/lecture-magique"
if curl -fs "http://127.0.0.1:$LECTURE_PORT/api/health" >/dev/null 2>&1; then
  echo "Lecture Magique already running on :$LECTURE_PORT (its own service); /lecture/ will use it." >&2
elif [ -f "$LECTURE_DIR/.env" ] && [ -f "$LECTURE_DIR/frontend/dist/index.html" ] && command -v uv >/dev/null; then
  ( LECTURE_HOST=127.0.0.1 exec "$LECTURE_DIR/deploy/run.sh" ) &
  pids+=($!)
else
  echo "Skipping /lecture/: need uv, $LECTURE_DIR/.env and a built front end (see lecture-magique/SETUP.md)." >&2
fi

echo "Gateway on port $GATEWAY_PORT: http://<this-machine>:$GATEWAY_PORT/  (/fund/  /math/  /math/study/  /notes/  /budget/  /lecture/)"
caddy run --config "$HERE/Caddyfile" --adapter caddyfile
