#!/usr/bin/env python3
"""
Manual test script for the HTTP MCP server.
Tests the server by connecting as an MCP client and calling tools.
"""

import asyncio
import os
import sys
from mcp import ClientSession
from mcp.client.sse import sse_client

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv("postgres-mcp-server/.env")
except ImportError:
    pass


async def test_mcp_server():
    """Test the HTTP MCP server by connecting and calling tools."""

    server_port = os.getenv("SERVER_PORT", "8080")
    server_url = f"http://localhost:{server_port}"

    print(f"Connecting to MCP server at {server_url}...")

    try:
        # Connect using SSE client
        async with sse_client(server_url) as (read, write):
            async with ClientSession(read, write) as session:
                # Initialize the session
                print("Initializing session...")
                await session.initialize()
                print("✓ Session initialized successfully")

                # List available tools
                print("\n=== Listing available tools ===")
                tools_response = await session.list_tools()

                if not tools_response.tools:
                    print("No tools found!")
                    return

                for tool in tools_response.tools:
                    print(f"\n📦 Tool: {tool.name}")
                    print(f"   Description: {tool.description}")
                    if hasattr(tool, 'inputSchema'):
                        print(f"   Input schema: {tool.inputSchema}")

                # Test 1: Get weekly expenses
                print("\n\n=== Test 1: Get weekly expenses ===")
                result = await session.call_tool("get_weekly_expenses", arguments={})
                print(f"Result: {result.content}")

                # Test 2: Get monthly summary
                print("\n\n=== Test 2: Get monthly summary ===")
                result = await session.call_tool("get_monthly_summary", arguments={})
                print(f"Result: {result.content}")

                # Test 3: Execute a SELECT query
                print("\n\n=== Test 3: Execute SELECT query ===")
                result = await session.call_tool(
                    "execute_query",
                    arguments={"query": "SELECT category, SUM(amount) as total FROM expenses GROUP BY category LIMIT 5"}
                )
                print(f"Result: {result.content}")

                print("\n\n✅ All tests completed successfully!")

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(test_mcp_server())
