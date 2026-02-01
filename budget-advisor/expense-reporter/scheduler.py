#!/usr/bin/env python3
"""
Scheduler for Budget Advisor Weekly Reporter.
Runs weekly expense reports on a schedule (e.g., every Monday morning).
"""

import os
import sys
import logging
from datetime import datetime
import schedule
import time

from weekly_reporter import WeeklyReporter

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
    """Scheduler for weekly expense reports"""

    def __init__(self, to_email: str, schedule_day: str = "monday", schedule_time: str = "09:00"):
        """
        Initialize report scheduler.

        Args:
            to_email: Email address to send reports to
            schedule_day: Day of week to send report (default: monday)
            schedule_time: Time to send report in HH:MM format (default: 09:00)
        """
        self.to_email = to_email
        self.schedule_day = schedule_day.lower()
        self.schedule_time = schedule_time
        self.reporter = WeeklyReporter(to_email)

    def run_report_job(self):
        """Job function that runs the weekly report"""
        logger.info(f"⏰ Scheduled report triggered at {datetime.now()}")

        try:
            # Run the reporter (now synchronous)
            success = self.reporter.send_weekly_report()
            if success:
                logger.info("✅ Scheduled report completed successfully")
            else:
                logger.error("❌ Scheduled report failed")
        except Exception as e:
            logger.error(f"❌ Scheduled report failed: {e}", exc_info=True)

    def start(self):
        """Start the scheduler"""
        logger.info("Starting Budget Advisor Weekly Reporter Scheduler")
        logger.info(f"Report will be sent to: {self.to_email}")
        logger.info(f"Schedule: Every {self.schedule_day.capitalize()} at {self.schedule_time}")

        # Schedule the job
        schedule_func = getattr(schedule.every(), self.schedule_day)
        schedule_func.at(self.schedule_time).do(self.run_report_job)

        logger.info("✓ Scheduler started. Press Ctrl+C to stop.")

        # Run scheduler loop
        try:
            while True:
                schedule.run_pending()
                time.sleep(60)  # Check every minute
        except KeyboardInterrupt:
            logger.info("Scheduler stopped by user")


def main():
    """Main entry point"""
    # Get configuration from environment
    to_email = os.getenv("REPORT_TO_EMAIL")
    schedule_day = os.getenv("REPORT_SCHEDULE_DAY", "monday")
    schedule_time = os.getenv("REPORT_SCHEDULE_TIME", "09:00")

    if not to_email:
        logger.error("Error: REPORT_TO_EMAIL environment variable not set")
        sys.exit(1)

    # Validate schedule day
    valid_days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    if schedule_day.lower() not in valid_days:
        logger.error(f"Error: Invalid REPORT_SCHEDULE_DAY. Must be one of: {', '.join(valid_days)}")
        sys.exit(1)

    # Validate schedule time format
    try:
        datetime.strptime(schedule_time, "%H:%M")
    except ValueError:
        logger.error(f"Error: Invalid REPORT_SCHEDULE_TIME format. Must be HH:MM (e.g., 09:00)")
        sys.exit(1)

    # Start scheduler
    scheduler = ReportScheduler(to_email, schedule_day, schedule_time)
    scheduler.start()


if __name__ == "__main__":
    main()
