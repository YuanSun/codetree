from vault_retrieval.chunker import chunk_markdown, parse_frontmatter

NOTE = """---
title: Spaced Repetition
tags: [learning, memory]
---
# Spaced Repetition

Intro paragraph before any section headers.

## Core Concept

Spaced repetition schedules review at increasing intervals.

## How It Works

### The Forgetting Curve

Memory decays roughly exponentially without review.

### Scheduling Algorithm

SM-2 and its descendants pick the next interval from recall difficulty.

## Application Guidance

Use it for durable facts, not for shallow familiarity.
"""


def test_parse_frontmatter_extracts_title_and_tags():
    parsed = parse_frontmatter(NOTE)
    assert parsed.title == "Spaced Repetition"
    assert parsed.tags == ["learning", "memory"]
    assert "Core Concept" in parsed.body


def test_parse_frontmatter_falls_back_to_h1_when_no_title_field():
    raw = "# My Title\n\nSome text.\n"
    parsed = parse_frontmatter(raw)
    assert parsed.title == "My Title"
    assert parsed.tags == []


def test_chunk_markdown_splits_on_h2_and_h3():
    parsed = parse_frontmatter(NOTE)
    chunks = chunk_markdown(parsed.body)

    section_titles = [c.section_title for c in chunks]
    assert section_titles == [
        "Introduction",
        "Core Concept",
        "The Forgetting Curve",
        "Scheduling Algorithm",
        "Application Guidance",
    ]


def test_chunk_header_path_includes_parent_h2_for_h3():
    parsed = parse_frontmatter(NOTE)
    chunks = chunk_markdown(parsed.body)

    forgetting_curve = next(c for c in chunks if c.section_title == "The Forgetting Curve")
    assert forgetting_curve.header_path == "How It Works > The Forgetting Curve"
    assert forgetting_curve.level == 3


def test_chunk_indices_are_sequential():
    parsed = parse_frontmatter(NOTE)
    chunks = chunk_markdown(parsed.body)
    assert [c.chunk_index for c in chunks] == list(range(len(chunks)))


def test_empty_sections_are_dropped():
    raw = "## Empty\n\n## Has Content\n\nSomething here.\n"
    chunks = chunk_markdown(raw)
    assert len(chunks) == 1
    assert chunks[0].section_title == "Has Content"


def test_note_with_no_headers_becomes_single_introduction_chunk():
    raw = "Just a plain note with no headers at all.\n"
    chunks = chunk_markdown(raw)
    assert len(chunks) == 1
    assert chunks[0].section_title == "Introduction"
    assert "plain note" in chunks[0].content


def test_h4_folds_into_enclosing_section():
    raw = "## Section\n\nIntro text.\n\n#### Detail\n\nDetail text.\n"
    chunks = chunk_markdown(raw)
    assert len(chunks) == 1
    assert "Intro text." in chunks[0].content
    assert "Detail text." in chunks[0].content
