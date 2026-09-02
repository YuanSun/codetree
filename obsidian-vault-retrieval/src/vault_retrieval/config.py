"""Shared configuration for the indexer, API, and MCP wrapper.

All three processes read the same environment so a single .env can drive
the whole service. Loaded lazily via get_settings() so importing this
module never fails at import time (useful for tests).
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    # Vault
    vault_path: Path

    # Postgres (pgvector)
    database_url: str

    # Embeddings — any OpenAI-compatible /v1/embeddings endpoint (LM Studio,
    # Ollama's OpenAI shim, etc.)
    embedding_api_url: str
    embedding_model: str
    embedding_dim: int

    # HTTP query API
    api_host: str
    api_port: int
    api_base_url: str

    # Indexer behavior
    ignored_folders: list[str] = field(default_factory=list)
    watch_debounce_seconds: float = 2.0
    embedding_batch_size: int = 32


@lru_cache
def get_settings() -> Settings:
    vault_path = os.environ.get("VAULT_PATH")
    if not vault_path:
        raise RuntimeError("VAULT_PATH environment variable is required")

    database_url = os.environ.get(
        "DATABASE_URL",
        # Defaults to a local Postgres instance on the standard port. Using
        # the bundled docker-compose Postgres instead? Override this to
        # port 5433 (see docker-compose.yml).
        "postgresql://vault:vault@localhost:5432/vault",
    )

    api_host = os.environ.get("API_HOST", "127.0.0.1")
    api_port = int(os.environ.get("API_PORT", "8756"))
    api_base_url = os.environ.get("API_BASE_URL", f"http://{api_host}:{api_port}")

    return Settings(
        vault_path=Path(vault_path).expanduser(),
        database_url=database_url,
        embedding_api_url=os.environ.get(
            "EMBEDDING_API_URL", "http://localhost:1234/v1/embeddings"
        ),
        embedding_model=os.environ.get("EMBEDDING_MODEL", "nomic-embed-text"),
        embedding_dim=int(os.environ.get("EMBEDDING_DIM", "768")),
        api_host=api_host,
        api_port=api_port,
        api_base_url=api_base_url,
        ignored_folders=_split_csv(
            os.environ.get("IGNORED_FOLDERS", ".obsidian,.trash,.git")
        ),
        watch_debounce_seconds=float(os.environ.get("WATCH_DEBOUNCE_SECONDS", "2.0")),
        embedding_batch_size=int(os.environ.get("EMBEDDING_BATCH_SIZE", "32")),
    )
