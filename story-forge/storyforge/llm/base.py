from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class Message:
    role: str  # "user" | "assistant"
    content: str


class LLMProvider(ABC):
    """Common interface every backend (Anthropic API, local Ollama, ...) implements."""

    name: str

    @abstractmethod
    def chat(self, system: str, messages: list[Message], max_tokens: int = 4096) -> str:
        """Send a system prompt + conversation turns, return the assistant's reply text."""

    @abstractmethod
    def is_available(self) -> tuple[bool, str]:
        """Return (ok, reason). Used to fail fast with a clear message before an interactive session."""
