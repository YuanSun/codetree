# codetree

A collection of personal projects and experiments.

## Projects

### Budget Advisor

An AI-powered personal finance advisor that analyzes budget data and provides weekly financial advice.

- **Location**: `budget-advisor/`
- **Status**: PostgreSQL MCP Server implemented
- **Tech Stack**: Ollama, PostgreSQL, MCP, Email/SMS

See [budget-advisor/README.md](budget-advisor/README.md) for more details. Includes `budget-dashboard/`, a Streamlit page for browsing the expense/income data, uploading receipts, and building pivot-table style summaries — see [budget-advisor/budget-dashboard/README.md](budget-advisor/budget-dashboard/README.md).

### Obsidian Vault Embedding & Retrieval Service

A standalone service that embeds an Obsidian vault into pgvector so multiple AI clients (Zed, Claude Desktop, others) can semantically search it via MCP instead of each building their own index. Indexer (watch/chunk/embed/upsert), a FastAPI query service, and a thin stdio MCP wrapper exposing `search_vault` / `get_note`.

- **Location**: `obsidian-vault-retrieval/`
- **Status**: Scaffolded — chunker/hashing unit-tested, indexer/API/MCP wiring not yet run against a live Postgres + LM Studio
- **Tech Stack**: Python, FastAPI, Postgres/pgvector, MCP

See [obsidian-vault-retrieval/README.md](obsidian-vault-retrieval/README.md) for more details. Distinct from `obsidian-mcp-server/`, which wraps Obsidian's Local REST API plugin for live CRUD + keyword search rather than semantic search over an embedded index.

## Structure

Each subdirectory contains a self-contained project with its own documentation and dependencies.