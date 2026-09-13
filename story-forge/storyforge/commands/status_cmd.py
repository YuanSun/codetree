from __future__ import annotations

from rich.console import Console
from rich.table import Table

from ..storage import Project

console = Console()


def show_status(project: Project) -> None:
    bible = project.load_bible()
    characters = project.list_characters()
    slugs = project.list_chapter_slugs()

    console.print(f"[bold]{bible.get('title', project.slug)}[/bold]  [dim]({project.slug})[/dim]")
    if bible.get("logline"):
        console.print(f"[italic]{bible['logline']}[/italic]")
    console.print(f"{len(characters)} character(s), {len(slugs)} chapter(s)\n")

    if not slugs:
        console.print("[yellow]No chapters yet. Run: storyforge chapter new[/yellow]")
        return

    table = Table()
    table.add_column("#")
    table.add_column("title")
    table.add_column("status")
    table.add_column("words")
    for slug in slugs:
        brief = project.load_chapter_brief(slug)
        draft = project.load_chapter_draft(slug)
        table.add_row(
            str(brief.get("number", "?")),
            brief.get("title", slug),
            brief.get("status", "groomed"),
            str(len(draft.split())) if draft else "-",
        )
    console.print(table)
