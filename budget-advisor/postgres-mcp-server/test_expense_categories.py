#!/usr/bin/env python3
"""
Test script for the get_expense_categories tool.
Tests that the tool correctly returns all valid category names.
"""

import sys
from datetime import datetime

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from db_operations import (
    init_database,
    close_all_connections,
    get_valid_type_names,
)


def test_expense_categories():
    """Test the get_expense_categories functionality"""

    print("=" * 80)
    print("Testing get_expense_categories (get_valid_type_names)")
    print("=" * 80)
    print()

    try:
        # Initialize database connection
        print("Initializing database connection...")
        init_database()
        print("✓ Database connected\n")

        # Test: Get all valid category names
        print("-" * 80)
        print("TEST: Get all expense categories from MerchantType table")
        print("-" * 80)

        category_names = get_valid_type_names()
        print(f"\n✓ Retrieved {len(category_names)} valid expense categories:")
        print()

        # Display categories in a formatted list
        for i, category in enumerate(category_names, 1):
            print(f"  {i:2d}. {category}")
        print()

        # Show what the MCP tool would return
        print("-" * 80)
        print("MCP Tool Response Format:")
        print("-" * 80)
        print()
        print("[\n  {")
        for i, category in enumerate(category_names[:3], 1):
            print(f'    "typeName": "{category}"')
            print("  },\n  {" if i < 3 else "  }")
        if len(category_names) > 3:
            print(f"  ... and {len(category_names) - 3} more categories")
        print("]")
        print()

        # Show use case
        print("-" * 80)
        print("Use Case Example:")
        print("-" * 80)
        print()
        print("# AI can first discover available categories:")
        print("categories = await session.call_tool('get_expense_categories')")
        print()
        print("# Then query expenses for a specific category:")
        print("food_expenses = await session.call_tool('get_expenses_by_category', {")
        print("    'target_year': 2024,")
        print("    'target_month': 1,")
        print(f"    'type_name': '{category_names[0] if category_names else 'Food'}'")
        print("})")
        print()

        print("=" * 80)
        print("Test completed successfully! ✓")
        print("=" * 80)

    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        close_all_connections()
        print("\n✓ Database connection closed")


if __name__ == "__main__":
    test_expense_categories()
