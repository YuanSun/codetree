#!/usr/bin/env python3
"""
Budget Advisor PostgreSQL MCP Server - HTTP Version
Provides access to budget and expense data via Model Context Protocol over HTTP/SSE
This version can be accessed by remote AI tools and applications
"""

import os
import sys
import asyncio
import logging
from typing import Any

from mcp.server import Server
from mcp.server.sse import SseServerTransport
from mcp.types import Tool, TextContent
import uvicorn

try:
    from dotenv import load_dotenv
    load_dotenv()
    logger_initialized = False
except ImportError:
    logger_initialized = False
    print("Warning: python-dotenv not installed. Environment variables will not be loaded from .env file", file=sys.stderr)

# Import shared database operations
from db_operations import (
    init_database,
    close_all_connections,
    execute_query,
    get_weekly_expenses,
    get_monthly_summary,
    get_monthly_grouped_expenses,
    get_monthly_detailed_expenses,
    get_valid_type_names,
    get_expenses_by_category,
)

# Configure logging
logging.basicConfig(level=logging.INFO, stream=sys.stderr)
logger = logging.getLogger(__name__)

if not logger_initialized:
    logger.info("Loading environment from .env file")

# Server configuration
SERVER_HOST = os.getenv("SERVER_HOST", "0.0.0.0")
SERVER_PORT = int(os.getenv("SERVER_PORT", "8080"))

# Create MCP server instance
app = Server("budget-advisor-postgres")


@app.list_tools()
async def list_tools() -> list[Tool]:
    """List available tools"""
    return [
        Tool(
            name="query_expenses",
            description="Execute a custom SELECT query on the expenses database. Use this for flexible data retrieval.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "SQL SELECT query to execute (only SELECT queries allowed)"
                    }
                },
                "required": ["query"]
            }
        ),
        Tool(
            name="get_weekly_expenses",
            description="Get weekly expense summary grouped by category. Returns total, count, and average for each category.",
            inputSchema={
                "type": "object",
                "properties": {
                    "weeks_back": {
                        "type": "integer",
                        "description": "Number of weeks back from current week (0 = current week, 1 = last week, etc.)",
                        "default": 0
                    }
                },
                "required": []
            }
        ),
        Tool(
            name="get_monthly_summary",
            description="Get monthly expense summary grouped by category. Returns total, count, average, min, and max for each category.",
            inputSchema={
                "type": "object",
                "properties": {
                    "month": {
                        "type": "string",
                        "description": "Month in YYYY-MM format (e.g., '2024-07'). If not provided, uses current month.",
                        "default": None
                    }
                },
                "required": []
            }
        ),
        Tool(
            name="get_monthly_grouped_expenses",
            description="Get grouped monthly expenses by category for a specific year and month. Returns total expenses per category.",
            inputSchema={
                "type": "object",
                "properties": {
                    "target_year": {
                        "type": "number",
                        "description": "Target year (e.g., 2024)"
                    },
                    "target_month": {
                        "type": "number",
                        "description": "Target month (1-12)"
                    }
                },
                "required": ["target_year", "target_month"]
            }
        ),
        Tool(
            name="get_monthly_detailed_expenses",
            description="Get detailed transaction-level expenses for a specific year and month. Returns all transaction details including merchant info, dates, amounts, and comments.",
            inputSchema={
                "type": "object",
                "properties": {
                    "target_year": {
                        "type": "number",
                        "description": "Target year (e.g., 2024)"
                    },
                    "target_month": {
                        "type": "number",
                        "description": "Target month (1-12)"
                    }
                },
                "required": ["target_year", "target_month"]
            }
        ),
        Tool(
            name="get_expenses_by_category",
            description="Get all expenses for a specific category (typeName), year, and month. Validates category against MerchantType table. Returns all matching expense records.",
            inputSchema={
                "type": "object",
                "properties": {
                    "target_year": {
                        "type": "number",
                        "description": "Target year (e.g., 2024)"
                    },
                    "target_month": {
                        "type": "number",
                        "description": "Target month (1-12)"
                    },
                    "type_name": {
                        "type": "string",
                        "description": "Expense category/type name (e.g., 'Food', 'Transportation/Gas', 'Housing (Rent/Mortgage)'). Must be a valid type from MerchantType table."
                    }
                },
                "required": ["target_year", "target_month", "type_name"]
            }
        )
    ]


