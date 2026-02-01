#!/usr/bin/env python3
"""
Test script for monthly review feature.
Demonstrates comparing two consecutive months with detailed breakdown and analysis.
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import asyncio
from advisor import BudgetAdvisor


async def test_monthly_review():
    """Test the monthly review feature"""

    print("=" * 100)
    print("Testing Monthly Review Feature")
    print("=" * 100)
    print()

    advisor = BudgetAdvisor()

    try:
        # Connect to MCP server
        print("Connecting to MCP server...")
        await advisor.connect_to_mcp_server()
        print("✓ Connected\n")

        # Test 1: Review January 2026 (comparing with December 2025)
        print("-" * 100)
        print("TEST 1: Monthly Review for January 2026")
        print("-" * 100)
        print()

        review = await advisor.generate_monthly_review(2026, 1)
        print(review)
        print()

        print("-" * 100)
        print("TEST COMPLETED SUCCESSFULLY!")
        print("-" * 100)

    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        await advisor.close()
        print("\n✓ Connection closed")


if __name__ == "__main__":
    print("\nThis test will demonstrate the monthly review feature.")
    print("It compares January 2026 with December 2025.\n")

    try:
        asyncio.run(test_monthly_review())
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)
