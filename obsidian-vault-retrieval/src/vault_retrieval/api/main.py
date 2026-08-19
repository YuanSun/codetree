"""FastAPI query service: search(query, top_k, filters) and get_note(path).

Run with:  uvicorn vault_retrieval.api.main:app --port 8756
"""

from __future__ import annotations

import logging
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException

from .. import db
from ..config import Settings, get_settings
from ..embeddings import EmbeddingClient
from .schemas import NoteResponse, SearchHit, SearchRequest, SearchResponse

logger = logging.getLogger(__name__)

app = FastAPI(title="Obsidian Vault Retrieval API", version="0.1.0")


def get_db_connection():
    settings = get_settings()
    conn = db.connect(settings)
    try:
        yield conn
    finally:
        conn.close()


def get_embedder():
    settings = get_settings()
    with EmbeddingClient(settings) as embedder:
        yield embedder


def _resolve_note_path(settings: Settings, path: str) -> Path:
    """Resolves a vault-relative note path, rejecting escapes outside the vault."""
    candidate = (settings.vault_path / path).resolve()
    vault_root = settings.vault_path.resolve()
    if vault_root not in candidate.parents and candidate != vault_root:
        raise HTTPException(status_code=400, detail="Path escapes the vault")
    if not candidate.is_file():
        raise HTTPException(status_code=404, detail=f"Note not found: {path}")
    return candidate


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.post("/search", response_model=SearchResponse)
def search(
    request: SearchRequest,
    conn=Depends(get_db_connection),
    embedder: EmbeddingClient = Depends(get_embedder),
):
    query_embedding = embedder.embed_one(request.query)
    results = db.search_chunks(
        conn,
        query_embedding=query_embedding,
        top_k=request.top_k,
        tags=request.tags or None,
        folder=request.folder,
    )
    return SearchResponse(
        results=[
            SearchHit(
                note_path=r.note_path,
                note_title=r.note_title,
                folder=r.folder,
                tags=r.tags,
                section_title=r.section_title,
                header_path=r.header_path,
                content=r.content,
                similarity=r.similarity,
            )
            for r in results
        ]
    )


@app.get("/notes/{path:path}", response_model=NoteResponse)
def get_note(path: str, conn=Depends(get_db_connection)):
    settings = get_settings()
    file_path = _resolve_note_path(settings, path)
    metadata = db.get_note_metadata(conn, path)

    content = file_path.read_text(encoding="utf-8", errors="replace")

    if metadata is None:
        # File exists on disk but hasn't been indexed yet — still servable.
        return NoteResponse(path=path, title=file_path.stem, folder=None, tags=[], content=content)

    _, title, folder, tags = metadata
    return NoteResponse(path=path, title=title, folder=folder, tags=tags or [], content=content)
