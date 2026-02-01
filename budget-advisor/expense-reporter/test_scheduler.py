#!/usr/bin/env python3
"""
Test script for scheduler configuration.
Validates environment variables and shows the configured schedule.
"""

import os
import sys
from datetime import datetime

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


def test_scheduler_config():
    """Test and display scheduler configuration"""

    print("=" * 80)
    print("Budget Advisor - Scheduler Configuration Test")
    print("=" * 80)
    print()

    # Required configuration
    to_email = os.getenv("REPORT_TO_EMAIL")

    # Weekly configuration
    weekly_enabled = os.getenv("WEEKLY_REPORT_ENABLED", "true").lower() == "true"
    weekly_day = os.getenv("WEEKLY_REPORT_DAY", "monday")
    weekly_time = os.getenv("WEEKLY_REPORT_TIME", "09:00")

    # Monthly configuration
    monthly_enabled = os.getenv("MONTHLY_REPORT_ENABLED", "true").lower() == "true"
    monthly_time = os.getenv("MONTHLY_REPORT_TIME", "09:00")

    # Check required configuration
    errors = []
    warnings = []

    if not to_email:
        errors.append("REPORT_TO_EMAIL environment variable not set")

    # Email configuration check
    smtp_host = os.getenv("SMTP_HOST")
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    from_email = os.getenv("FROM_EMAIL")

    if not all([smtp_host, smtp_user, smtp_password, from_email]):
        errors.append("Incomplete SMTP configuration (need: SMTP_HOST, SMTP_USER, SMTP_PASSWORD, FROM_EMAIL)")

    # Validate weekly configuration
    if weekly_enabled:
        valid_days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        if weekly_day.lower() not in valid_days:
            errors.append(f"Invalid WEEKLY_REPORT_DAY: '{weekly_day}'. Must be one of: {', '.join(valid_days)}")

        try:
            datetime.strptime(weekly_time, "%H:%M")
        except ValueError:
            errors.append(f"Invalid WEEKLY_REPORT_TIME: '{weekly_time}'. Must be HH:MM format (e.g., 09:00)")

    # Validate monthly configuration
    if monthly_enabled:
        try:
            datetime.strptime(monthly_time, "%H:%M")
        except ValueError:
            errors.append(f"Invalid MONTHLY_REPORT_TIME: '{monthly_time}'. Must be HH:MM format (e.g., 09:00)")

    # Check if at least one report type is enabled
    if not weekly_enabled and not monthly_enabled:
        errors.append("No report types enabled. Enable at least WEEKLY_REPORT_ENABLED or MONTHLY_REPORT_ENABLED")

    # Display configuration
    print("📧 Email Configuration:")
    print(f"   SMTP Host:     {smtp_host or '❌ NOT SET'}")
    print(f"   SMTP User:     {smtp_user or '❌ NOT SET'}")
    print(f"   From Email:    {from_email or '❌ NOT SET'}")
    print(f"   To Email:      {to_email or '❌ NOT SET'}")
    print()

    print("📅 Weekly Report Configuration:")
    print(f"   Enabled:       {'✓ Yes' if weekly_enabled else '✗ No'}")
    if weekly_enabled:
        print(f"   Day:           {weekly_day.capitalize()}")
        print(f"   Time:          {weekly_time}")
    print()

    print("📅 Monthly Report Configuration:")
    print(f"   Enabled:       {'✓ Yes' if monthly_enabled else '✗ No'}")
    if monthly_enabled:
        print(f"   Schedule:      1st of each month")
        print(f"   Time:          {monthly_time}")
    print()

    # Display errors and warnings
    if errors:
        print("❌ Configuration Errors:")
        for error in errors:
            print(f"   • {error}")
        print()
        return False

    if warnings:
        print("⚠️  Warnings:")
        for warning in warnings:
            print(f"   • {warning}")
        print()

    # Show schedule summary
    print("✅ Configuration Valid!")
    print()
    print("📋 Scheduled Jobs:")

    if weekly_enabled:
        print(f"   • Weekly Report:  Every {weekly_day.capitalize()} at {weekly_time}")

    if monthly_enabled:
        print(f"   • Monthly Report: 1st of each month at {monthly_time}")

    print()
    print("=" * 80)
    print("To start the scheduler, run: python3.11 scheduler.py")
    print("=" * 80)

    return True


if __name__ == "__main__":
    try:
        success = test_scheduler_config()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
