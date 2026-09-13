from __future__ import annotations

from .base import LLMProvider, Message


class OllamaProvider(LLMProvider):
    name = "ollama"

    def __init__(self, model: str, host: str):
        self.model = model
        self.host = host.rstrip("/")

    def is_available(self) -> tuple[bool, str]:
        try:
            import httpx

            resp = httpx.get(f"{self.host}/api/tags", timeout=3.0)
            resp.raise_for_status()
        except Exception as exc:  # noqa: BLE001 - surface any connectivity issue as a hint
            return False, (
                f"Could not reach Ollama at {self.host} ({exc}).\n"
                "Is it running? Try: ollama serve"
            )
        return True, ""

    def chat(self, system: str, messages: list[Message], max_tokens: int = 4096) -> str:
        import httpx

        payload = {
            "model": self.model,
            "messages": [{"role": "system", "content": system}]
            + [{"role": m.role, "content": m.content} for m in messages],
            "stream": False,
            "options": {"num_predict": max_tokens},
        }
        resp = httpx.post(f"{self.host}/api/chat", json=payload, timeout=180.0)
        resp.raise_for_status()
        data = resp.json()
        return data["message"]["content"]
