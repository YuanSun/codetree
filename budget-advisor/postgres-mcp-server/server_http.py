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
from datetime import datetime, timedelta
from typing import Any, Optional

import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor

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

# Configure logging
logging.basicConfig(level=logging.INFO, stream=sys.stderr)
logger = logging.getLogger(__name__)

if not logger_initialized:
    logger.info("Loading environment from .env file")

# Database configuration from environment variables
DB_CONFIG = {
    "host": os.getenv("POSTGRES_HOST", "localhost"),
    "port": int(os.getenv("POSTGRES_PORT", "5432")),
    "database": os.getenv("POSTGRES_DB", "budget"),
    "user": os.getenv("POSTGRES_USER", "postgres"),
    "password": os.getenv("POSTGRES_PASSWORD", ""),
}

# Server configuration
SERVER_HOST = os.getenv("SERVER_HOST", "0.0.0.0")
SERVER_PORT = int(os.getenv("SERVER_PORT", "8080"))

# Connection pool
connection_pool = None


def init_database():
    """Initialize database connection pool"""
    global connection_pool
    try:
        connection_pool = pool.SimpleConnectionPool(
            1,  # minconn
            10,  # maxconn
            **DB_CONFIG
        )
        logger.info("Database connection pool initialized")
    except Exception as e:
        logger.error(f"Failed to initialize database pool: {e}")
        raise


def get_db_connection():
    """Get a connection from the pool"""
    return connection_pool.getconn()


def release_db_connection(conn):
    """Return a connection to the pool"""
    connection_pool.putconn(conn)


def execute_query(query: str) -> list[dict[str, Any]]:
    """Execute a SELECT query and return results"""
    # Security: Only allow SELECT queries
    if not query.strip().upper().startswith("SELECT"):
        raise ValueError("Only SELECT queries are allowed")

    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query)
            results = cur.fetchall()
            return [dict(row) for row in results]
    finally:
        release_db_connection(conn)


def get_weekly_expenses(weeks_back: int = 0) -> list[dict[str, Any]]:
    """Get total expenses for the current or past weeks, grouped by category"""
    query = f"""
        Select "typeName" as category, sum("expense_numeric") as total_amount, count(*) as transaction_count, DATE_TRUNC('week', date) as week_start
        from family_budget.dailyexpensevw
            where date >= DATE_TRUNC('week', CURRENT_DATE - interval '{weeks_back} weeks')
            and date < DATE_TRUNC('week', CURRENT_DATE - INTERVAL '{weeks_back - 1} weeks')
        group by category, DATE_TRUNC('week', date)
        order by total_amount desc;
    """
    logger.info("Run weekly expense query")
    return execute_query(query)


def get_monthly_summary(month: Optional[str] = None) -> list[dict[str, Any]]:
    """Get monthly expense summary with totals by category"""
    if month:
        month_condition = f"DATE_TRUNC('month', date) = DATE_TRUNC('month', '{month}-01'::date)"
    else:
        month_condition = "DATE_TRUNC('month', date) = DATE_TRUNC('month', CURRENT_DATE)"

    query = f"""
        SELECT
            "typeName" as category,
            SUM(expense_numeric) as total_amount,
            COUNT(*) as transaction_count,
            AVG(expense_numeric)::numeric(10, 2) as avg_amount,
            MIN(expense_numeric) as min_amount,
            MAX(expense_numeric) as max_amount
        FROM family_budget.dailyexpensevw
        WHERE {month_condition}
        GROUP BY category
        ORDER BY total_amount DESC;
    """
    return execute_query(query)


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
        if connection_pool:
            connection_pool.closeall()
            logger.info("Database connections closed")
