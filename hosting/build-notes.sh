#!/usr/bin/env bash
# Publish the family Obsidian vault as a static website using Quartz (https://quartz.jzhao.xyz).
# Re-run whenever the notes change (or schedule it). Needs Node 22+ and git.
#   VAULT=/path/to/family-vault ./build-notes.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$HERE/.env" ]; then set -a; . "$HERE/.env"; set +a; fi
VAULT="${VAULT:?Set VAULT to the family Obsidian vault folder (in hosting/.env or the environment)}"
QUARTZ="$HERE/.quartz"

[ -d "$VAULT" ] || { echo "Vault not found: $VAULT" >&2; exit 1; }
[ -d "$QUARTZ" ] || git clone --depth 1 https://github.com/jackyzha0/quartz.git "$QUARTZ"
( cd "$QUARTZ" && npm ci --silent )
# Build into a temp dir, then swap, so the live site is never half-written.
OUT="$HERE/sites/notes.new"
rm -rf "$OUT"
( cd "$QUARTZ" && npx quartz build --directory "$VAULT" --output "$OUT" )
rm -rf "$HERE/sites/notes.old"
[ -d "$HERE/sites/notes" ] && mv "$HERE/sites/notes" "$HERE/sites/notes.old"
mv "$OUT" "$HERE/sites/notes"
rm -rf "$HERE/sites/notes.old"
echo "Notes published to $HERE/sites/notes"
