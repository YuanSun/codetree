"""Walks the vault, re-embeds changed notes, and prunes deleted ones."""

from __future__ import annotations

import logging
from pathlib import Path

import psycopg

from ..chunker import chunk_markdown, parse_frontmatter
from ..config import Settings
from ..db import delete_note, get_note_hash, list_indexed_paths, upsert_note_with_chunks
from ..embeddings import EmbeddingClient
from ..hashing import content_hash

logger = logging.getLogger(__name__)


def iter_notes(settings: Settings):
    ignored = {name.lower() for name in settings.ignored_folders}
    for path in settings.vault_path.rglob("*.md"):
        if any(part.lower() in ignored for part in path.parts):
            continue
        yield path


def relative_path(settings: Settings, path: Path) -> str:
    return str(path.relative_to(settings.vault_path))


def index_note(
    conn: psycopg.Connection,
    embedder: EmbeddingClient,
    settings: Settings,
    path: Path,
) -> bool:
    """Re-embeds a single note if its content changed. Returns True if reindexed."""
    rel_path = relative_path(settings, path)
    raw_text = path.read_text(encoding="utf-8", errors="replace")
    new_hash = content_hash(raw_text)

    if get_note_hash(conn, rel_path) == new_hash:
        return False

    parsed = parse_frontmatter(raw_text)
    chunks = chunk_markdown(parsed.body)
    if not chunks:
        logger.warning("No chunks produced for %s, skipping", rel_path)
        return False

    embeddings = []
    batch_size = settings.embedding_batch_size
    texts = [chunk.content for chunk in chunks]
    for start in range(0, len(texts), batch_size):
        embeddings.extend(embedder.embed(texts[start : start + batch_size]))

    folder = str(Path(rel_path).parent) if Path(rel_path).parent != Path(".") else None
    title = parsed.title or path.stem

    upsert_note_with_chunks(
        conn,
        path=rel_path,
        title=title,
        folder=folder,
        tags=parsed.tags,
        content_hash=new_hash,
        mtime=path.stat().st_mtime,
        chunks=chunks,
        embeddings=embeddings,
    )
    logger.info("Indexed %s (%d chunks)", rel_path, len(chunks))
    return True


def full_scan(conn: psycopg.Connection, embedder: EmbeddingClient, settings: Settings) -> None:
    """One-shot backfill: index changed notes, prune notes deleted from disk."""
    seen: set[str] = set()
    indexed_count = 0

    for path in iter_notes(settings):
        rel_path = relative_path(settings, path)
        seen.add(rel_path)
        try:
            if index_note(conn, embedder, settings, path):
                indexed_count += 1
                conn.commit()
        except Exception:
            logger.exception("Failed to index %s", rel_path)
            conn.rollback()

    stale = list_indexed_paths(conn) - seen
    for rel_path in stale:
        delete_note(conn, rel_path)
        logger.info("Removed stale note %s", rel_path)

    logger.info(
        "Scan complete: %d notes reindexed, %d stale notes removed", indexed_count, len(stale)
    )
