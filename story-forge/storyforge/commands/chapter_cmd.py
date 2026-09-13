from __future__ import annotations

import typer
from rich.console import Console
from rich.prompt import Prompt
from rich.table import Table

from ..chat_session import run_chat
from ..cli_utils import require_provider, safe_chat
from ..config import Config
from ..lenses import LENS_BY_KEY, LENSES
from ..llm.base import Message
from ..rendering import render, to_yaml
from ..storage import Project

console = Console()


def _chapter_summaries(project: Project, exclude_slug: str | None = None) -> str:
    lines = []
    for slug in project.list_chapter_slugs():
        if slug == exclude_slug:
            continue
        brief = project.load_chapter_brief(slug)
        if not brief:
            continue
        five_w1h = brief.get("five_w1h") or {}
        lines.append(
            f"- Chapter {brief.get('number', '?')}: {brief.get('title', slug)} "
            f"(POV: {brief.get('pov_character', '?')}) — {five_w1h.get('what', '').strip()}"
        )
    return "\n".join(lines) if lines else ""


def _prev_chapter_context(project: Project, chapter_slug: str) -> str:
    slugs = project.list_chapter_slugs()
    if chapter_slug not in slugs:
        return ""
    idx = slugs.index(chapter_slug)
    if idx == 0:
        return ""
    prev_slug = slugs[idx - 1]
    brief = project.load_chapter_brief(prev_slug)
    draft = project.load_chapter_draft(prev_slug)
    parts = []
    if brief:
        parts.append(f"Chapter {brief.get('number')}: {brief.get('title')}")
        five_w1h = brief.get("five_w1h") or {}
        if five_w1h.get("what"):
            parts.append(f"What happened: {five_w1h['what']}")
    if draft:
        parts.append("Closing lines:\n" + draft[-800:])
    return "\n".join(parts)


def new_chapter(project: Project, provider_override: str | None) -> None:
    config = Config.load()
    provider = require_provider(config, provider_override)

    number = project.next_chapter_number()
    bible = project.load_bible()
    summaries = _chapter_summaries(project)

    system_prompt = render(
        "chapter_brief_system.md.j2",
        chapter_number=number,
        bible_yaml=to_yaml(bible),
        chapter_summaries=summaries,
    )
    intro = (
        f"# Grooming chapter {number} for **{project.slug}**\n\n"
        "Tell me what you have in mind for this chapter. Send `/draft` when you want a structured "
        "requirements / acceptance-criteria / considerations draft, `/save` to accept it."
    )
    draft = run_chat(provider, system_prompt, intro)
    if draft is None:
        console.print("[yellow]No chapter created.[/yellow]")
        return

    draft.setdefault("number", number)
    title = draft.get("title") or f"chapter-{number}"
    slug = project.make_chapter_slug(number, title)
    draft["status"] = "groomed"
    project.save_chapter_brief(slug, draft)
    console.print(f"\n[bold green]Saved chapter brief '{slug}'.[/bold green]")


def list_chapters(project: Project) -> None:
    slugs = project.list_chapter_slugs()
    if not slugs:
        console.print(f"[yellow]No chapters yet for '{project.slug}'.[/yellow]")
        return
    table = Table(title=f"Chapters — {project.slug}")
    table.add_column("slug")
    table.add_column("title")
    table.add_column("pov")
    table.add_column("status")
    table.add_column("has draft")
    for slug in slugs:
        brief = project.load_chapter_brief(slug)
        has_draft = "yes" if project.load_chapter_draft(slug) else "no"
        table.add_row(
            slug,
            brief.get("title", ""),
            brief.get("pov_character", ""),
            brief.get("status", ""),
            has_draft,
        )
    console.print(table)


def _resolve_or_exit(project: Project, ref: str) -> str:
    slug = project.resolve_chapter_slug(ref)
    if not slug:
        console.print(f"[red]No chapter matching '{ref}' in project '{project.slug}'.[/red]")
        raise typer.Exit(1)
    return slug


def show_chapter(project: Project, ref: str) -> None:
    slug = _resolve_or_exit(project, ref)
    brief = project.load_chapter_brief(slug)
    console.print(f"[bold]{slug}[/bold]")
    console.print(to_yaml(brief))
    notes = project.load_chapter_notes(slug)
    if notes:
        console.print("\n[bold]Notes[/bold]")
        console.print(notes)
    draft_text = project.load_chapter_draft(slug)
    if draft_text:
        console.print(f"\n[bold]Draft[/bold] ({len(draft_text.split())} words)")
        console.print(draft_text[:1500] + ("..." if len(draft_text) > 1500 else ""))


