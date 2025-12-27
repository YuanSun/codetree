#!/usr/bin/env python3
"""
Interactive MCP client for testing the HTTP server.
Allows you to call MCP tools interactively.
"""

import asyncio
import sys
import json
from mcp import ClientSession
from mcp.client.sse import sse_client


async def interactive_test():
    """Interactive MCP testing."""

    server_url = "http://localhost:8080"

    print(f"🔗 Connecting to MCP server at {server_url}...")

    try:
        async with sse_client(server_url) as (read, write):
            async with ClientSession(read, write) as session:
                # Initialize
                await session.initialize()
                print("✅ Connected successfully!\n")

                # List tools
                tools_response = await session.list_tools()
                available_tools = {tool.name: tool for tool in tools_response.tools}

                while True:
                    print("\n" + "="*60)
                    print("Available commands:")
                    print("  1. list - List all available tools")
                    print("  2. weekly - Get weekly expenses")
                    print("  3. monthly [YYYY-MM] - Get monthly summary")
                    print("  4. query <SQL> - Execute a SELECT query")
                    print("  5. quit - Exit")
                    print("="*60)

                    command = input("\nEnter command: ").strip()

                    if command == "quit":
                        print("Goodbye!")
                        break

                    elif command == "list":
                        print("\n📦 Available tools:")
                        for name, tool in available_tools.items():
                            print(f"  • {name}: {tool.description}")

                    elif command == "weekly":
                        print("\n⏳ Fetching weekly expenses...")
                        result = await session.call_tool("get_weekly_expenses", arguments={})
                        print_result(result)

                    elif command.startswith("monthly"):
                        parts = command.split(maxsplit=1)
                        month = parts[1] if len(parts) > 1 else None
                        args = {"month": month} if month else {}

                        print(f"\n⏳ Fetching monthly summary{' for ' + month if month else ''}...")
                        result = await session.call_tool("get_monthly_summary", arguments=args)
                        print_result(result)

                    elif command.startswith("query "):
                        query = command[6:].strip()
                        print(f"\n⏳ Executing query: {query}")
                        result = await session.call_tool("execute_query", arguments={"query": query})
                        print_result(result)

                    else:
                        print("❌ Unknown command. Try 'list', 'weekly', 'monthly', 'query', or 'quit'")

    except KeyboardInterrupt:
        print("\n\nInterrupted by user. Goodbye!")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


def print_result(result):
    """Pretty print MCP result."""
    print("\n📊 Result:")
    for item in result.content:
        if hasattr(item, 'text'):
            try:
                # Try to parse as JSON for pretty printing
                data = json.loads(item.text)
                print(json.dumps(data, indent=2))
            except:
                print(item.text)
        else:
            print(item)


if __name__ == "__main__":
    asyncio.run(interactive_test())
