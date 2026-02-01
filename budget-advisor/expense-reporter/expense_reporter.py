#!/usr/bin/env python3
"""
Expense Reporter for Budget Advisor.
Calls the advisor agent to get weekly/monthly analysis and sends email reports.
"""

import os
import sys
import subprocess
import logging
import re
from datetime import datetime, timedelta
from pathlib import Path
from calendar import month_name

from email_sender import create_email_sender_from_env

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


class ExpenseReporter:
    """Generates and sends weekly/monthly expense reports"""

    def __init__(self, to_email: str, advisor_path: str = None):
        """
        Initialize expense reporter.

        Args:
            to_email: Email address to send reports to
            advisor_path: Path to advisor.py (default: auto-detect)
        """
        self.to_email = to_email
        self.email_sender = create_email_sender_from_env()

        # Auto-detect advisor.py path if not provided
        if advisor_path is None:
            self.advisor_path = str(Path(__file__).parent.parent / "advisor-agent" / "advisor.py")
        else:
            self.advisor_path = advisor_path

        # Get Python executable
        self.python_cmd = os.getenv("PYTHON_CMD", sys.executable)

        logger.info(f"Using advisor at: {self.advisor_path}")

    def get_weekly_analysis(self) -> tuple[str, str]:
        """
        Get weekly expense analysis by calling advisor-agent.

        Returns:
            Tuple of (week_info, analysis_text)
        """
        logger.info("Requesting weekly analysis from advisor agent...")

        # Get current week info
        today = datetime.now()
        week_start = today - timedelta(days=today.weekday())
        week_end = week_start + timedelta(days=6)
        week_info = f"Week of {week_start.strftime('%B %d')} - {week_end.strftime('%B %d, %Y')}"

        # Prompt for the advisor agent
        # Be explicit about fetching BOTH current and previous week data
        prompt = """Please provide a weekly expense report comparing THIS WEEK versus LAST WEEK.

Fetch data for:
- Current week (this week's expenses)
- Previous week (last week's expenses for comparison)

Include in your report:
1. Total spending for this week
2. Breakdown by category with amounts and transaction counts (as a table)
3. Comparison with previous week showing:
   - Total spending change (amount and percentage)
   - Category-by-category comparison
   - Which categories increased or decreased
4. Any unusual or noteworthy spending patterns
5. Specific recommendations and advice for managing expenses next week

Please format the spending breakdown as a markdown table for easy reading."""

        try:
            # Call advisor.py with the prompt
            # The advisor manages its own MCP/Ollama/DB connections
            result = subprocess.run(
                [self.python_cmd, self.advisor_path, "--prompt", prompt],
                capture_output=True,
                text=True,
                timeout=120  # 2 minute timeout
            )

            if result.returncode != 0:
                error_msg = result.stderr or "Unknown error"
                raise RuntimeError(f"Advisor agent failed: {error_msg}")

            analysis = result.stdout.strip()

            if not analysis:
                raise RuntimeError("Advisor agent returned empty response")

            logger.info("✓ Weekly analysis received from advisor agent")
            return week_info, analysis

        except subprocess.TimeoutExpired:
            logger.error("Advisor agent timed out after 2 minutes")
            raise RuntimeError("Advisor agent timed out")
        except Exception as e:
            logger.error(f"Failed to get analysis from advisor: {e}")
            raise

    def get_monthly_review(self, target_year: int = None, target_month: int = None) -> tuple[str, str, dict]:
        """
        Get monthly expense review by calling advisor-agent with monthly-review mode.

        Args:
            target_year: Year to review (default: previous month)
            target_month: Month to review (default: previous month)

        Returns:
            Tuple of (month_info, review_text, category_data)
        """
        logger.info("Requesting monthly review from advisor agent...")

        # Default to previous month
        if target_year is None or target_month is None:
            today = datetime.now()
            if today.month == 1:
                target_year = today.year - 1
                target_month = 12
            else:
                target_year = today.year
                target_month = today.month - 1

        month_info = f"{month_name[target_month]} {target_year}"

        try:
            # Call advisor.py with monthly-review mode
            result = subprocess.run(
                [self.python_cmd, self.advisor_path, "--mode", "monthly-review",
                 "--year", str(target_year), "--month", str(target_month)],
                capture_output=True,
                text=True,
                timeout=180  # 3 minute timeout for monthly review
            )

            if result.returncode != 0:
                error_msg = result.stderr or "Unknown error"
                raise RuntimeError(f"Advisor agent failed: {error_msg}")

            review = result.stdout.strip()

            if not review:
                raise RuntimeError("Advisor agent returned empty response")

            logger.info("✓ Monthly review received from advisor agent")

            # Parse the review to extract category data for pie chart
            category_data = self._parse_category_data(review)

            return month_info, review, category_data

        except subprocess.TimeoutExpired:
            logger.error("Advisor agent timed out after 3 minutes")
            raise RuntimeError("Advisor agent timed out")
        except Exception as e:
            logger.error(f"Failed to get monthly review from advisor: {e}")
            raise

    def _parse_category_data(self, review: str) -> dict:
        """
        Parse the review text to extract category spending data for pie chart.

        Args:
            review: The full review text from advisor

        Returns:
            Dict mapping category name to amount
        """
        category_data = {}

        # Look for the table in the review
        # Format: Category                             2026 Jan    2025 Dec    ...
        lines = review.split('\n')
        in_table = False

        for line in lines:
            # Start of data rows (after header and separator)
            if '----' in line and not in_table:
                in_table = True
                continue

            # End of table
            if in_table and ('====' in line or 'TOTAL' in line):
                break

            # Parse data rows
            if in_table and line.strip():
                # Extract category and current month amount
                # Format: "Category Name                    $1,234.56    ..."
                parts = line.split()
                if len(parts) >= 2:
                    # Find the category name (everything before the first $)
                    dollar_idx = line.find('$')
                    if dollar_idx > 0:
                        category = line[:dollar_idx].strip()
                        # Get the first dollar amount (current month)
                        amount_match = re.search(r'\$([0-9,]+\.\d{2})', line)
                        if amount_match:
                            amount_str = amount_match.group(1).replace(',', '')
                            try:
                                amount = float(amount_str)
                                if amount > 0:  # Only include positive amounts
                                    category_data[category] = amount
                            except ValueError:
                                pass

        logger.debug(f"Parsed category data: {category_data}")
        return category_data

    def send_weekly_report(self) -> bool:
        """
        Generate and send weekly expense report.

        Returns:
            True if report sent successfully, False otherwise
        """
        try:
            # Get analysis from advisor agent
            week_info, analysis = self.get_weekly_analysis()

            # Create subject line
            subject = f"📊 Budget Advisor - Weekly Report ({datetime.now().strftime('%b %d, %Y')})"

            # Send email
            success = self.email_sender.send_report(
                to_email=self.to_email,
                subject=subject,
                analysis=analysis,
                week_info=week_info
            )

            if success:
                logger.info(f"✅ Weekly report sent to {self.to_email}")
            else:
                logger.error(f"❌ Failed to send report to {self.to_email}")

            return success

        except Exception as e:
            logger.error(f"Error sending weekly report: {e}")
            return False

    def send_monthly_report(self, target_year: int = None, target_month: int = None) -> bool:
        """
        Generate and send monthly expense review report.

        Args:
            target_year: Year to review (default: previous month)
            target_month: Month to review (default: previous month)

        Returns:
            True if report sent successfully, False otherwise
        """
        try:
            # Get review from advisor agent
            month_info, review, category_data = self.get_monthly_review(target_year, target_month)

            # Create subject line
            subject = f"📊 Budget Advisor - Monthly Review: {month_info}"

            # Send email with monthly template
            success = self.email_sender.send_monthly_report(
                to_email=self.to_email,
                subject=subject,
                review=review,
                month_info=month_info,
                category_data=category_data
            )

            if success:
                logger.info(f"✅ Monthly report sent to {self.to_email}")
            else:
                logger.error(f"❌ Failed to send monthly report to {self.to_email}")

            return success

        except Exception as e:
            logger.error(f"Error sending monthly report: {e}")
            return False


