from __future__ import annotations

from .base import LLMProvider, Message


class MockProvider(LLMProvider):
    """Deterministic, offline stand-in used by `--provider mock` and the test suite.

    Lets you exercise the whole CLI flow (files written, prompts rendered) without
    an API key or a running Ollama instance.
    """

    name = "mock"

    def is_available(self) -> tuple[bool, str]:
        return True, ""

    def chat(self, system: str, messages: list[Message], max_tokens: int = 4096) -> str:
        last_user = next((m.content for m in reversed(messages) if m.role == "user"), "")

        if last_user.strip() == "/draft":
            # Fabricate a plausible structured draft so `/draft` -> `/save` can be
            # exercised end to end without a real LLM.
            if "chapter ticket" not in system.lower():
                return (
                    "```yaml\n"
                    "title: Mock Title\n"
                    "logline: A mock logline generated without a real LLM.\n"
                    "premise: |\n  A placeholder premise for testing.\n"
                    "themes: [testing, mock data]\n"
                    "main_story:\n"
                    "  synopsis: |\n    Placeholder synopsis.\n"
                    "  structure: three-act\n"
                    "main_development_milestones:\n"
                    "  - id: m1\n    title: Mock milestone\n    summary: |\n      Placeholder.\n"
                    "characters:\n"
                    "  - id: mock-hero\n    name: Mock Hero\n    role: protagonist\n"
                    "    summary: |\n      A placeholder protagonist.\n"
                    "```"
                )
            return (
                "```yaml\n"
                "title: Mock Chapter\n"
                "pov_character: mock-hero\n"
                "requirements:\n  - Placeholder requirement\n"
                "acceptance_criteria:\n  - Placeholder acceptance criterion\n"
                "considerations:\n  - Placeholder consideration\n"
                "five_w1h:\n  who: mock-hero\n  what: something happens\n  when: now\n"
                "  where: somewhere\n  why: because\n  how: somehow\n"
                "```"
            )

        return (
            "[mock response - no real LLM was called]\n\n"
            f"system prompt was {len(system)} chars; "
            f"last user turn: {last_user[:200]!r}"
        )
