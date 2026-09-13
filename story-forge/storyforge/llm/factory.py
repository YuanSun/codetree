from __future__ import annotations

from ..config import Config
from .anthropic_provider import AnthropicProvider
from .base import LLMProvider
from .mock_provider import MockProvider
from .ollama_provider import OllamaProvider


def get_provider(config: Config, override: str | None = None) -> LLMProvider:
    provider = override or config.provider
    if provider == "anthropic":
        return AnthropicProvider(model=config.anthropic_model, api_key=config.anthropic_api_key())
    if provider == "ollama":
        return OllamaProvider(model=config.ollama_model, host=config.ollama_host)
    if provider == "mock":
        return MockProvider()
    raise ValueError(f"Unknown provider {provider!r}. Choose from: anthropic, ollama, mock")
