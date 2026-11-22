#!/usr/bin/env bash
# This week's book, in one command: unpack, build the pack, check it, import it, publish it.
#
#   tools/weekly.sh <book>                 content/<book>.txt (+ .questions.json, images/<book>/) already in place
#   tools/weekly.sh path/to/<book>.zip     unpack the zip Claude made into content/ first
#   options: --publish (don't ask)  --draft (import only, publish later)
#
# A book Grace has not opened yet is imported in full (text, words, pictures, questions).
# A book she has already read or answered keeps its text: only its questions and pictures are refreshed,
# so her taps and answers stay attached.
set -euo pipefail
APP="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTENT="$APP/content"
say() { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }
die() { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

arg="" publish=ask
for a in "$@"; do
  case "$a" in
    --publish) publish=yes ;;
    --draft) publish=no ;;
    -h|--help) sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*) die "unknown option $a" ;;
    *) [ -z "$arg" ] || die "one book at a time"; arg="$a" ;;
  esac
done
[ -n "$arg" ] || die "usage: tools/weekly.sh <book | book.zip> [--publish | --draft]"
command -v uv >/dev/null || die "uv is not installed (or not on PATH): brew install uv"
mkdir -p "$CONTENT"

if [[ "$arg" == *.zip ]]; then
  [ -f "$arg" ] || die "no such file: $arg"
  files=$(unzip -Z1 "$arg")
  txt=$(grep -E '(^|/)[^/]+\.txt$' <<<"$files" | head -1) || true
  [ -n "$txt" ] || die "$arg has no <book>.txt"
  book=$(basename "$txt" .txt)
  # zips hold either content/<book>.txt … or <book>.txt … at their root
  if grep -q '^content/' <<<"$files"; then dest="$APP"; else dest="$CONTENT"; fi
  say "unpacking $(basename "$arg") ($(wc -l <<<"$files" | tr -d ' ') files) into content/"
  unzip -oq "$arg" -d "$dest"
else
  book=$(basename "$arg" .txt)
fi

TXT="$CONTENT/$book.txt" Q="$CONTENT/$book.questions.json" PACK="$CONTENT/$book.pack.json"
[ -f "$TXT" ] || die "missing $TXT"
if [ -f "$Q" ]; then qargs=("$Q"); else qargs=(); echo "  (no $book.questions.json: the book will have no questions)"; fi

say "building the pack (also checks every evidence quote against the text)"
python3 "$APP/tools/text2pack.py" "$TXT" "${qargs[@]}" -o "$PACK"
slug=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["slug"])' "$PACK")

cd "$APP/backend"
say "importing $slug"
set +e
out=$(uv run --frozen python -m importer.article import "$PACK" 2>&1)
rc=$?
set -e
echo "$out" | grep -v UV_NATIVE_TLS || true
if [ $rc -ne 0 ]; then
  if grep -q "already point at this article" <<<"$out"; then
    say "Grace has already started this book: refreshing only its questions and pictures"
    uv run --frozen python -m importer.article questions "$PACK" 2>&1 | grep -v UV_NATIVE_TLS
    uv run --frozen python -m importer.article images "$PACK" 2>&1 | grep -v UV_NATIVE_TLS
    echo "  (its text was not changed; it stays published)"
    exit 0
  fi
  die "import refused (see above)"
fi

case "$publish" in
  yes) ;;
  no) echo; echo "Draft. Publish later with: cd backend && uv run python -m importer.article publish $slug"; exit 0 ;;
  ask)
    if [ ! -t 0 ]; then echo; echo "Draft (no terminal to ask). Publish with: tools/weekly.sh $book --publish"; exit 0; fi
    echo
    echo "Check the coverage above (unmatched words should be mostly names). Log in as a parent to read it if you like."
    read -r -p "Publish '$slug' for Grace now? [y/N] " ans
    [[ "$ans" =~ ^[YyOo] ]] || { echo "Left as a draft. Publish later with: tools/weekly.sh $book --publish"; exit 0; }
    ;;
esac
uv run --frozen python -m importer.article publish "$slug" 2>&1 | grep -v UV_NATIVE_TLS
say "done: Grace sees it on her shelf"
