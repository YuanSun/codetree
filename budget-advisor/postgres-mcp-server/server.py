#!/usr/bin/env python3
"""
Budget Advisor PostgreSQL MCP Server
Provides access to budget and expense data via Model Context Protocol
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
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

# Configure logging
logging.basicConfig(level=logging.INFO, stream=sys.stderr)
logger = logging.getLogger(__name__)

# Database configuration from environment variables
DB_CONFIG = {
    "host": os.getenv("POSTGRES_HOST", "localhost"),
    "port": int(os.getenv("POSTGRES_PORT", "5432")),
    "database": os.getenv("POSTGRES_DB", "budget"),
    "user": os.getenv("POSTGRES_USER", "postgres"),
    "password": os.getenv("POSTGRES_PASSWORD", ""),
}

# Global connection pool
connection_pool: Optional[pool.SimpleConnectionPool] = None


def init_database():
    """Initialize PostgreSQL connection pool"""
    global connection_pool
    try:
        connection_pool = pool.SimpleConnectionPool(
            minconn=1,
            maxconn=10,
            **DB_CONFIG
        )
        logger.info("Database connection pool initialized")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        raise


def get_connection():
    """Get a connection from the pool"""
    if connection_pool is None:
        raise RuntimeError("Database not initialized")
    return connection_pool.getconn()


def release_connection(conn):
    """Release a connection back to the pool"""
    if connection_pool is not None:
        connection_pool.putconn(conn)


def execute_query(query: str) -> list[dict[str, Any]]:
    """Execute a SQL query and return results as list of dictionaries"""
    # Basic SQL injection protection - only allow SELECT statements
    if not query.strip().upper().startswith("SELECT"):
        raise ValueError("Only SELECT queries are allowed")

    conn = None
    try:
        conn = get_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(query)
            results = cursor.fetchall()
            # Convert RealDictRow to regular dict
            return [dict(row) for row in results]
    finally:
        if conn:
            release_connection(conn)


def get_weekly_expenses(weeks_back: int = 0) -> list[dict[str, Any]]:
    """Get total expenses for the current or past weeks, grouped by category"""
    query = f"""
        SELECT
            category,
            SUM(amount) as total_amount,
            COUNT(*) as transaction_count,
            DATE_TRUNC('week', date) as week_start
        FROM expenses
        WHERE date >= DATE_TRUNC('week', CURRENT_DATE - INTERVAL '{weeks_back} weeks')
          AND date < DATE_TRUNC('week', CURRENT_DATE - INTERVAL '{weeks_back - 1} weeks')
        GROUP BY category, DATE_TRUNC('week', date)
        ORDER BY total_amount DESC;
    """
    return execute_query(query)


def get_monthly_summary(month: Optional[str] = None) -> list[dict[str, Any]]:
    """Get monthly expense summary with totals by category"""
    if month:
        month_condition = f"DATE_TRUNC('month', date) = DATE_TRUNC('month', '{month}-01'::date)"
    else:
        month_condition = "DATE_TRUNC('month', date) = DATE_TRUNC('month', CURRENT_DATE)"

    query = f"""
        SELECT
            category,
            SUM(amount) as total_amount,
            COUNT(*) as transaction_count,
            AVG(amount) as avg_amount,
            MIN(amount) as min_amount,
            MAX(amount) as max_amount
        FROM expenses
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
            description="Execute a SQL query to retrieve expense data from the budget database. Returns the query results as JSON.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "SQL query to execute (SELECT statements only)",
                    },
                },
                "required": ["query"],
            },
        ),
        Tool(
            name="get_weekly_expenses",
            description="Get total expenses for the current week grouped by category",
            inputSchema={
                "type": "object",
                "properties": {
                    "weeks_back": {
                        "type": "number",
                        "description": "Number of weeks back from current week (default: 0 for current week)",
                        "default": 0,
                    },
                },
            },
        ),
        Tool(
            name="get_monthly_summary",
            description="Get monthly expense summary with totals by category",
            inputSchema={
                "type": "object",
                "properties": {
                    "month": {
                        "type": "string",
                        "description": "Month in YYYY-MM format (default: current month)",
                    },
                },
            },
        ),
    ]


@app.call_tool()
async def call_tool(name: str, arguments: Any) -> list[TextContent]:
    """Handle tool execution"""
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
    """Main entry point"""
    logger.info("Starting Budget Advisor PostgreSQL MCP Server...")

    # Initialize database
    init_database()

    # Run the server
    async with stdio_server() as (read_stream, write_stream):
        await app.run(
            read_stream,
            write_stream,
            app.create_initialization_options()
        )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
    finally:
        if connection_pool:
            connection_pool.closeall()
            logger.info("Database connections closed")
