#!/usr/bin/env bash
# Publish the family Obsidian vault as a static website using Quartz (https://quartz.jzhao.xyz).
# Re-run whenever the notes change (or schedule it). Needs Node 22+ and git.
#   VAULT=/path/to/family-vault ./build-notes.sh
# To publish only some folders of the vault, list them (relative to VAULT, separated by commas):
#   VAULT_DIRS="Family,Recipes,Travel/2025" ./build-notes.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$HERE/load-env.sh"
load_env "$HERE/.env"
VAULT="${VAULT:?Set VAULT to the family Obsidian vault folder (in hosting/.env or the environment)}"
VAULT_DIRS="${VAULT_DIRS:-}"
QUARTZ="$HERE/.quartz"

[ -d "$VAULT" ] || { echo "Vault not found: $VAULT" >&2; exit 1; }
[ -d "$QUARTZ" ] || git clone --depth 1 https://github.com/jackyzha0/quartz.git "$QUARTZ"
( cd "$QUARTZ" && npm ci --silent )
# Content to publish: the whole vault, or a copy holding only the chosen folders.
# (Hidden folders such as .obsidian and .trash are never copied.)
CONTENT="$VAULT"
if [ -n "$VAULT_DIRS" ]; then
  # Must be OUTSIDE the repo: Quartz honours .gitignore, and hosting/sites/ is ignored, so it would see 0 files.
  CONTENT="$(mktemp -d "${TMPDIR:-/tmp}/notes-content.XXXXXX")"
  trap 'rm -rf "$CONTENT"' EXIT
  IFS=',' read -r -a dirs <<< "$VAULT_DIRS"
  for d in "${dirs[@]}"; do
    d="$(echo "$d" | sed 's#^ *##; s# *$##; s#/*$##')"
    [ -n "$d" ] || continue
    [ -d "$VAULT/$d" ] || { echo "Folder not found in vault: $d" >&2; exit 1; }
    mkdir -p "$CONTENT/$(dirname "$d")"
    rsync -a --exclude '.*' "$VAULT/$d" "$CONTENT/$(dirname "$d")/"
  done
  [ -e "$CONTENT/index.md" ] || printf '# Family Notes\n' > "$CONTENT/index.md"
  echo "Publishing only: $VAULT_DIRS"
fi
# Build into a temp dir, then swap, so the live site is never half-written.
OUT="$HERE/sites/notes.new"
rm -rf "$OUT"
( cd "$QUARTZ" && npx quartz build --directory "$CONTENT" --output "$OUT" )
rm -rf "$HERE/sites/notes.old"
[ -d "$HERE/sites/notes" ] && mv "$HERE/sites/notes" "$HERE/sites/notes.old"
mv "$OUT" "$HERE/sites/notes"
rm -rf "$HERE/sites/notes.old"
echo "Notes published to $HERE/sites/notes"
