#!/usr/bin/env python3
"""
Test script for email sending functionality.
Sends a test email to verify SMTP configuration.
"""

import os
import sys
import logging

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from email_sender import create_email_sender_from_env

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)


def main():
    """Test email sending"""
    # Get recipient from environment
    to_email = os.getenv("REPORT_TO_EMAIL")
    if not to_email:
        logger.error("Error: REPORT_TO_EMAIL not set in .env file")
        sys.exit(1)

    logger.info(f"Testing email configuration...")
    logger.info(f"Sending test email to: {to_email}")

    try:
        # Create email sender
        sender = create_email_sender_from_env()

        # Send test email
        test_analysis = """
This is a test email from Budget Advisor Weekly Reporter.

If you're seeing this email, your SMTP configuration is working correctly!

Test Details:
- SMTP Host: {smtp_host}
- SMTP Port: {smtp_port}
- From Email: {from_email}
- TLS Enabled: {use_tls}

Next steps:
1. Run the weekly reporter: python3.11 weekly_reporter.py
2. Start the scheduler: python3.11 scheduler.py
        """.format(
            smtp_host=sender.smtp_host,
            smtp_port=sender.smtp_port,
            from_email=sender.from_email,
            use_tls=sender.use_tls
        )

        success = sender.send_report(
            to_email=to_email,
            subject="✅ Budget Advisor - Email Configuration Test",
            analysis=test_analysis,
            week_info="Email Configuration Test"
        )

        if success:
            logger.info("✅ Test email sent successfully!")
            logger.info(f"Check your inbox at {to_email}")
            return 0
        else:
            logger.error("❌ Failed to send test email")
            logger.error("Check your SMTP configuration in .env file")
            return 1

    except ValueError as e:
        logger.error(f"Configuration error: {e}")
        logger.error("Make sure all required variables are set in .env file")
        return 1
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return 1


if __name__ == "__main__":
    sys.exit(main())
