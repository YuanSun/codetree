from __future__ import annotations

from rich.console import Console

from ..config import Config

console = Console()


def show_config() -> None:
    config = Config.load()
    console.print(f"provider:        {config.provider}")
    console.print(f"anthropic_model: {config.anthropic_model}")
    console.print(f"ollama_model:    {config.ollama_model}")
    console.print(f"ollama_host:     {config.ollama_host}")
    console.print(f"current_project: {config.current_project or '(none)'}")
    console.print(
        f"ANTHROPIC_API_KEY set: {'yes' if config.anthropic_api_key() else 'no'}"
    )


def set_config(
    provider: str | None,
    anthropic_model: str | None,
    ollama_model: str | None,
    ollama_host: str | None,
) -> None:
    config = Config.load()
    if provider:
        if provider not in ("anthropic", "ollama", "mock"):
            console.print(f"[red]Unknown provider '{provider}'.[/red] Choose: anthropic, ollama, mock")
            return
        config.provider = provider
    if anthropic_model:
        config.anthropic_model = anthropic_model
    if ollama_model:
        config.ollama_model = ollama_model
    if ollama_host:
        config.ollama_host = ollama_host
    config.save()
    console.print("[bold green]Config updated.[/bold green]")
    show_config()
