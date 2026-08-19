#!/usr/bin/env python3
"""Thin stdio MCP server for the vault retrieval API.

Zed only speaks stdio MCP (not HTTP/SSE), so this process holds no
indexing or embedding logic itself — it just forwards search_vault /
get_note tool calls to the HTTP query API and returns the JSON response
as the tool result. Point multiple clients (Zed, Claude Desktop, ...) at
their own copy of this wrapper against the same running API.
"""

from __future__ import annotations

import logging
import sys

import httpx
from mcp.server.fastmcp import FastMCP

from ..config import get_settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    stream=sys.stderr,
)
logger = logging.getLogger(__name__)

mcp = FastMCP("obsidian-vault-search")


@mcp.tool()
async def search_vault(
    query: str,
    top_k: int = 5,
    tags: list[str] | None = None,
    folder: str | None = None,
) -> dict:
    """Semantic search over the Obsidian vault.

    Returns ranked note sections (with note path and section title)
    relevant to the query.
    """
    settings = get_settings()
    async with httpx.AsyncClient(base_url=settings.api_base_url, timeout=30.0) as client:
        response = await client.post(
            "/search",
            json={"query": query, "top_k": top_k, "tags": tags or [], "folder": folder},
        )
        response.raise_for_status()
        return response.json()


@mcp.tool()
async def get_note(path: str) -> dict:
    """Fetch the full content of a single note by its vault-relative path."""
    settings = get_settings()
    async with httpx.AsyncClient(base_url=settings.api_base_url, timeout=30.0) as client:
        response = await client.get(f"/notes/{path}")
        response.raise_for_status()
        return response.json()


def main() -> None:
    logger.info("Starting Obsidian vault search MCP server (stdio)...")
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
