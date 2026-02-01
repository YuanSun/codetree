#!/usr/bin/env python3
"""
Test script for the new get_expenses_by_category tool.
Tests category validation and expense filtering.
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
    get_expenses_by_category,
)


def test_category_query():
    """Test the new get_expenses_by_category function"""

    # Get current year and month
    current_year = datetime.now().year
    current_month = datetime.now().month

    print("=" * 80)
    print("Testing get_expenses_by_category Tool")
    print("=" * 80)
    print()

    try:
        # Initialize database connection
        print("Initializing database connection...")
        init_database()
        print("✓ Database connected\n")

        # Test 1: Get valid type names
        print("-" * 80)
        print("TEST 1: Get valid type names from MerchantType table")
        print("-" * 80)

        valid_types = get_valid_type_names()
        print(f"\n✓ Retrieved {len(valid_types)} valid expense types:")
        print()
        for i, type_name in enumerate(valid_types, 1):
            print(f"  {i:2d}. {type_name}")
        print()

        # Test 2: Query expenses for first valid category
        if valid_types:
            test_category = valid_types[0]
            print("-" * 80)
            print(f"TEST 2: Get expenses for category '{test_category}'")
            print(f"         ({current_year}-{current_month:02d})")
            print("-" * 80)

            expenses = get_expenses_by_category(current_year, current_month, test_category)
            print(f"\n✓ Retrieved {len(expenses)} expenses for '{test_category}'")
            print()

            if expenses:
                print("First 5 transactions:")
                print(f"{'Date':<12} {'Merchant':<30} {'Amount':>12}")
                print("-" * 56)

                for expense in expenses[:5]:
                    date = str(expense.get('date', 'N/A'))[:10]
                    merchant = str(expense.get('merchantName', 'N/A'))[:29]
                    amount = float(expense.get('expense_numeric', 0))
                    print(f"{date:<12} {merchant:<30} ${amount:>11,.2f}")

                if len(expenses) > 5:
                    print(f"... and {len(expenses) - 5} more transactions")

                # Calculate total
                total = sum(float(e.get('expense_numeric', 0)) for e in expenses)
                print("-" * 56)
                print(f"{'TOTAL':<42} ${total:>11,.2f}")
            else:
                print(f"No expenses found for '{test_category}' in {current_year}-{current_month:02d}")
            print()

        # Test 3: Try to query with invalid category (should fail)
        print("-" * 80)
        print("TEST 3: Test validation with invalid category")
        print("-" * 80)

        invalid_category = "InvalidCategoryXYZ123"
        print(f"\nAttempting to query with invalid category: '{invalid_category}'")

        try:
            expenses = get_expenses_by_category(current_year, current_month, invalid_category)
            print("❌ ERROR: Should have raised ValueError for invalid category!")
        except ValueError as e:
            print(f"✓ Correctly rejected invalid category:")
            print(f"  Error: {e}")
        print()

        # Test 4: Query expenses for "Food" category if it exists
        if "Food" in valid_types:
            print("-" * 80)
            print("TEST 4: Get all Food expenses")
            print(f"         ({current_year}-{current_month:02d})")
            print("-" * 80)

            food_expenses = get_expenses_by_category(current_year, current_month, "Food")
            print(f"\n✓ Retrieved {len(food_expenses)} food expenses")

            if food_expenses:
                total_food = sum(float(e.get('expense_numeric', 0)) for e in food_expenses)
                avg_food = total_food / len(food_expenses)
                print(f"  Total: ${total_food:,.2f}")
                print(f"  Average: ${avg_food:,.2f}")
                print(f"  Transactions: {len(food_expenses)}")
            print()

        print("=" * 80)
        print("All tests completed successfully! ✓")
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
    test_category_query()
