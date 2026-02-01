#!/usr/bin/env python3
"""
Budget Advisor PostgreSQL MCP Server
Provides access to budget and expense data via Model Context Protocol
"""

import os
import sys
import asyncio
import logging
from typing import Any

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("Warning: python-dotenv not installed. Environment variables will not be loaded from .env file")

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

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
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=getattr(logging, LOG_LEVEL), format='%(asctime)s - %(levelname)s - %(message)s', stream=sys.stderr)
logger = logging.getLogger(__name__)

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
        Tool(
            name="get_monthly_grouped_expenses",
            description="Get grouped monthly expenses by category for a specific year and month. Returns total expenses per category.",
            inputSchema={
                "type": "object",
                "properties": {
                    "target_year": {
                        "type": "number",
                        "description": "Target year (e.g., 2024)",
                    },
                    "target_month": {
                        "type": "number",
                        "description": "Target month (1-12)",
                    },
                },
                "required": ["target_year", "target_month"],
            },
        ),
        Tool(
            name="get_monthly_detailed_expenses",
            description="Get detailed transaction-level expenses for a specific year and month. Returns all transaction details including merchant info, dates, amounts, and comments.",
            inputSchema={
                "type": "object",
                "properties": {
                    "target_year": {
                        "type": "number",
                        "description": "Target year (e.g., 2024)",
                    },
                    "target_month": {
                        "type": "number",
                        "description": "Target month (1-12)",
                    },
                },
                "required": ["target_year", "target_month"],
            },
        ),
        Tool(
            name="get_expenses_by_category",
            description="Get all expenses for a specific category (typeName), year, and month. Validates category against MerchantType table. Returns all matching expense records.",
            inputSchema={
                "type": "object",
                "properties": {
                    "target_year": {
                        "type": "number",
                        "description": "Target year (e.g., 2024)",
                    },
                    "target_month": {
                        "type": "number",
                        "description": "Target month (1-12)",
                    },
                    "type_name": {
                        "type": "string",
                        "description": "Expense category/type name (e.g., 'Food', 'Transportation/Gas', 'Housing (Rent/Mortgage)'). Must be a valid type from MerchantType table.",
                    },
                },
                "required": ["target_year", "target_month", "type_name"],
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
        close_all_connections()
