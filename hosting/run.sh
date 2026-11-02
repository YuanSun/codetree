#!/usr/bin/env bash
# Start the app backends and the Caddy gateway. Ctrl-C stops everything.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(dirname "$HERE")"

if [ -f "$HERE/.env" ]; then set -a; . "$HERE/.env"; set +a; fi
export HOSTING_DIR="$HERE"
export FUND_DIR="$REPO/fund-accounting-academy"
export DOMAIN="${DOMAIN:-localhost}"
export GATEWAY_PORT="${GATEWAY_PORT:-8080}"
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

( cd "$REPO/MathCompetition" && exec python3 server.py --host 127.0.0.1 --port "$MATH_PORT" ) &
pids+=($!)

echo "Gateway on http://$DOMAIN:$GATEWAY_PORT  (math.$DOMAIN, fund.$DOMAIN, notes.$DOMAIN)"
caddy run --config "$HERE/Caddyfile" --adapter caddyfile
