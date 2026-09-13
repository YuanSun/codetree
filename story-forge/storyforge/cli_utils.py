from __future__ import annotations

import typer
from rich.console import Console

from .config import Config
from .llm.base import LLMProvider, Message
from .llm.factory import get_provider
from .storage import Project

console = Console()


def resolve_project(project_opt: str | None, config: Config) -> Project:
    slug = project_opt or config.current_project
    if not slug:
        console.print(
            "[red]No project specified and no current project set.[/red]\n"
            "Pass --project <slug>, or run: [bold]storyforge project use <slug>[/bold]"
        )
        raise typer.Exit(1)
    project = Project(slug)
    if not project.exists():
        console.print(f"[red]Project '{slug}' does not exist.[/red] Run: storyforge project list")
        raise typer.Exit(1)
    return project


def require_provider(config: Config, override: str | None = None) -> LLMProvider:
    provider = get_provider(config, override)
    ok, reason = provider.is_available()
    if not ok:
        console.print(f"[red]LLM provider '{provider.name}' is not ready:[/red]\n{reason}")
        raise typer.Exit(1)
    return provider


def safe_chat(
    provider: LLMProvider, system: str, messages: list[Message], max_tokens: int = 4096
) -> str:
    """Calls provider.chat() and turns any backend failure (network error, bad
    model name, rate limit, ...) into a short message instead of a raw traceback."""
    try:
        return provider.chat(system, messages, max_tokens=max_tokens)
    except Exception as exc:  # noqa: BLE001 - deliberately broad, this is the CLI's error boundary
        console.print(f"[red]'{provider.name}' request failed:[/red] {exc}")
        raise typer.Exit(1) from exc
