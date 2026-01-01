#!/usr/bin/env python3
"""
Weekly Reporter for Budget Advisor.
Calls the advisor agent to get weekly analysis and sends email reports.
"""

import os
import sys
import subprocess
import logging
from datetime import datetime, timedelta
from pathlib import Path

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


class WeeklyReporter:
    """Generates and sends weekly expense reports"""

    def __init__(self, to_email: str, advisor_path: str = None):
        """
        Initialize weekly reporter.

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
        prompt = """Please provide a weekly expense report with the following:

1. Total spending for this week
2. Breakdown by category with amounts and transaction counts
3. Comparison with previous week if data is available
4. Any unusual or noteworthy spending patterns
5. Recommendations and advice for managing expenses next week

Please be concise but informative."""

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


def main():
    """Main entry point for manual execution"""
    # Get recipient email from environment
    to_email = os.getenv("REPORT_TO_EMAIL")
    if not to_email:
        logger.error("Error: REPORT_TO_EMAIL environment variable not set")
        sys.exit(1)

    logger.info(f"Starting weekly reporter for {to_email}...")

    reporter = WeeklyReporter(to_email)
    success = reporter.send_weekly_report()

    if success:
        logger.info("✅ Weekly reporter completed successfully")
        sys.exit(0)
    else:
        logger.error("❌ Weekly reporter failed")
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
