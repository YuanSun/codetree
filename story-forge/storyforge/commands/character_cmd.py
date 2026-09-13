from __future__ import annotations

import typer
from rich.console import Console
from rich.prompt import Prompt
from rich.table import Table

from ..rendering import to_yaml
from ..storage import Project

console = Console()


def list_characters(project: Project) -> None:
    characters = project.list_characters()
    if not characters:
        console.print(f"[yellow]No characters yet for '{project.slug}'.[/yellow]")
        return
    table = Table(title=f"Characters — {project.slug}")
    table.add_column("id")
    table.add_column("name")
    table.add_column("role")
    table.add_column("summary")
    for c in characters:
        table.add_row(
            c.get("id", ""), c.get("name", ""), c.get("role", ""), (c.get("summary") or "")[:60]
        )
    console.print(table)


def show_character(project: Project, char_id: str) -> None:
    data = project.load_character(char_id)
    if not data:
        console.print(f"[red]No character '{char_id}' in project '{project.slug}'.[/red]")
        raise typer.Exit(1)
    console.print(to_yaml(data))


def add_character(project: Project) -> None:
    """Quick manual add, for when you don't want to go through a full bible chat
    just to introduce one more character."""
    console.print(f"[bold]Add a character to '{project.slug}'[/bold] (leave blank to skip a field)")
    name = Prompt.ask("Name")
    role = Prompt.ask("Role", choices=["protagonist", "antagonist", "supporting"], default="supporting")
    summary = Prompt.ask("One-line summary", default="")
    background = Prompt.ask("Background", default="")
    motivation = Prompt.ask("Motivation", default="")
    want_vs_need = Prompt.ask("Want vs. need", default="")

    data = {
        "name": name,
        "role": role,
        "summary": summary,
        "background": background,
        "motivation": motivation,
        "want_vs_need": want_vs_need,
    }
    char_id = project.save_character(data)
    console.print(f"[bold green]Saved character '{char_id}'.[/bold green]")
