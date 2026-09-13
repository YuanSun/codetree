from __future__ import annotations

from .base import LLMProvider, Message


class AnthropicProvider(LLMProvider):
    name = "anthropic"

    def __init__(self, model: str, api_key: str | None):
        self.model = model
        self.api_key = api_key
        self._client = None

    def is_available(self) -> tuple[bool, str]:
        if not self.api_key:
            return False, (
                "ANTHROPIC_API_KEY is not set. Export it in your shell, e.g.\n"
                "  export ANTHROPIC_API_KEY=sk-ant-..."
            )
        try:
            import anthropic  # noqa: F401
        except ImportError:
            return False, "The 'anthropic' package is not installed. Run: pip install anthropic"
        return True, ""

    def _get_client(self):
        if self._client is None:
            import anthropic

            self._client = anthropic.Anthropic(api_key=self.api_key)
        return self._client

    def chat(self, system: str, messages: list[Message], max_tokens: int = 4096) -> str:
        client = self._get_client()
        response = client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": m.role, "content": m.content} for m in messages],
        )
        return "".join(block.text for block in response.content if block.type == "text")
