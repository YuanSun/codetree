#!/usr/bin/env python3
"""
Obsidian MCP Server
Exposes Obsidian vault operations via Model Context Protocol (MCP) using SSE transport.
"""

import asyncio
import json
import logging
import sys
from typing import Any

from mcp.server import Server
from mcp.server.sse import SseServerTransport
from mcp.types import (
    Tool,
    TextContent,
    INTERNAL_ERROR,
    INVALID_PARAMS,
)

from obsidian_operations import create_obsidian_client_from_env

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger(__name__)

# Initialize Obsidian client
try:
    obsidian_client = create_obsidian_client_from_env()
    logger.info("Obsidian client initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize Obsidian client: {e}")
    sys.exit(1)

# Create MCP server
app = Server("obsidian-mcp-server")


@app.list_tools()
async def list_tools() -> list[Tool]:
    """List available Obsidian tools"""
    return [
        Tool(
            name="get_vault_info",
            description="Get information about the Obsidian vault",
            inputSchema={
                "type": "object",
                "properties": {},
            },
        ),
        Tool(
            name="list_files",
            description="List files in vault or specific directory",
            inputSchema={
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Directory path (leave empty for root)",
                        "default": ""
                    }
                },
            },
        ),
        Tool(
            name="get_note",
            description="Get content of a note",
            inputSchema={
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "Path to the note file (e.g., 'folder/note.md')",
                    }
                },
                "required": ["file_path"],
            },
        ),
        Tool(
            name="create_note",
            description="Create a new note in the vault",
            inputSchema={
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "Path where to create the note (e.g., 'folder/note.md')",
                    },
                    "content": {
                        "type": "string",
                        "description": "Content of the note in markdown format",
                    }
                },
                "required": ["file_path", "content"],
            },
        ),
        Tool(
            name="update_note",
            description="Update existing note content (replaces entire content)",
            inputSchema={
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "Path to the note",
                    },
                    "content": {
                        "type": "string",
                        "description": "New content for the note",
                    }
                },
                "required": ["file_path", "content"],
            },
        ),
        Tool(
            name="append_to_note",
            description="Append content to existing note",
            inputSchema={
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "Path to the note",
                    },
                    "content": {
                        "type": "string",
                        "description": "Content to append",
                    }
                },
                "required": ["file_path", "content"],
            },
        ),
        Tool(
            name="delete_note",
            description="Delete a note from the vault",
            inputSchema={
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "Path to the note to delete",
                    }
                },
                "required": ["file_path"],
            },
        ),
        Tool(
            name="search_notes",
            description="Search notes in the vault using text search",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query",
                    }
                },
                "required": ["query"],
            },
        ),
        Tool(
            name="get_active_file",
            description="Get currently active file in Obsidian",
            inputSchema={
                "type": "object",
                "properties": {},
            },
        ),
        Tool(
            name="get_tags",
            description="Get all tags used in the vault",
            inputSchema={
                "type": "object",
                "properties": {},
            },
        ),
    ]


@app.call_tool()
async def call_tool(name: str, arguments: Any) -> list[TextContent]:
    """Handle tool calls"""
    try:
        logger.info(f"Tool called: {name} with arguments: {arguments}")

        if name == "get_vault_info":
            result = obsidian_client.get_vault_info()

        elif name == "list_files":
            path = arguments.get("path", "")
            result = obsidian_client.list_files(path)

        elif name == "get_note":
            file_path = arguments.get("file_path")
            if not file_path:
                raise ValueError("file_path is required")
            result = obsidian_client.get_file_content(file_path)

        elif name == "create_note":
            file_path = arguments.get("file_path")
            content = arguments.get("content")
            if not file_path or content is None:
                raise ValueError("file_path and content are required")
            result = obsidian_client.create_note(file_path, content)

        elif name == "update_note":
            file_path = arguments.get("file_path")
            content = arguments.get("content")
            if not file_path or content is None:
                raise ValueError("file_path and content are required")
            result = obsidian_client.update_note(file_path, content)

        elif name == "append_to_note":
            file_path = arguments.get("file_path")
            content = arguments.get("content")
            if not file_path or content is None:
                raise ValueError("file_path and content are required")
            result = obsidian_client.append_to_note(file_path, content)

        elif name == "delete_note":
            file_path = arguments.get("file_path")
            if not file_path:
                raise ValueError("file_path is required")
            result = obsidian_client.delete_note(file_path)

        elif name == "search_notes":
            query = arguments.get("query")
            if not query:
                raise ValueError("query is required")
            result = obsidian_client.search_notes(query)

        elif name == "get_active_file":
            result = obsidian_client.get_active_file()

        elif name == "get_tags":
            result = obsidian_client.get_tags()

        else:
            raise ValueError(f"Unknown tool: {name}")

        # Format result as JSON string
        result_text = json.dumps(result, indent=2, ensure_ascii=False)

        return [TextContent(type="text", text=result_text)]

    except ValueError as e:
        logger.error(f"Invalid parameters: {e}")
        raise INVALID_PARAMS(str(e))
    except Exception as e:
        logger.error(f"Tool execution failed: {e}", exc_info=True)
        raise INTERNAL_ERROR(str(e))


async def main():
    """Main entry point for SSE server"""
    logger.info("Starting Obsidian MCP Server with SSE transport...")

    from mcp.server.sse import sse_server

    async with sse_server() as streams:
        await app.run(
            streams[0],
            streams[1],
            app.create_initialization_options()
        )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
    except Exception as e:
        logger.error(f"Server error: {e}", exc_info=True)
        sys.exit(1)
