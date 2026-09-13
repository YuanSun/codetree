# Story Forge

An AI-assisted novel writing tool structured like a software project: a **story bible**
(the Epic) breaks down into **chapter briefs** (Jira-style tickets with requirements,
acceptance criteria, and considerations), which you then work through detail by detail
using **lenses** — focused prompts for 5W1H, character voice, transitions, contrast,
foreshadowing, pacing, dialogue, setting, and continuity — before generating or
regenerating prose.

Everything is plain YAML + Markdown under `projects/<slug>/`, so it's human-readable,
hand-editable, and git-diffable. Works with the Anthropic API or a local Ollama model —
pick per command, or set a default.

## Workflow

```
storyforge init "My Novel"        # 1. interactive chat -> story bible (characters, arcs, main plot)
storyforge chapter new            # 2. interactive chat -> chapter brief (requirements/AC/considerations)
storyforge chapter work 1         # 3. pick a lens, develop the chapter's details, save notes
storyforge chapter draft 1        # 4. generate prose from the brief + accumulated notes
storyforge status                 # overview: chapters, status, word counts
```

Everything also works non-interactively via `--provider`, `--project`, and other flags —
see `storyforge <command> --help`.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
```

Pick a backend:

```bash
# Anthropic API
export ANTHROPIC_API_KEY=sk-ant-...
storyforge config set --provider anthropic --anthropic-model claude-sonnet-5

# or a local model via Ollama (ollama serve; ollama pull <model> first)
storyforge config set --provider ollama --ollama-model llama3.1

# or the offline mock provider, for trying out the CLI/file layout with no LLM at all
storyforge config set --provider mock
```

Any command also accepts `--provider anthropic|ollama|mock` to override the default
for a single run.

## Project layout

```
projects/<slug>/
  story-bible.yaml        # premise, themes, setting, main story arc, milestones
  characters/<id>.yaml     # one file per character: role, background, motivation,
                            # want-vs-need, growth arc, relationships, voice notes
  chapters/<NN-slug>/
    brief.yaml             # requirements, acceptance criteria, considerations, 5W1H
    notes.md                # append-only log of every lens pass you run
    draft.md                # the actual prose
```

Multiple novels can live side by side; `storyforge project use <slug>` switches which
one is "current" so you don't have to pass `--project` on every command.

## Commands

| Command | Purpose |
|---|---|
| `init <title>` | Create a project, interactively build the story bible |
| `bible show` / `bible edit` | View or re-open the story-bible conversation |
| `character list` / `show <id>` / `add` | Characters (auto-populated from the bible chat, or add manually) |
| `chapter new` | Interactively groom a chapter brief |
| `chapter list` / `show <ref>` | Chapter board / a single chapter's brief+notes+draft |
| `chapter work <ref> [--lens ...]` | Run a lens pass (5W1H, character focus, transitions, contrast, foreshadowing, pacing, dialogue, setting, continuity check) |
| `chapter draft <ref>` | Generate/regenerate the chapter's prose from brief + notes |
| `status` | Bible summary + chapter board with word counts |
| `project list` / `use <slug>` | Manage multiple novels |
| `config show` / `config set` | LLM backend + model configuration |

`<ref>` in chapter commands accepts either the full slug (`03-the-fall`) or just the
chapter number (`3`).

## Notes on the interactive chats

The story-bible and chapter-brief flows are open-ended conversations, not forms: talk
through your novel with the model, and send `/draft` whenever you want it to turn the
conversation so far into a structured YAML document (shown to you before anything is
saved). Keep revising and re-drafting, then `/save` to accept, or `/quit` to abandon.
