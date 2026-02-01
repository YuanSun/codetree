#!/usr/bin/env python3
"""
Test script for monthly email functionality.
Tests the complete flow: advisor -> reporter -> email with chart.
"""

import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from expense_reporter import ExpenseReporter

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


def test_monthly_email():
    """Test the monthly email report functionality"""

    print("=" * 100)
    print("Testing Monthly Email Report")
    print("=" * 100)
    print()

    # Get recipient email from environment
    to_email = os.getenv("REPORT_TO_EMAIL")
    if not to_email:
        print("❌ Error: REPORT_TO_EMAIL environment variable not set")
        print("Please set REPORT_TO_EMAIL in your .env file")
        sys.exit(1)

    print(f"Sending test monthly report to: {to_email}")
    print()

    try:
        reporter = ExpenseReporter(to_email)

        # Test: Send monthly report for January 2026 (comparing with December 2025)
        print("-" * 100)
        print("TEST: Generate and send monthly report for January 2026")
        print("-" * 100)
        print()

        print("This will:")
        print("1. Call advisor-agent to generate monthly review")
        print("2. Parse the review to extract category data")
        print("3. Generate a pie chart from the data")
        print("4. Format the email with table and chart")
        print("5. Send the email via SMTP")
        print()

        success = reporter.send_monthly_report(2026, 1)

        if success:
            print()
            print("-" * 100)
            print("✅ TEST PASSED - Monthly email sent successfully!")
            print("-" * 100)
            print()
            print("Please check your email inbox to verify:")
            print("  1. Email subject: '📊 Budget Advisor - Monthly Review: January 2026'")
            print("  2. Email contains the comparison table properly formatted")
            print("  3. Email includes a pie chart showing category breakdown")
            print("  4. All data displays correctly in your email client")
            print()
        else:
            print()
            print("-" * 100)
            print("❌ TEST FAILED - Email not sent")
            print("-" * 100)
            sys.exit(1)

    except Exception as e:
        print()
        print(f"❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    print()
    print("This test will send an actual email to the configured address.")
    print("Make sure your SMTP settings and REPORT_TO_EMAIL are configured in .env")
    print()

    response = input("Continue with test? [y/N]: ")
    if response.lower() != 'y':
        print("Test cancelled")
        sys.exit(0)

    print()

    try:
        test_monthly_email()
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        sys.exit(1)
