#!/usr/bin/env python3
"""
Simple test for the new database functions.
Tests get_monthly_grouped_expenses and get_monthly_detailed_expenses directly.
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
    get_monthly_grouped_expenses,
    get_monthly_detailed_expenses,
)


def test_monthly_functions():
    """Test the new monthly database functions"""

    # Get current year and month
    current_year = datetime.now().year
    current_month = datetime.now().month

    print("=" * 80)
    print(f"Testing Monthly Expense Database Functions - {current_year}-{current_month:02d}")
    print("=" * 80)
    print()

    try:
        # Initialize database connection
        print("Initializing database connection...")
        init_database()
        print("✓ Database connected\n")

        # Test 1: Get monthly grouped expenses
        print("-" * 80)
        print(f"TEST 1: get_monthly_grouped_expenses({current_year}, {current_month})")
        print("-" * 80)

        data1 = get_monthly_grouped_expenses(current_year, current_month)
        print(f"\n✓ Retrieved {len(data1)} expense categories")
        print()

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

        # Test 2: Get monthly detailed expenses
        print("-" * 80)
        print(f"TEST 2: get_monthly_detailed_expenses({current_year}, {current_month})")
        print("-" * 80)

        data2 = get_monthly_detailed_expenses(current_year, current_month)
        print(f"\n✓ Retrieved {len(data2)} detailed transactions")
        print()

        if data2:
            print("First 10 transactions:")
            print(f"{'Date':<12} {'Category':<20} {'Merchant':<25} {'Amount':>12}")
            print("-" * 70)

            for item in data2[:10]:
                date = str(item.get('date', 'N/A'))[:10]
                category = str(item.get('typeName', 'Unknown'))[:19]
                merchant = str(item.get('merchantName', 'N/A'))[:24]
                amount = float(item.get('expense_numeric', 0))
                print(f"{date:<12} {category:<20} {merchant:<25} ${amount:>11,.2f}")

            if len(data2) > 10:
                print(f"... and {len(data2) - 10} more transactions")
        else:
            print("No detailed transactions found for this period.")
        print()

        # Test 3: Previous month
        prev_month = current_month - 1 if current_month > 1 else 12
        prev_year = current_year if current_month > 1 else current_year - 1

        print("-" * 80)
        print(f"TEST 3: get_monthly_grouped_expenses({prev_year}, {prev_month})")
        print("-" * 80)

        data3 = get_monthly_grouped_expenses(prev_year, prev_month)
        print(f"\n✓ Retrieved {len(data3)} expense categories for previous month")

        if data3:
            total_prev = sum(float(item.get('total_expense', 0)) for item in data3)
            print(f"  Total spending: ${total_prev:,.2f}")
        else:
            print("  No expenses found for previous month.")
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
    test_monthly_functions()
