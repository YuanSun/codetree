from __future__ import annotations

import typer
from rich.console import Console

from ..chat_session import run_chat
from ..cli_utils import require_provider
from ..config import Config
from ..llm.base import LLMProvider
from ..rendering import render, to_yaml
from ..storage import Project, slugify

console = Console()


def init_project(name: str, genre_notes: str, provider_override: str | None) -> None:
    config = Config.load()
    slug = slugify(name)
    project = Project(slug)
    if project.exists():
        console.print(f"[red]Project '{slug}' already exists.[/red] Use: storyforge bible edit --project {slug}")
        raise typer.Exit(1)

    provider = require_provider(config, provider_override)
    project.create()

    system_prompt = render("bible_system.md.j2", genre_notes=genre_notes)
    intro = (
        f"# Setting up the story bible for **{name}**\n\n"
        "Talk through your novel with me — premise, characters, world, main plot. "
        "Send `/draft` any time you want me to turn the conversation so far into a structured "
        "story bible; send `/save` to accept it once you're happy."
    )
    draft = run_chat(provider, system_prompt, intro)
    if draft is None:
        project_dir = project.dir
        console.print(f"[yellow]No bible saved. Empty project folder left at {project_dir}[/yellow]")
        return

    draft.setdefault("title", name)
    _split_characters_into_files(project, draft)
    project.save_bible(draft)

    config.current_project = slug
    config.save()
    console.print(f"\n[bold green]Saved story bible for '{slug}'.[/bold green] It is now the current project.")


def edit_bible(project: Project, provider_override: str | None) -> None:
    config = Config.load()
    provider = require_provider(config, provider_override)

    existing = project.load_bible()
    characters = project.list_characters()
    if characters:
        existing = {**existing, "characters": characters}

    system_prompt = render("bible_system.md.j2", genre_notes="")
    intro = (
        f"# Revising the story bible for **{project.slug}**\n\n"
        "Here is the current story bible. Tell me what to change, then `/draft` + `/save` when ready.\n\n"
        f"```yaml\n{to_yaml(existing)}\n```"
    )
    draft = run_chat(provider, system_prompt, intro)
    if draft is None:
        console.print("[yellow]No changes saved.[/yellow]")
        return

    _split_characters_into_files(project, draft)
    project.save_bible(draft)
    console.print(f"[bold green]Updated story bible for '{project.slug}'.[/bold green]")


def show_bible(project: Project) -> None:
    bible = project.load_bible()
    if not bible:
        console.print(f"[yellow]No story bible yet for '{project.slug}'.[/yellow]")
        return
    characters = project.list_characters()
    console.print(f"[bold]{bible.get('title', project.slug)}[/bold]")
    if bible.get("logline"):
        console.print(f"[italic]{bible['logline']}[/italic]\n")
    console.print(to_yaml({k: v for k, v in bible.items() if k != "characters"}))
    if characters:
        console.print("\n[bold]Characters[/bold]")
        console.print(to_yaml({"characters": characters}))


def _split_characters_into_files(project: Project, bible: dict) -> None:
    """The bible chat drafts characters inline; persist each one as its own file
    under characters/ so they can be maintained independently, and keep the bible
    document itself lighter."""
    characters = bible.pop("characters", None)
    if not characters:
        return
    for char in characters:
        if isinstance(char, dict) and char.get("name"):
            project.save_character(char)