def _pick_lens(lens_key: str | None):
    if lens_key:
        lens = LENS_BY_KEY.get(lens_key)
        if not lens:
            console.print(f"[red]Unknown lens '{lens_key}'.[/red] Choices: {', '.join(LENS_BY_KEY)}")
            raise typer.Exit(1)
        return lens
    console.print("[bold]Pick a lens to work this chapter through:[/bold]")
    for i, lens in enumerate(LENSES, 1):
        console.print(f"  {i}. {lens.label}")
    choice = Prompt.ask("Lens #", choices=[str(i) for i in range(1, len(LENSES) + 1)])
    return LENSES[int(choice) - 1]


def work_chapter(
    project: Project,
    ref: str,
    lens_key: str | None,
    character_id: str | None,
    extra: str | None,
    provider_override: str | None,
) -> None:
    slug = _resolve_or_exit(project, ref)
    lens = _pick_lens(lens_key)

    character_yaml = None
    if lens.needs_character:
        if not character_id:
            chars = project.list_characters()
            if not chars:
                console.print("[red]This lens needs a character, but none exist yet.[/red]")
                raise typer.Exit(1)
            console.print("[bold]Pick a character:[/bold]")
            for i, c in enumerate(chars, 1):
                console.print(f"  {i}. {c.get('name')} ({c.get('id')})")
            choice = Prompt.ask("Character #", choices=[str(i) for i in range(1, len(chars) + 1)])
            character_yaml = to_yaml(chars[int(choice) - 1])
        else:
            char = project.load_character(character_id)
            if not char:
                console.print(f"[red]No character '{character_id}'.[/red]")
                raise typer.Exit(1)
            character_yaml = to_yaml(char)

    if extra is None:
        extra = Prompt.ask("Anything specific you want this pass to focus on?", default="")

    config = Config.load()
    provider = require_provider(config, provider_override)

    bible = project.load_bible()
    brief = project.load_chapter_brief(slug)
    context = dict(
        bible_yaml=to_yaml(bible),
        brief=brief,
        brief_yaml=to_yaml(brief),
        prev_summary=_prev_chapter_context(project, slug),
        draft_text=project.load_chapter_draft(slug),
        notes_so_far=project.load_chapter_notes(slug),
        character_yaml=character_yaml,
        extra=extra,
    )
    prompt = render(lens.template, **context)

    with console.status("[dim]thinking...[/dim]"):
        reply = safe_chat(
            provider,
            "You are a sharp, concrete developmental editor for a novel-in-progress.",
            [Message(role="user", content=prompt)],
        )

    console.print(f"\n[bold]{lens.label}[/bold]\n")
    console.print(reply)

    if Prompt.ask("\nAppend this to the chapter's notes?", choices=["y", "n"], default="y") == "y":
        project.append_chapter_notes(slug, lens.label, reply)
        console.print("[bold green]Saved to notes.md.[/bold green]")


def draft_chapter(
    project: Project, ref: str, instruction: str | None, provider_override: str | None
) -> None:
    slug = _resolve_or_exit(project, ref)
    config = Config.load()
    provider = require_provider(config, provider_override)

    bible = project.load_bible()
    brief = project.load_chapter_brief(slug)
    if not brief:
        console.print(f"[red]Chapter '{slug}' has no brief yet — run 'chapter new' first.[/red]")
        raise typer.Exit(1)

    system_prompt = render(
        "draft_system.md.j2",
        bible=bible,
        brief=brief,
        bible_yaml=to_yaml(bible),
        brief_yaml=to_yaml(brief),
        prev_summary=_prev_chapter_context(project, slug),
        draft_text=project.load_chapter_draft(slug),
        notes_so_far=project.load_chapter_notes(slug),
        instruction=instruction or "",
    )
    with console.status("[dim]writing...[/dim]"):
        prose = safe_chat(provider, system_prompt, [Message(role="user", content="Write the chapter now.")])

    existing = project.load_chapter_draft(slug)
    if existing:
        console.print(f"[yellow]Chapter '{slug}' already has a draft ({len(existing.split())} words).[/yellow]")
        if Prompt.ask("Overwrite it?", choices=["y", "n"], default="n") != "y":
            console.print("[yellow]Kept the existing draft. New text not saved.[/yellow]")
            console.print(prose)
            return

    project.save_chapter_draft(slug, prose)
    brief["status"] = "drafted"
    project.save_chapter_brief(slug, brief)
    console.print(f"[bold green]Draft written for '{slug}' ({len(prose.split())} words).[/bold green]")
