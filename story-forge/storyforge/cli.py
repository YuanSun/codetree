from __future__ import annotations

from typing import Optional

import typer

from .cli_utils import resolve_project
from .commands import bible_cmd, chapter_cmd, character_cmd, config_cmd, project_cmd, status_cmd
from .config import Config
from .lenses import LENSES

app = typer.Typer(
    help="AI-assisted novel writing: story bible (epic) -> chapter briefs (tickets) -> scene-level drafting.",
    no_args_is_help=True,
)
bible_app = typer.Typer(help="The novel's main thread: characters, arcs, main story.")
character_app = typer.Typer(help="Individual characters.")
chapter_app = typer.Typer(help="Chapter-level briefs and drafting.")
config_app = typer.Typer(help="LLM backend configuration.")
project_app = typer.Typer(help="Manage multiple novel projects.")

app.add_typer(bible_app, name="bible")
app.add_typer(character_app, name="character")
app.add_typer(chapter_app, name="chapter")
app.add_typer(config_app, name="config")
app.add_typer(project_app, name="project")


ProjectOpt = Optional[str]
ProviderOpt = Optional[str]


@app.command()
def init(
    name: str = typer.Argument(..., help="Novel title, e.g. \"The Glass Orchard\""),
    notes: str = typer.Option("", "--notes", help="A few starting notes: genre, vibe, one-liner..."),
    provider: ProviderOpt = typer.Option(None, "--provider", help="anthropic | ollama | mock"),
):
    """Create a new novel project and interactively build its story bible."""
    bible_cmd.init_project(name, notes, provider)


@app.command()
def status(project: ProjectOpt = typer.Option(None, "--project")):
    """Overview of the current (or given) project: bible summary + chapter board."""
    config = Config.load()
    status_cmd.show_status(resolve_project(project, config))


# -- bible ---------------------------------------------------------------
@bible_app.command("show")
def bible_show(project: ProjectOpt = typer.Option(None, "--project")):
    config = Config.load()
    bible_cmd.show_bible(resolve_project(project, config))


@bible_app.command("edit")
def bible_edit(
    project: ProjectOpt = typer.Option(None, "--project"),
    provider: ProviderOpt = typer.Option(None, "--provider"),
):
    """Re-open an interactive conversation to revise the story bible."""
    config = Config.load()
    bible_cmd.edit_bible(resolve_project(project, config), provider)


# -- character -------------------------------------------------------------
@character_app.command("list")
def character_list(project: ProjectOpt = typer.Option(None, "--project")):
    config = Config.load()
    character_cmd.list_characters(resolve_project(project, config))


@character_app.command("show")
def character_show(char_id: str, project: ProjectOpt = typer.Option(None, "--project")):
    config = Config.load()
    character_cmd.show_character(resolve_project(project, config), char_id)


@character_app.command("add")
def character_add(project: ProjectOpt = typer.Option(None, "--project")):
    """Quick manual add, without going through a full bible conversation."""
    config = Config.load()
    character_cmd.add_character(resolve_project(project, config))


# -- chapter -----------------------------------------------------------------
@chapter_app.command("new")
def chapter_new(
    project: ProjectOpt = typer.Option(None, "--project"),
    provider: ProviderOpt = typer.Option(None, "--provider"),
):
    """Interactively groom a new chapter: requirements, acceptance criteria, considerations."""
    config = Config.load()
    chapter_cmd.new_chapter(resolve_project(project, config), provider)


@chapter_app.command("list")
def chapter_list(project: ProjectOpt = typer.Option(None, "--project")):
    config = Config.load()
    chapter_cmd.list_chapters(resolve_project(project, config))


@chapter_app.command("show")
def chapter_show(ref: str, project: ProjectOpt = typer.Option(None, "--project")):
    """ref can be a full slug ('03-the-fall'), or just a number ('3')."""
    config = Config.load()
    chapter_cmd.show_chapter(resolve_project(project, config), ref)


@chapter_app.command("work")
def chapter_work(
    ref: str,
    lens: Optional[str] = typer.Option(
        None, "--lens", help="Skip the menu: " + ", ".join(l.key for l in LENSES)
    ),
    character: Optional[str] = typer.Option(None, "--character", help="Character id, for character_focus lens"),
    focus: Optional[str] = typer.Option(None, "--focus", help="What this pass should focus on"),
    project: ProjectOpt = typer.Option(None, "--project"),
    provider: ProviderOpt = typer.Option(None, "--provider"),
):
    """Work a chapter's details through a specific lens (5W1H, character, transitions, ...)."""
    config = Config.load()
    chapter_cmd.work_chapter(resolve_project(project, config), ref, lens, character, focus, provider)


@chapter_app.command("draft")
def chapter_draft(
    ref: str,
    instruction: Optional[str] = typer.Option(None, "--instruction", help="Extra direction for this draft pass"),
    project: ProjectOpt = typer.Option(None, "--project"),
    provider: ProviderOpt = typer.Option(None, "--provider"),
):
    """Generate (or regenerate) the chapter's prose draft from its brief + notes."""
    config = Config.load()
    chapter_cmd.draft_chapter(resolve_project(project, config), ref, instruction, provider)


# -- config --------------------------------------------------------------------
@config_app.command("show")
def config_show():
    config_cmd.show_config()


@config_app.command("set")
def config_set(
    provider: Optional[str] = typer.Option(None, "--provider", help="anthropic | ollama | mock"),
    anthropic_model: Optional[str] = typer.Option(None, "--anthropic-model"),
    ollama_model: Optional[str] = typer.Option(None, "--ollama-model"),
    ollama_host: Optional[str] = typer.Option(None, "--ollama-host"),
):
    config_cmd.set_config(provider, anthropic_model, ollama_model, ollama_host)


# -- project -------------------------------------------------------------------
@project_app.command("list")
def project_list():
    project_cmd.list_projects()


@project_app.command("use")
def project_use(slug: str):
    project_cmd.use_project(slug)


if __name__ == "__main__":
    app()
