"""Generic interactive multi-turn chat loop used by both the story-bible interview
and the chapter-brief grooming conversation. The author talks freely; sending the
literal command `/draft` asks the model to emit a structured YAML block, which we
parse out and hand back to the caller to review/save.
"""
from __future__ import annotations

import re

import yaml
from rich.console import Console
from rich.markdown import Markdown
from rich.prompt import Prompt

from .cli_utils import safe_chat
from .llm.base import LLMProvider, Message

console = Console()

YAML_BLOCK_RE = re.compile(r"```yaml\s*\n(.*?)```", re.DOTALL)

HELP_TEXT = (
    "[dim]Commands: /draft (ask for a structured draft), /show (reprint last draft), "
    "/save (accept last draft and exit), /quit (exit without saving)[/dim]"
)


def extract_yaml_block(text: str) -> dict | None:
    match = YAML_BLOCK_RE.search(text)
    if not match:
        return None
    try:
        data = yaml.safe_load(match.group(1))
    except yaml.YAMLError:
        return None
    return data if isinstance(data, dict) else None


def run_chat(provider: LLMProvider, system_prompt: str, intro: str) -> dict | None:
    """Runs the interactive loop. Returns the accepted YAML dict, or None if the
    author quit without saving."""
    console.print(Markdown(intro))
    console.print(HELP_TEXT)

    messages: list[Message] = []
    last_draft: dict | None = None

    while True:
        try:
            user_text = Prompt.ask("\n[bold cyan]you[/bold cyan]")
        except (EOFError, KeyboardInterrupt):
            console.print("\n[yellow]Exiting without saving.[/yellow]")
            return None

        stripped = user_text.strip()
        if stripped in ("/quit", "/exit"):
            console.print("[yellow]Exiting without saving.[/yellow]")
            return None
        if stripped == "/show":
            if last_draft:
                console.print(yaml.safe_dump(last_draft, sort_keys=False, allow_unicode=True))
            else:
                console.print("[yellow]No draft yet — send /draft first.[/yellow]")
            continue
        if stripped == "/save":
            if last_draft:
                return last_draft
            console.print("[yellow]No draft yet to save — send /draft first.[/yellow]")
            continue

        messages.append(Message(role="user", content=user_text))
        with console.status("[dim]thinking...[/dim]"):
            reply = safe_chat(provider, system_prompt, messages)
        messages.append(Message(role="assistant", content=reply))

        parsed = extract_yaml_block(reply)
        if parsed is not None:
            last_draft = parsed
            console.print("\n[bold green]assistant[/bold green] (drafted a structured version below)")
            console.print(yaml.safe_dump(parsed, sort_keys=False, allow_unicode=True))
            console.print(
                "[dim]Send /save to accept this, or keep talking to revise it, then /draft again.[/dim]"
            )
        else:
            console.print(f"\n[bold green]assistant[/bold green]\n{reply}")
