from __future__ import annotations

from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    query: str
    top_k: int = Field(default=5, ge=1, le=50)
    tags: list[str] = Field(default_factory=list)
    folder: str | None = None


class SearchHit(BaseModel):
    note_path: str
    note_title: str | None
    folder: str | None
    tags: list[str]
    section_title: str
    header_path: str
    content: str
    similarity: float


class SearchResponse(BaseModel):
    results: list[SearchHit]


class NoteResponse(BaseModel):
    path: str
    title: str | None
    folder: str | None
    tags: list[str]
    content: str
