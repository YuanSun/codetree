# Obsidian Vault Embedding & Retrieval Service

A standalone semantic search service over an Obsidian vault, so multiple AI
clients (Zed, Claude Desktop, others) can query the same index instead of
each building their own. Read-only for now: `search_vault` and `get_note`.

Built for a vault around 3,800 notes / ~28MB of markdown text — small
enough that pgvector on a single Postgres instance is plenty; no dedicated
vector DB needed.

## Architecture

```
                    ┌─────────────┐
   vault (disk)  →  │   Indexer   │  →  Postgres + pgvector
                    │ watch/scan  │       (notes, chunks, embeddings)
                    └─────────────┘              │
                                                  │
                    ┌─────────────┐               │
   MCP clients   →  │ MCP wrapper │ → HTTP → │ Query API (FastAPI) │
  (Zed, Claude      │  (stdio)    │          └─────────────────────┘
   Desktop, ...)     └─────────────┘
```

1. **Indexer** (`vault_retrieval.indexer`) — walks the vault, chunks each
   note by its `##`/`###` section structure, embeds each chunk, and
   upserts into Postgres. Tracks a SHA-256 content hash per note so
   unchanged notes are skipped on re-scan. `scan` mode does a one-shot
   backfill; `watch` mode additionally watches the filesystem and
   re-indexes on save (debounced).
2. **Query API** (`vault_retrieval.api`) — a small FastAPI service
   exposing `POST /search` and `GET /notes/{path}` over HTTP. This is
   where all retrieval logic lives, once, regardless of how many clients
   query it.
3. **MCP wrapper** (`vault_retrieval.mcp`) — a thin stdio MCP server that
   calls the HTTP API and returns the JSON as tool output. Stdio because
   that's the only transport Zed currently speaks; the per-client
   footprint is intentionally this one small process, not a
   reimplementation of search.

## Why this stack

- **Storage: pgvector.** Already running Postgres elsewhere in this repo
  (see `budget-advisor/`); at tens of thousands of chunks a dedicated
  vector DB (Qdrant, Chroma, ...) isn't warranted.
- **Embeddings: local, via an OpenAI-compatible endpoint** (LM Studio,
  Ollama's OpenAI shim, ...). LM Studio's chat models (`gpt-oss-20b`,
  `qwen3-vl-30b`) don't serve embeddings — point `EMBEDDING_API_URL` at a
  dedicated embedding model (`nomic-embed-text`, `bge-small`, ...) loaded
  on its own port, and make sure `EMBEDDING_DIM` matches its output size.
- **Chunking: by `##`/`###` header**, not fixed token windows. The
  note-writer skill already produces a consistent section shape (core
  concept / how it works / application guidance), so header-based
  chunking keeps each chunk a coherent, citable unit instead of an
  arbitrary token slice.

## Setup

### 1. Postgres

```bash
docker compose up -d postgres
```

Uses host port `5433` (not `5432`) to avoid clashing with any other local
Postgres. See `docker-compose.yml`.

### 2. Configure

```bash
cp .env.example .env
```

Set at minimum `VAULT_PATH` (your vault's root directory), and confirm
`EMBEDDING_API_URL` / `EMBEDDING_MODEL` / `EMBEDDING_DIM` match whichever
model LM Studio is serving embeddings from.

### 3. Install and initialize the schema

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
set -a; source .env; set +a
python scripts/init_db.py
```

`init_db.py` creates the `vector` extension, `notes`/`chunks` tables, and
an HNSW cosine index, with the vector column sized from `EMBEDDING_DIM`.

### 4. Backfill the index

```bash
python -m vault_retrieval.indexer.cli scan
```

Or `scan` followed by continuous watching:

```bash
python -m vault_retrieval.indexer.cli watch
```

### 5. Run the query API

```bash
uvicorn vault_retrieval.api.main:app --host 127.0.0.1 --port 8756
```

```bash
curl -s localhost:8756/search -X POST -H 'content-type: application/json' \
  -d '{"query": "spaced repetition", "top_k": 3}' | jq
```

### 6. Point an MCP client at the wrapper

The wrapper only needs `API_BASE_URL` (and `VAULT_PATH`, currently
unused by the wrapper itself but required by shared config loading) —
run it against the same `.env`, or export the handful of vars directly.

Zed (`~/.config/zed/settings.json`):

```json
{
  "context_servers": {
    "obsidian-vault-search": {
      "command": {
        "path": "/path/to/obsidian-vault-retrieval/.venv/bin/python",
        "args": ["-m", "vault_retrieval.mcp.server"],
        "env": { "API_BASE_URL": "http://127.0.0.1:8756", "VAULT_PATH": "/path/to/vault" }
      }
    }
  }
}
```

Claude Desktop (`claude_desktop_config.json`) follows the same shape
under `mcpServers`.

## MCP tool contract

- `search_vault(query, top_k=5, tags=[], folder=None)` → ranked chunks,
  each with note path, section title, header breadcrumb, and similarity
  score.
- `get_note(path)` → full note content, read live from disk (so it's
  always current even if the index hasn't caught up yet).

## Status / phasing

Read-only, as planned: `search_vault` + `get_note` only. No write tools
(create/update/delete) are exposed yet.

## Testing

```bash
pytest -v
```

Unit tests cover the chunker (header splitting, frontmatter parsing,
edge cases) and hashing — the pure-function core that doesn't need a
running Postgres or embedding model. The indexer/API/MCP wiring is
scaffolded and import-clean but hasn't been exercised end-to-end against
a real Postgres + LM Studio instance; treat `db.py`, `scan.py`,
`watch.py`, `api/main.py`, and `mcp/server.py` as reviewed-but-untested
until run against the real vault.

## Repo layout

```
obsidian-vault-retrieval/
├── docker-compose.yml       # pgvector Postgres for local dev
├── db/schema.sql.tmpl        # schema, templated on EMBEDDING_DIM
├── scripts/init_db.py         # one-shot schema setup
├── src/vault_retrieval/
│   ├── config.py                # shared env-based settings
│   ├── chunker.py                # H2/H3 section chunking + frontmatter
│   ├── hashing.py                  # content-hash change detection
│   ├── embeddings.py                # OpenAI-compatible embeddings client
│   ├── db.py                          # pgvector reads/writes
│   ├── indexer/                        # scan / watch / CLI
│   ├── api/                             # FastAPI query service
│   └── mcp/                              # stdio MCP wrapper
└── tests/
```
