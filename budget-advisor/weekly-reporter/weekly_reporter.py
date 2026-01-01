#!/usr/bin/env python3
"""
Weekly Reporter for Budget Advisor.
Generates weekly expense analysis using the advisor agent and sends email reports.
"""

import os
import sys
import asyncio
import logging
from datetime import datetime, timedelta
from pathlib import Path

# Add parent directory to path to import advisor agent
sys.path.insert(0, str(Path(__file__).parent.parent / "advisor-agent"))

from advisor import BudgetAdvisor
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

    def __init__(self, to_email: str):
        """
        Initialize weekly reporter.

        Args:
            to_email: Email address to send reports to
        """
        self.to_email = to_email
        self.advisor = None
        self.email_sender = None

    async def initialize(self):
        """Initialize advisor agent and email sender"""
        logger.info("Initializing weekly reporter...")

        # Initialize advisor agent
        self.advisor = BudgetAdvisor()
        await self.advisor.connect()
        logger.info("✓ Connected to advisor agent")

        # Initialize email sender
        self.email_sender = create_email_sender_from_env()
        logger.info("✓ Email sender configured")

    async def cleanup(self):
        """Cleanup resources"""
        if self.advisor:
            await self.advisor.disconnect()
            logger.info("✓ Disconnected from advisor agent")

    async def generate_weekly_analysis(self) -> tuple[str, str]:
        """
        Generate weekly expense analysis using advisor agent.

        Returns:
            Tuple of (week_info, analysis_text)
        """
        logger.info("Generating weekly analysis...")

        # Get current week info
        today = datetime.now()
        week_start = today - timedelta(days=today.weekday())
        week_end = week_start + timedelta(days=6)
        week_info = f"Week of {week_start.strftime('%B %d')} - {week_end.strftime('%B %d, %Y')}"

        # Use advisor to get weekly analysis
        try:
            # Get weekly expenses summary
            weekly_summary = await self.advisor.get_weekly_advice()

            # Ask for detailed analysis and advice
            analysis_prompt = (
                "Based on this week's expenses, provide a detailed analysis including:\n"
                "1. Total spending this week\n"
                "2. Top spending categories\n"
                "3. Comparison with previous weeks if possible\n"
                "4. Any unusual spending patterns\n"
                "5. Recommendations for next week"
            )
            detailed_analysis = await self.advisor.answer_question(analysis_prompt)

            analysis = f"{weekly_summary}\n\n{detailed_analysis}"

            logger.info("✓ Weekly analysis generated")
            return week_info, analysis

        except Exception as e:
            logger.error(f"Failed to generate analysis: {e}")
            raise

    async def send_weekly_report(self) -> bool:
        """
        Generate and send weekly expense report.

        Returns:
            True if report sent successfully, False otherwise
        """
        try:
            # Generate analysis
            week_info, analysis = await self.generate_weekly_analysis()

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

    async def run_once(self):
        """Run the reporter once (for manual execution or testing)"""
        try:
            await self.initialize()
            await self.send_weekly_report()
        finally:
            await self.cleanup()


async def main():
    """Main entry point for manual execution"""
    # Get recipient email from environment
    to_email = os.getenv("REPORT_TO_EMAIL")
    if not to_email:
        logger.error("Error: REPORT_TO_EMAIL environment variable not set")
        sys.exit(1)

    logger.info(f"Starting weekly reporter for {to_email}...")

    reporter = WeeklyReporter(to_email)
    await reporter.run_once()

    logger.info("Weekly reporter completed")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)
