from __future__ import annotations

import typer
from rich.console import Console

from ..config import Config
from ..storage import Project

console = Console()


def list_projects() -> None:
    config = Config.load()
    projects = Project.list_all()
    if not projects:
        console.print("[yellow]No projects yet.[/yellow] Run: storyforge init \"My Novel\"")
        return
    for slug in projects:
        marker = " [bold green](current)[/bold green]" if slug == config.current_project else ""
        console.print(f"- {slug}{marker}")


def use_project(slug: str) -> None:
    project = Project(slug)
    if not project.exists():
        console.print(f"[red]Project '{slug}' does not exist.[/red]")
        raise typer.Exit(1)
    config = Config.load()
    config.current_project = slug
    config.save()
    console.print(f"[bold green]Current project set to '{slug}'.[/bold green]")
