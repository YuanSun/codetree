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

echo "Gateway on port $GATEWAY_PORT: http://<this-machine>:$GATEWAY_PORT/  (/fund/  /math/  /notes/)"
caddy run --config "$HERE/Caddyfile" --adapter caddyfile
