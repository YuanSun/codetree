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

### Talent vs Luck

A code implementation of the agent-based model from Pluchino, Biondo &
Rapisarda (2018), *"Talent vs. Luck: The Role of Randomness in Success and
Failure"* (arXiv:1802.07068) — normally-distributed talent plus random
lucky/unlucky events over a 40-year career produces a heavily unequal,
Pareto-like wealth distribution, and the wealthiest agents are usually not
the most talented ones.

- **Location**: `talent-vs-luck/`
- **Status**: Both implementations complete and tested
- **Tech Stack**: Python, NumPy, Pygame, Matplotlib

See [talent-vs-luck/README.md](talent-vs-luck/README.md) for more details.
Includes `simulation/`, a fully vectorized NumPy Monte Carlo model for fast
batch statistics, and `spatial_sim/`, a Pygame recreation of the paper's
literal 2D grid mechanic with a live dashboard where you can click any
agent to inspect it. Both save a numeric JSON report and a self-contained,
interactive HTML report letting you browse any agent's full life story.

## Structure

Each subdirectory contains a self-contained project with its own documentation and dependencies.