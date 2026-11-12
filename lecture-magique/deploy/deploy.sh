#!/usr/bin/env bash
# Build and (re)start Lecture Magique on the Mac Studio.
#   deploy/deploy.sh            build front end, sync deps, migrate, (re)start the launchd service
#   deploy/deploy.sh --no-build skip the npm build (backend-only change)
set -euo pipefail
APP="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABEL=com.lecture-magique
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

[ -f "$APP/.env" ] || { echo "Missing $APP/.env — copy deploy/env.example and fill it in." >&2; exit 1; }
command -v uv >/dev/null || { echo "uv is not installed (or not on PATH): brew install uv" >&2; exit 1; }
case "$APP" in
  "$HOME/Documents"*|"$HOME/Desktop"*|"$HOME/Downloads"*|"$HOME/Library/Mobile Documents"*)
    echo "This folder ($APP) is protected by macOS: the launchd service could not read it." >&2
    echo "Clone the repo somewhere like ~/Projects and deploy from there (see SETUP.md)." >&2
    exit 1 ;;
esac

if [ "${1:-}" != "--no-build" ]; then
  echo "▸ building front end"
  (cd "$APP/frontend" && npm ci --no-audit --no-fund && npm run build)
fi

echo "▸ syncing Python deps"
(cd "$APP/backend" && uv sync --frozen)

echo "▸ migrating the lecture schema (DATABASE_ADMIN_URL)"
# python -m alembic (not the alembic script) keeps working even if .venv was moved or copied
(cd "$APP/backend" && uv run --frozen python -m alembic upgrade head)

echo "▸ installing launchd service"
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
sed -e "s#__APP__#$APP#g" -e "s#__HOME__#$HOME#g" "$APP/deploy/$LABEL.plist" > "$PLIST"
chmod +x "$APP/deploy/run.sh"
if launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then
  launchctl bootout "gui/$(id -u)/$LABEL" || true
fi
launchctl bootstrap "gui/$(id -u)" "$PLIST"

PORT="$(grep -E '^PORT=' "$APP/.env" | cut -d= -f2 || true)"; PORT="${PORT:-8090}"
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fs "http://127.0.0.1:$PORT/api/health" >/dev/null; then
    echo "✓ running: http://$(scutil --get LocalHostName 2>/dev/null || hostname).local:$PORT/"
    exit 0
  fi
  sleep 1
done
echo "✗ not answering yet — see ~/Library/Logs/lecture-magique.log" >&2
exit 1
