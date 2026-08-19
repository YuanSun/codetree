"""Splits a note into chunks along its H2/H3 section structure.

Rationale: the note-writer skill already produces notes with a consistent
H2 shape (core concept / how it works / application guidance / ...), so
chunking on headers instead of fixed token windows keeps each chunk a
coherent, citable unit and avoids splitting mid-thought.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

import yaml

_FRONTMATTER_RE = re.compile(r"\A---\s*\n(.*?\n)---\s*\n?", re.DOTALL)
_HEADER_RE = re.compile(r"^(#{1,6})\s+(.*?)\s*$")


@dataclass(frozen=True)
class Chunk:
    chunk_index: int
    section_title: str
    header_path: str
    level: int
    content: str


@dataclass(frozen=True)
class ParsedNote:
    title: str
    tags: list[str]
    frontmatter: dict
    body: str


def parse_frontmatter(raw: str) -> ParsedNote:
    """Pulls YAML frontmatter (title/tags) off the top of a note, if present."""
    match = _FRONTMATTER_RE.match(raw)
    frontmatter: dict = {}
    body = raw
    if match:
        body = raw[match.end() :]
        try:
            loaded = yaml.safe_load(match.group(1))
            if isinstance(loaded, dict):
                frontmatter = loaded
        except yaml.YAMLError:
            frontmatter = {}

    tags = frontmatter.get("tags") or []
    if isinstance(tags, str):
        tags = [t.strip() for t in tags.split(",") if t.strip()]
    tags = [str(t).lstrip("#") for t in tags]

    title = frontmatter.get("title")
    if not title:
        h1_match = re.search(r"^#\s+(.+?)\s*$", body, re.MULTILINE)
        title = h1_match.group(1) if h1_match else None

    return ParsedNote(title=title, tags=tags, frontmatter=frontmatter, body=body)


def chunk_markdown(body: str) -> list[Chunk]:
    """Splits note body into chunks at H2/H3 boundaries.

    - Text before the first H2 (an H1 title, an intro paragraph, or both)
      becomes a single "Introduction" chunk.
    - Each H2 starts a new chunk; content up to the next H2/H3 belongs to it.
    - Each H3 nested under an H2 starts its own chunk, with header_path
      recording the "H2 > H3" breadcrumb for citations.
    - H4+ headers do not start new chunks; their content folds into the
      enclosing H2/H3 chunk.
    """
    lines = body.splitlines()

    chunks: list[Chunk] = []
    current_h2: str | None = None
    section_title = "Introduction"
    header_path = "Introduction"
    level = 0
    buffer: list[str] = []

    def flush() -> None:
        text = "\n".join(buffer).strip()
        if text:
            chunks.append(
                Chunk(
                    chunk_index=len(chunks),
                    section_title=section_title,
                    header_path=header_path,
                    level=level,
                    content=text,
                )
            )

    for line in lines:
        header_match = _HEADER_RE.match(line)
        if header_match:
            hashes, title = header_match.group(1), header_match.group(2)
            depth = len(hashes)

            if depth == 1:
                # Title line — not chunked on its own, folded into whatever
                # section is currently accumulating.
                buffer.append(line)
                continue

            if depth == 2:
                flush()
                buffer = []
                current_h2 = title
                section_title = title
                header_path = title
                level = 2
                continue

            if depth == 3:
                flush()
                buffer = []
                section_title = title
                header_path = f"{current_h2} > {title}" if current_h2 else title
                level = 3
                continue

            # H4+: keep in the current section instead of starting a chunk.
            buffer.append(line)
            continue

        buffer.append(line)

    flush()
    return chunks