def main():
    """Main entry point for manual execution"""
    import argparse

    parser = argparse.ArgumentParser(description='Budget Advisor Expense Reporter')
    parser.add_argument(
        '--mode',
        choices=['weekly', 'monthly'],
        default='weekly',
        help='Report mode: weekly or monthly (default: weekly)'
    )
    parser.add_argument(
        '--year',
        type=int,
        help='Year for monthly review (default: previous month)'
    )
    parser.add_argument(
        '--month',
        type=int,
        choices=range(1, 13),
        metavar='1-12',
        help='Month for monthly review (1-12, default: previous month)'
    )

    args = parser.parse_args()

    # Get recipient email from environment
    to_email = os.getenv("REPORT_TO_EMAIL")
    if not to_email:
        logger.error("Error: REPORT_TO_EMAIL environment variable not set")
        sys.exit(1)

    reporter = ExpenseReporter(to_email)

    if args.mode == 'monthly':
        logger.info(f"Starting monthly reporter for {to_email}...")
        success = reporter.send_monthly_report(args.year, args.month)
        report_type = "Monthly"
    else:
        logger.info(f"Starting weekly reporter for {to_email}...")
        success = reporter.send_weekly_report()
        report_type = "Weekly"

    if success:
        logger.info(f"✅ {report_type} reporter completed successfully")
        sys.exit(0)
    else:
        logger.error(f"❌ {report_type} reporter failed")
        sys.exit(1)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)
