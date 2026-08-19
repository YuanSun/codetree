#!/usr/bin/env python3
"""Indexer entrypoint.

    python -m vault_retrieval.indexer.cli scan    # one-shot backfill, then exit
    python -m vault_retrieval.indexer.cli watch    # scan once, then watch for changes
"""

from __future__ import annotations

import argparse
import logging

from ..config import get_settings
from ..db import connect
from ..embeddings import EmbeddingClient
from .scan import full_scan
from .watch import watch_vault

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


def main() -> None:
    parser = argparse.ArgumentParser(description="Obsidian vault indexer")
    parser.add_argument("mode", choices=["scan", "watch"], help="'scan' once, or 'scan' + 'watch'")
    args = parser.parse_args()

    settings = get_settings()

    conn = connect(settings)
    try:
        with EmbeddingClient(settings) as embedder:
            full_scan(conn, embedder, settings)
    finally:
        conn.close()

    if args.mode == "watch":
        watch_vault(settings)


if __name__ == "__main__":
    main()
