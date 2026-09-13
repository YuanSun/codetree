"""File-layout for a novel project: everything is plain YAML/Markdown under projects/<slug>/
so the whole thing is human-editable and git-diffable.

projects/<slug>/
  story-bible.yaml       # premise, themes, world, main story arc, milestones
  characters/<id>.yaml   # one file per character
  chapters/<NN-slug>/
    brief.yaml           # requirements, acceptance criteria, considerations, 5W1H
    draft.md             # the actual prose
    notes.md             # accumulated notes from lens passes (append-only log)
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path

import yaml

from .config import PROJECTS_DIR


def slugify(text: str) -> str:
    text = text.strip().lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-") or "untitled"


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def read_yaml(path: Path) -> dict:
    if not path.exists():
        return {}
    return yaml.safe_load(path.read_text()) or {}


def write_yaml(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(yaml.safe_dump(data, sort_keys=False, allow_unicode=True, width=100))


class Project:
    def __init__(self, slug: str):
        self.slug = slug
        self.dir = PROJECTS_DIR / slug

    # -- lifecycle -----------------------------------------------------
    def exists(self) -> bool:
        return self.dir.exists()

    def create(self) -> None:
        self.dir.mkdir(parents=True, exist_ok=True)
        self.characters_dir.mkdir(exist_ok=True)
        self.chapters_dir.mkdir(exist_ok=True)

    @staticmethod
    def list_all() -> list[str]:
        if not PROJECTS_DIR.exists():
            return []
        return sorted(p.name for p in PROJECTS_DIR.iterdir() if p.is_dir())

    # -- paths -----------------------------------------------------------
    @property
    def bible_path(self) -> Path:
        return self.dir / "story-bible.yaml"

    @property
    def characters_dir(self) -> Path:
        return self.dir / "characters"

    @property
    def chapters_dir(self) -> Path:
        return self.dir / "chapters"

    # -- story bible -------------------------------------------------------
    def load_bible(self) -> dict:
        return read_yaml(self.bible_path)

    def save_bible(self, data: dict) -> None:
        data["updated_at"] = now_iso()
        write_yaml(self.bible_path, data)

    # -- characters --------------------------------------------------------
    def list_characters(self) -> list[dict]:
        if not self.characters_dir.exists():
            return []
        chars = [read_yaml(p) for p in sorted(self.characters_dir.glob("*.yaml"))]
        return [c for c in chars if c]

    def save_character(self, data: dict) -> str:
        char_id = data.get("id") or slugify(data.get("name", "character"))
        data["id"] = char_id
        data["updated_at"] = now_iso()
        write_yaml(self.characters_dir / f"{char_id}.yaml", data)
        return char_id

    def load_character(self, char_id: str) -> dict:
        return read_yaml(self.characters_dir / f"{char_id}.yaml")

    # -- chapters ------------------------------------------------------------
    def next_chapter_number(self) -> int:
        existing = self.list_chapter_slugs()
        numbers = []
        for slug in existing:
            m = re.match(r"(\d+)-", slug)
            if m:
                numbers.append(int(m.group(1)))
        return (max(numbers) + 1) if numbers else 1

    def list_chapter_slugs(self) -> list[str]:
        if not self.chapters_dir.exists():
            return []
        return sorted(p.name for p in self.chapters_dir.iterdir() if p.is_dir())

    def make_chapter_slug(self, number: int, title: str) -> str:
        return f"{number:02d}-{slugify(title)}"

    def chapter_dir(self, chapter_slug: str) -> Path:
        return self.chapters_dir / chapter_slug

    def resolve_chapter_slug(self, ref: str) -> str | None:
        """Accept a full slug, a bare number ('4'), or a zero-padded number ('04')."""
        slugs = self.list_chapter_slugs()
        if ref in slugs:
            return ref
        digits = re.sub(r"\D", "", ref)
        if digits:
            for slug in slugs:
                if slug.startswith(f"{int(digits):02d}-"):
                    return slug
        return None

    def load_chapter_brief(self, chapter_slug: str) -> dict:
        return read_yaml(self.chapter_dir(chapter_slug) / "brief.yaml")

    def save_chapter_brief(self, chapter_slug: str, data: dict) -> None:
        data["updated_at"] = now_iso()
        write_yaml(self.chapter_dir(chapter_slug) / "brief.yaml", data)

    def load_chapter_draft(self, chapter_slug: str) -> str:
        path = self.chapter_dir(chapter_slug) / "draft.md"
        return path.read_text() if path.exists() else ""

    def save_chapter_draft(self, chapter_slug: str, text: str) -> None:
        path = self.chapter_dir(chapter_slug) / "draft.md"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)

    def load_chapter_notes(self, chapter_slug: str) -> str:
        path = self.chapter_dir(chapter_slug) / "notes.md"
        return path.read_text() if path.exists() else ""

    def append_chapter_notes(self, chapter_slug: str, heading: str, text: str) -> None:
        path = self.chapter_dir(chapter_slug) / "notes.md"
        path.parent.mkdir(parents=True, exist_ok=True)
        entry = f"\n## {heading} — {now_iso()}\n\n{text}\n"
        with path.open("a") as f:
            f.write(entry)
