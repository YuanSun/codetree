#!/usr/bin/env python3
"""
Test script for the new monthly expense tools.
Tests both get_monthly_grouped_expenses and get_monthly_detailed_expenses.
"""

import asyncio
import json
from datetime import datetime
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


async def test_monthly_tools():
    """Test the new monthly expense tools"""

    # Get current year and month for testing
    current_year = datetime.now().year
    current_month = datetime.now().month

    print("=" * 80)
    print(f"Testing MCP Monthly Expense Tools - {current_year}-{current_month:02d}")
    print("=" * 80)
    print()

    # Connect to MCP server
    server_params = StdioServerParameters(
        command="python3",
        args=["server.py"]
    )

    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            # Initialize the session
            await session.initialize()

            print("✓ Connected to MCP server\n")

            # List all available tools
            tools = await session.list_tools()
            print(f"Available tools ({len(tools.tools)}):")
            for tool in tools.tools:
                print(f"  - {tool.name}: {tool.description}")
            print()

            # Test 1: Get monthly grouped expenses
            print("-" * 80)
            print(f"TEST 1: get_monthly_grouped_expenses({current_year}, {current_month})")
            print("-" * 80)

            result1 = await session.call_tool(
                "get_monthly_grouped_expenses",
                arguments={
                    "target_year": current_year,
                    "target_month": current_month
                }
            )

            if result1.content:
                data1 = json.loads(result1.content[0].text)
                print(f"\n✓ Received {len(data1)} expense categories:")
                print()

                # Display as a table
                if data1:
                    print(f"{'Category':<30} {'Total Expense':>15}")
                    print("-" * 47)
                    total = 0
                    for item in data1:
                        category = item.get('typeName', 'Unknown')
                        amount = float(item.get('total_expense', 0))
                        total += amount
                        print(f"{category:<30} ${amount:>14,.2f}")
                    print("-" * 47)
                    print(f"{'TOTAL':<30} ${total:>14,.2f}")
                else:
                    print("No expenses found for this period.")
            print()

            # Test 2: Get monthly detailed expenses (limit to first 10)
            print("-" * 80)
            print(f"TEST 2: get_monthly_detailed_expenses({current_year}, {current_month})")
            print("-" * 80)

            result2 = await session.call_tool(
                "get_monthly_detailed_expenses",
                arguments={
                    "target_year": current_year,
                    "target_month": current_month
                }
            )

            if result2.content:
                data2 = json.loads(result2.content[0].text)
                print(f"\n✓ Received {len(data2)} detailed transactions")
                print()

                # Display first 10 transactions
                if data2:
                    print("First 10 transactions:")
                    print(f"{'Date':<12} {'Category':<20} {'Merchant':<25} {'Amount':>12}")
                    print("-" * 70)

                    for i, item in enumerate(data2[:10]):
                        date = str(item.get('date', 'N/A'))[:10]
                        category = item.get('typeName', 'Unknown')[:19]
                        merchant = item.get('merchantName', 'N/A')[:24]
                        amount = float(item.get('expense_numeric', 0))
                        print(f"{date:<12} {category:<20} {merchant:<25} ${amount:>11,.2f}")

                    if len(data2) > 10:
                        print(f"... and {len(data2) - 10} more transactions")
                else:
                    print("No detailed transactions found for this period.")
            print()

            # Test 3: Try a different month (previous month)
            prev_month = current_month - 1 if current_month > 1 else 12
            prev_year = current_year if current_month > 1 else current_year - 1

            print("-" * 80)
            print(f"TEST 3: get_monthly_grouped_expenses({prev_year}, {prev_month})")
            print("-" * 80)

            result3 = await session.call_tool(
                "get_monthly_grouped_expenses",
                arguments={
                    "target_year": prev_year,
                    "target_month": prev_month
                }
            )

            if result3.content:
                data3 = json.loads(result3.content[0].text)
                print(f"\n✓ Received {len(data3)} expense categories for previous month")

                if data3:
                    total_prev = sum(float(item.get('total_expense', 0)) for item in data3)
                    print(f"  Total spending: ${total_prev:,.2f}")
                else:
                    print("  No expenses found for previous month.")
            print()

            print("=" * 80)
            print("All tests completed successfully! ✓")
            print("=" * 80)


if __name__ == "__main__":
    try:
        asyncio.run(test_monthly_tools())
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
