#!/usr/bin/env python3
"""
Scheduler for Budget Advisor Expense Reporter.
Runs weekly and monthly expense reports on a schedule.
"""

import os
import sys
import logging
from datetime import datetime
import schedule
import time

from expense_reporter import ExpenseReporter

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("Warning: python-dotenv not installed")

# Configure logging
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger(__name__)


class ReportScheduler:
    """Scheduler for weekly and monthly expense reports"""

    def __init__(
        self,
        to_email: str,
        weekly_enabled: bool = True,
        weekly_day: str = "monday",
        weekly_time: str = "09:00",
        monthly_enabled: bool = True,
        monthly_time: str = "09:00"
    ):
        """
        Initialize report scheduler.

        Args:
            to_email: Email address to send reports to
            weekly_enabled: Whether to enable weekly reports (default: True)
            weekly_day: Day of week to send weekly report (default: monday)
            weekly_time: Time to send weekly report in HH:MM format (default: 09:00)
            monthly_enabled: Whether to enable monthly reports (default: True)
            monthly_time: Time to send monthly report in HH:MM format (default: 09:00)
        """
        self.to_email = to_email
        self.weekly_enabled = weekly_enabled
        self.weekly_day = weekly_day.lower()
        self.weekly_time = weekly_time
        self.monthly_enabled = monthly_enabled
        self.monthly_time = monthly_time
        self.reporter = ExpenseReporter(to_email)

    def run_weekly_report_job(self):
        """Job function that runs the weekly report"""
        logger.info(f"⏰ Scheduled weekly report triggered at {datetime.now()}")

        try:
            success = self.reporter.send_weekly_report()
            if success:
                logger.info("✅ Weekly report completed successfully")
            else:
                logger.error("❌ Weekly report failed")
        except Exception as e:
            logger.error(f"❌ Weekly report failed: {e}", exc_info=True)

    def run_monthly_report_job(self):
        """Job function that checks if it's the 1st of month and runs the monthly report"""
        today = datetime.now()

        # Only run on the 1st day of the month
        if today.day != 1:
            return

        logger.info(f"⏰ Scheduled monthly report triggered at {datetime.now()}")

        try:
            # Send report for previous month (default behavior)
            success = self.reporter.send_monthly_report()
            if success:
                logger.info("✅ Monthly report completed successfully")
            else:
                logger.error("❌ Monthly report failed")
        except Exception as e:
            logger.error(f"❌ Monthly report failed: {e}", exc_info=True)

    def start(self):
        """Start the scheduler"""
        logger.info("=" * 70)
        logger.info("Starting Budget Advisor Expense Reporter Scheduler")
        logger.info("=" * 70)
        logger.info(f"Report recipient: {self.to_email}")
        logger.info("")

        jobs_scheduled = 0

        # Schedule weekly job
        if self.weekly_enabled:
            schedule_func = getattr(schedule.every(), self.weekly_day)
            schedule_func.at(self.weekly_time).do(self.run_weekly_report_job)
            logger.info(f"📅 Weekly Report: Every {self.weekly_day.capitalize()} at {self.weekly_time}")
            jobs_scheduled += 1
        else:
            logger.info("📅 Weekly Report: Disabled")

        # Schedule monthly job (runs daily but only executes on the 1st of each month)
        if self.monthly_enabled:
            # Schedule to check daily at specified time, will only run on 1st of month
            schedule.every().day.at(self.monthly_time).do(self.run_monthly_report_job)
            logger.info(f"📅 Monthly Report: 1st of each month at {self.monthly_time}")
            jobs_scheduled += 1
        else:
            logger.info("📅 Monthly Report: Disabled")

        logger.info("")

        if jobs_scheduled == 0:
            logger.error("❌ No jobs scheduled. Enable at least one report type.")
            sys.exit(1)

        logger.info("✓ Scheduler started. Press Ctrl+C to stop.")
        logger.info("=" * 70)

        # Run scheduler loop
        try:
            while True:
                schedule.run_pending()
                time.sleep(60)  # Check every minute
        except KeyboardInterrupt:
            logger.info("")
            logger.info("Scheduler stopped by user")


def main():
    """Main entry point"""
    # Get configuration from environment
    to_email = os.getenv("REPORT_TO_EMAIL")

    # Weekly report configuration
    weekly_enabled = os.getenv("WEEKLY_REPORT_ENABLED", "true").lower() == "true"
    weekly_day = os.getenv("WEEKLY_REPORT_DAY", "monday")
    weekly_time = os.getenv("WEEKLY_REPORT_TIME", "09:00")

    # Monthly report configuration
    monthly_enabled = os.getenv("MONTHLY_REPORT_ENABLED", "true").lower() == "true"
    monthly_time = os.getenv("MONTHLY_REPORT_TIME", "09:00")

    if not to_email:
        logger.error("Error: REPORT_TO_EMAIL environment variable not set")
        sys.exit(1)

    # Validate weekly schedule day
    if weekly_enabled:
        valid_days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        if weekly_day.lower() not in valid_days:
            logger.error(f"Error: Invalid WEEKLY_REPORT_DAY. Must be one of: {', '.join(valid_days)}")
            sys.exit(1)

        # Validate weekly schedule time format
        try:
            datetime.strptime(weekly_time, "%H:%M")
        except ValueError:
            logger.error(f"Error: Invalid WEEKLY_REPORT_TIME format. Must be HH:MM (e.g., 09:00)")
            sys.exit(1)

    # Validate monthly schedule time format
    if monthly_enabled:
        try:
            datetime.strptime(monthly_time, "%H:%M")
        except ValueError:
            logger.error(f"Error: Invalid MONTHLY_REPORT_TIME format. Must be HH:MM (e.g., 09:00)")
            sys.exit(1)

    # Start scheduler
    scheduler = ReportScheduler(
        to_email=to_email,
        weekly_enabled=weekly_enabled,
        weekly_day=weekly_day,
        weekly_time=weekly_time,
        monthly_enabled=monthly_enabled,
        monthly_time=monthly_time
    )
    scheduler.start()


if __name__ == "__main__":
    main()
