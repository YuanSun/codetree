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
    """Get weekly expense summary by category"""
    # Calculate the start and end of the target week
    today = datetime.now().date()
    start_of_week = today - timedelta(days=today.weekday() + (weeks_back * 7))
    end_of_week = start_of_week + timedelta(days=6)

    query = """
        SELECT
            category,
            SUM(amount) as total_amount,
            COUNT(*) as transaction_count,
            AVG(amount) as avg_amount
        FROM expenses
        WHERE date >= %s AND date <= %s
        GROUP BY category
        ORDER BY total_amount DESC
    """

    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, (start_of_week, end_of_week))
            results = cur.fetchall()
            return [dict(row) for row in results]
    finally:
        release_db_connection(conn)


def get_monthly_summary(month: Optional[str] = None) -> list[dict[str, Any]]:
    """Get monthly expense summary by category"""
    if month:
        # Parse YYYY-MM format
        try:
            year, month_num = map(int, month.split("-"))
            start_date = datetime(year, month_num, 1).date()
            # Calculate last day of month
            if month_num == 12:
                end_date = datetime(year + 1, 1, 1).date() - timedelta(days=1)
            else:
                end_date = datetime(year, month_num + 1, 1).date() - timedelta(days=1)
        except (ValueError, AttributeError):
            raise ValueError("Month must be in YYYY-MM format")
    else:
        # Current month
        today = datetime.now().date()
        start_date = today.replace(day=1)
        # Last day of current month
        if today.month == 12:
            end_date = datetime(today.year + 1, 1, 1).date() - timedelta(days=1)
        else:
            end_date = today.replace(month=today.month + 1, day=1) - timedelta(days=1)

    query = """
        SELECT
            category,
            SUM(amount) as total_amount,
            COUNT(*) as transaction_count,
            AVG(amount) as avg_amount,
            MIN(amount) as min_amount,
            MAX(amount) as max_amount
        FROM expenses
        WHERE date >= %s AND date <= %s
        GROUP BY category
        ORDER BY total_amount DESC
    """

    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, (start_date, end_date))
            results = cur.fetchall()
            return [dict(row) for row in results]
    finally:
        release_db_connection(conn)


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

    # Run the SSE transport as the ASGI app directly
    logger.info("MCP Server ready to accept connections")

    async def handle_sse(scope, receive, send):
        """ASGI application for MCP over SSE"""
        # Create a new SSE transport for each connection
        sse = SseServerTransport("/messages")

        async with sse.connect_sse(scope, receive, send) as (read, write):
            await app.run(read, write, app.create_initialization_options())

    # Run HTTP server with the SSE handler
    config = uvicorn.Config(
        handle_sse,
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
