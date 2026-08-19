#!/usr/bin/env python3
"""Creates the pgvector schema (extension, tables, indexes) if missing.

Run once after `docker compose up -d postgres` (or against any Postgres
with the pgvector extension available):

    python scripts/init_db.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import psycopg

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from vault_retrieval.config import get_settings  # noqa: E402

SCHEMA_TEMPLATE = Path(__file__).resolve().parent.parent / "db" / "schema.sql.tmpl"


def main() -> None:
    settings = get_settings()
    sql = SCHEMA_TEMPLATE.read_text().format(embedding_dim=settings.embedding_dim)

    with psycopg.connect(settings.database_url, autocommit=True) as conn:
        conn.execute(sql)

    print(
        f"Schema ready at {settings.database_url} "
        f"(embedding_dim={settings.embedding_dim})"
    )


if __name__ == "__main__":
    main()
