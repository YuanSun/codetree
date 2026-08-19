"""Postgres/pgvector access layer shared by the indexer and query API."""

from __future__ import annotations

from dataclasses import dataclass

import psycopg
from pgvector.psycopg import register_vector

from .chunker import Chunk
from .config import Settings


def connect(settings: Settings) -> psycopg.Connection:
    conn = psycopg.connect(settings.database_url, autocommit=False)
    register_vector(conn)
    return conn


@dataclass(frozen=True)
class SearchResult:
    note_path: str
    note_title: str | None
    folder: str | None
    tags: list[str]
    section_title: str
    header_path: str
    content: str
    similarity: float


# --- Indexer-side writes -----------------------------------------------------


def get_note_hash(conn: psycopg.Connection, path: str) -> str | None:
    row = conn.execute(
        "SELECT content_hash FROM notes WHERE path = %s", (path,)
    ).fetchone()
    return row[0] if row else None


def list_indexed_paths(conn: psycopg.Connection) -> set[str]:
    rows = conn.execute("SELECT path FROM notes").fetchall()
    return {row[0] for row in rows}


def upsert_note_with_chunks(
    conn: psycopg.Connection,
    *,
    path: str,
    title: str | None,
    folder: str | None,
    tags: list[str],
    content_hash: str,
    mtime: float,
    chunks: list[Chunk],
    embeddings: list[list[float]],
) -> None:
    """Replaces a note's row and all of its chunks in one transaction."""
    with conn.transaction():
        note_id = conn.execute(
            """
            INSERT INTO notes (path, title, folder, tags, content_hash, mtime, indexed_at)
            VALUES (%s, %s, %s, %s, %s, %s, now())
            ON CONFLICT (path) DO UPDATE SET
                title = EXCLUDED.title,
                folder = EXCLUDED.folder,
                tags = EXCLUDED.tags,
                content_hash = EXCLUDED.content_hash,
                mtime = EXCLUDED.mtime,
                indexed_at = now()
            RETURNING id
            """,
            (path, title, folder, tags, content_hash, mtime),
        ).fetchone()[0]

        conn.execute("DELETE FROM chunks WHERE note_id = %s", (note_id,))

        for chunk, embedding in zip(chunks, embeddings):
            conn.execute(
                """
                INSERT INTO chunks
                    (note_id, chunk_index, section_title, header_path, content, embedding)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    note_id,
                    chunk.chunk_index,
                    chunk.section_title,
                    chunk.header_path,
                    chunk.content,
                    embedding,
                ),
            )


def delete_note(conn: psycopg.Connection, path: str) -> None:
    with conn.transaction():
        conn.execute("DELETE FROM notes WHERE path = %s", (path,))


# --- Query-side reads ---------------------------------------------------------


def search_chunks(
    conn: psycopg.Connection,
    *,
    query_embedding: list[float],
    top_k: int,
    tags: list[str] | None = None,
    folder: str | None = None,
) -> list[SearchResult]:
    filters = []
    params: list = [query_embedding]

    if tags:
        filters.append("n.tags && %s")
        params.append(tags)
    if folder:
        filters.append("n.folder = %s")
        params.append(folder)

    where_clause = f"WHERE {' AND '.join(filters)}" if filters else ""
    params.extend([query_embedding, top_k])

    rows = conn.execute(
        f"""
        SELECT
            n.path,
            n.title,
            n.folder,
            n.tags,
            c.section_title,
            c.header_path,
            c.content,
            1 - (c.embedding <=> %s) AS similarity
        FROM chunks c
        JOIN notes n ON n.id = c.note_id
        {where_clause}
        ORDER BY c.embedding <=> %s
        LIMIT %s
        """,
        params,
    ).fetchall()

    return [
        SearchResult(
            note_path=row[0],
            note_title=row[1],
            folder=row[2],
            tags=row[3] or [],
            section_title=row[4],
            header_path=row[5],
            content=row[6],
            similarity=row[7],
        )
        for row in rows
    ]


def get_note_metadata(conn: psycopg.Connection, path: str):
    return conn.execute(
        "SELECT path, title, folder, tags FROM notes WHERE path = %s", (path,)
    ).fetchone()
