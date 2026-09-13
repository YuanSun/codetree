"""Global tool configuration: which LLM provider/model to use, which project is active.

Stored at <repo_root>/.storyforge/config.yaml so it never gets committed (see .gitignore)
and never touches the user's actual novel content under projects/.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, asdict
from pathlib import Path

import yaml

ROOT_DIR = Path(__file__).resolve().parent.parent
PROJECTS_DIR = ROOT_DIR / "projects"
STATE_DIR = ROOT_DIR / ".storyforge"
CONFIG_PATH = STATE_DIR / "config.yaml"

DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5"
DEFAULT_OLLAMA_MODEL = "llama3.1"
DEFAULT_OLLAMA_HOST = "http://localhost:11434"


@dataclass
class Config:
    provider: str = "anthropic"  # "anthropic" | "ollama"
    anthropic_model: str = DEFAULT_ANTHROPIC_MODEL
    ollama_model: str = DEFAULT_OLLAMA_MODEL
    ollama_host: str = DEFAULT_OLLAMA_HOST
    current_project: str | None = None

    @classmethod
    def load(cls) -> "Config":
        if CONFIG_PATH.exists():
            data = yaml.safe_load(CONFIG_PATH.read_text()) or {}
            return cls(**{**asdict(cls()), **data})
        return cls()

    def save(self) -> None:
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        CONFIG_PATH.write_text(yaml.safe_dump(asdict(self), sort_keys=False))

    def anthropic_api_key(self) -> str | None:
        return os.environ.get("ANTHROPIC_API_KEY")
