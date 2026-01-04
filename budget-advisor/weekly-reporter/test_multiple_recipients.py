#!/usr/bin/env python3
"""
Test sending email to multiple recipients.
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


def test_parse_emails():
    """Test email address parsing"""
    sender = create_email_sender_from_env()

    print("=== Testing Email Address Parsing ===\n")

    test_cases = [
        "user@example.com",
        "user1@example.com, user2@example.com",
        "user1@example.com; user2@example.com",
        "user1@example.com, user2@example.com, user3@example.com",
        "  user1@example.com  ,  user2@example.com  ",  # With extra spaces
        "user1@example.com; user2@example.com, user3@example.com",  # Mixed separators
    ]

    for test_input in test_cases:
        result = sender._parse_email_addresses(test_input)
        print(f"Input:  {repr(test_input)}")
        print(f"Output: {result}")
        print(f"Count:  {len(result)} recipient(s)\n")


def test_send_to_multiple():
    """Test sending to multiple recipients"""
    # Get recipients from environment (can be comma or semicolon separated)
    to_emails = os.getenv("REPORT_TO_EMAIL")

    if not to_emails:
        logger.error("Error: REPORT_TO_EMAIL not set in .env file")
        sys.exit(1)

    print("\n=== Testing Email Send to Multiple Recipients ===\n")

    try:
        sender = create_email_sender_from_env()

        # Parse to show how many recipients
        recipients = sender._parse_email_addresses(to_emails)
        print(f"Will send to {len(recipients)} recipient(s):")
        for i, email in enumerate(recipients, 1):
            print(f"  {i}. {email}")
        print()

        # Send test email
        test_analysis = """
This is a test email to verify multiple recipient delivery.

**Test Information:**
- All recipients should receive this email
- Each recipient will see all other recipients in the To field
- This is a single email sent to multiple addresses

If you received this, the multiple recipient feature is working correctly!
        """

        success = sender.send_report(
            to_email=to_emails,
            subject="✅ Budget Advisor - Multiple Recipients Test",
            analysis=test_analysis,
            week_info="Multiple Recipients Test"
        )

        if success:
            logger.info("✅ Test email sent successfully to all recipients!")
            logger.info(f"Check inboxes for: {', '.join(recipients)}")
            return 0
        else:
            logger.error("❌ Failed to send test email")
            return 1

    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return 1


def main():
    """Main entry point"""
    print("Budget Advisor - Multiple Recipients Test\n")

    # First test parsing
    test_parse_emails()

    # Then test actual sending
    result = test_send_to_multiple()
    sys.exit(result)


if __name__ == "__main__":
    main()
