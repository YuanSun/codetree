"""Client for an OpenAI-compatible /v1/embeddings endpoint.

Works against LM Studio (or Ollama's OpenAI shim) serving a dedicated
embedding model — LM Studio's chat models (gpt-oss-20b, qwen3-vl-30b) do
not expose embeddings, so this expects a separate embedding model/port
(e.g. nomic-embed-text or bge-small) configured via EMBEDDING_API_URL.
"""

from __future__ import annotations

import httpx

from .config import Settings


class EmbeddingError(RuntimeError):
    pass


class EmbeddingClient:
    def __init__(self, settings: Settings, client: httpx.Client | None = None):
        self._settings = settings
        self._client = client or httpx.Client(timeout=60.0)
        self._owns_client = client is None

    def close(self) -> None:
        if self._owns_client:
            self._client.close()

    def __enter__(self) -> "EmbeddingClient":
        return self

    def __exit__(self, *exc) -> None:
        self.close()

    def embed(self, texts: list[str]) -> list[list[float]]:
        """Embeds a batch of texts, preserving input order."""
        if not texts:
            return []

        response = self._client.post(
            self._settings.embedding_api_url,
            json={"model": self._settings.embedding_model, "input": texts},
        )
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise EmbeddingError(
                f"Embedding request failed ({response.status_code}): {response.text[:500]}"
            ) from exc

        payload = response.json()
        try:
            data = sorted(payload["data"], key=lambda item: item["index"])
            vectors = [item["embedding"] for item in data]
        except (KeyError, TypeError) as exc:
            raise EmbeddingError(f"Unexpected embeddings response shape: {payload!r}") from exc

        for vector in vectors:
            if len(vector) != self._settings.embedding_dim:
                raise EmbeddingError(
                    f"Embedding dim mismatch: got {len(vector)}, "
                    f"expected {self._settings.embedding_dim} "
                    "(check EMBEDDING_DIM matches the served model)"
                )
        return vectors

    def embed_one(self, text: str) -> list[float]:
        return self.embed([text])[0]
