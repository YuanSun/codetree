import shutil
import tempfile
from pathlib import Path

import pytest

from storyforge.storage import Project, slugify


@pytest.fixture
def project(monkeypatch):
    tmp_dir = Path(tempfile.mkdtemp())
    # Project.dir is built from storage.PROJECTS_DIR at construction time, so
    # patching that module-level name is enough to sandbox each test.
    monkeypatch.setattr("storyforge.storage.PROJECTS_DIR", tmp_dir)
    p = Project("test-novel")
    p.create()
    yield p
    shutil.rmtree(tmp_dir, ignore_errors=True)


def test_slugify():
    assert slugify("The Rewound Hour!") == "the-rewound-hour"
    assert slugify("  weird   Spacing__here ") == "weird-spacing-here"
    assert slugify("") == "untitled"


def test_bible_roundtrip(project):
    project.save_bible({"title": "T", "logline": "L"})
    loaded = project.load_bible()
    assert loaded["title"] == "T"
    assert "updated_at" in loaded


def test_character_roundtrip(project):
    char_id = project.save_character({"name": "Jane Doe", "role": "protagonist"})
    assert char_id == "jane-doe"
    loaded = project.load_character("jane-doe")
    assert loaded["name"] == "Jane Doe"
    assert project.list_characters() == [loaded]


def test_chapter_numbering_and_resolution(project):
    assert project.next_chapter_number() == 1
    slug1 = project.make_chapter_slug(1, "The Beginning")
    project.save_chapter_brief(slug1, {"number": 1, "title": "The Beginning"})

    assert project.next_chapter_number() == 2
    slug2 = project.make_chapter_slug(2, "The Middle")
    project.save_chapter_brief(slug2, {"number": 2, "title": "The Middle"})

    assert project.resolve_chapter_slug("1") == slug1
    assert project.resolve_chapter_slug("02") == slug2
    assert project.resolve_chapter_slug(slug2) == slug2
    assert project.resolve_chapter_slug("nope") is None


def test_chapter_notes_append(project):
    slug = project.make_chapter_slug(1, "Chapter One")
    project.append_chapter_notes(slug, "5W1H", "first pass")
    project.append_chapter_notes(slug, "Pacing", "second pass")
    notes = project.load_chapter_notes(slug)
    assert "first pass" in notes
    assert "second pass" in notes
    assert notes.index("first pass") < notes.index("second pass")


def test_chapter_draft_roundtrip(project):
    slug = project.make_chapter_slug(1, "Chapter One")
    assert project.load_chapter_draft(slug) == ""
    project.save_chapter_draft(slug, "Once upon a time.")
    assert project.load_chapter_draft(slug) == "Once upon a time."