@app.call_tool()
async def call_tool(name: str, arguments: Any) -> list[TextContent]:
    """Handle tool calls"""
    try:
        if name == "query_expenses":
            query = arguments.get("query")
            if not query:
                raise ValueError("query parameter is required")
            results = execute_query(query)

        elif name == "get_weekly_expenses":
            weeks_back = arguments.get("weeks_back", 0)
            results = get_weekly_expenses(weeks_back)

        elif name == "get_monthly_summary":
            month = arguments.get("month")
            results = get_monthly_summary(month)

        elif name == "get_monthly_grouped_expenses":
            target_year = arguments.get("target_year")
            target_month = arguments.get("target_month")
            if not target_year or not target_month:
                raise ValueError("target_year and target_month parameters are required")
            results = get_monthly_grouped_expenses(int(target_year), int(target_month))

        elif name == "get_monthly_detailed_expenses":
            target_year = arguments.get("target_year")
            target_month = arguments.get("target_month")
            if not target_year or not target_month:
                raise ValueError("target_year and target_month parameters are required")
            results = get_monthly_detailed_expenses(int(target_year), int(target_month))

        elif name == "get_expenses_by_category":
            target_year = arguments.get("target_year")
            target_month = arguments.get("target_month")
            type_name = arguments.get("type_name")
            if not target_year or not target_month or not type_name:
                raise ValueError("target_year, target_month, and type_name parameters are required")
            results = get_expenses_by_category(int(target_year), int(target_month), type_name)

        else:
            raise ValueError(f"Unknown tool: {name}")

        # Convert results to JSON string
        import json
        return [TextContent(type="text", text=json.dumps(results, indent=2, default=str))]

    except Exception as e:
        logger.error(f"Error executing tool {name}: {e}")
        return [TextContent(type="text", text=f"Error: {str(e)}")]


async def main():
    """Main entry point for HTTP server"""
    logger.info(f"Starting Budget Advisor PostgreSQL MCP Server (HTTP)...")
    logger.info(f"Server will listen on {SERVER_HOST}:{SERVER_PORT}")

    # Initialize database
    init_database()

    # Create SSE transport (shared instance for routing)
    # The endpoint parameter tells the transport where to expect POST messages
    sse = SseServerTransport("/messages")

    logger.info("MCP Server ready to accept connections")

    async def asgi_app(scope, receive, send):
        """
        ASGI application that routes requests to appropriate handlers.

        MCP over SSE uses a bidirectional communication pattern:
        - GET /sse: SSE stream for server → client messages (responses, notifications)
        - POST /messages: HTTP POST for client → server requests (initialize, tool calls)

        This solves the problem that SSE is unidirectional (server → client only).
        Client sends requests via POST, receives responses via the SSE stream.
        """
        path = scope.get("path", "/")
        method = scope.get("method", "GET")

        logger.info(f"Incoming request: {method} {path}")

        if method == "GET" and path == "/sse":
            # Handle SSE connection (server → client stream)
            logger.info("Handling SSE connection (GET /sse)")
            async with sse.connect_sse(scope, receive, send) as (read, write):
                await app.run(read, write, app.create_initialization_options())

        elif method == "POST" and path == "/messages":
            # Handle incoming message (client → server request)
            logger.info("Handling POST message (POST /messages)")
            await sse.handle_post_message(scope, receive, send)

        else:
            # Unknown endpoint
            logger.warning(f"Unknown endpoint: {method} {path}")
            await send({
                "type": "http.response.start",
                "status": 404,
                "headers": [[b"content-type", b"text/plain"]],
            })
            await send({
                "type": "http.response.body",
                "body": b"Not Found. Use GET /sse or POST /messages",
            })

    # Run HTTP server with the ASGI router
    config = uvicorn.Config(
        asgi_app,
        host=SERVER_HOST,
        port=SERVER_PORT,
        log_level="info",
    )
    server = uvicorn.Server(config)
    await server.serve()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
    finally:
        close_all_connections()
