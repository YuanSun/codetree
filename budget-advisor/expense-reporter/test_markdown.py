#!/usr/bin/env python3
"""
Test markdown to HTML conversion
"""

from email_sender import EmailSender

# Test markdown text
test_text = """
# Weekly Expense Report

**Total Spending**: $1,234.56

## Breakdown by Category

- **Food**: $450.25 (12 transactions)
- **Transport**: $95.00 (5 transactions)
- **Entertainment**: $87.80 (8 transactions)

## Analysis

Your spending this week was **15% higher** than average. Here are some key points:

1. Food expenses increased significantly
2. Consider *meal planning* for next week
3. Transportation costs remained stable

### Recommendations

- Set a food budget of **$180** for next week
- Review recurring subscriptions
- Great job keeping transportation costs low!
"""

# Create sender instance (doesn't need valid credentials for this test)
sender = EmailSender(
    smtp_host="smtp.gmail.com",
    smtp_port=587,
    smtp_user="test@example.com",
    smtp_password="test",
    from_email="test@example.com"
)

# Test conversion
html = sender._markdown_to_html(test_text)

print("=== MARKDOWN INPUT ===")
print(test_text)
print("\n=== HTML OUTPUT ===")
print(html)

# Show in context
full_html = sender._create_html_body(test_text, "Week of Jan 01 - Jan 07, 2026")

print("\n=== FULL EMAIL HTML ===")
print(full_html)

# Save to file for browser testing
with open('/tmp/test_email.html', 'w') as f:
    f.write(full_html)

print("\n✅ Test complete! Open /tmp/test_email.html in a browser to see the result.")
