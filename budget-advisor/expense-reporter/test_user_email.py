#!/usr/bin/env python3
"""
Test with the actual email content the user received
"""

from email_sender import EmailSender

# Actual content from user's email
test_text = """Weekly Expense Report - Current Week

1. Total Spending: $3285.21

2. Spending Breakdown:

Housing: $1257.03 (1 transaction) - Largest expense category*


Monthly Recurring: $1149.13 (3 transactions)
Clothing: $342.23 (5 transactions) - Significant spending in this category*

Entertainment: $177.06 (1 transaction)
Food: $110.91 (1 transaction)
Restaurant: $72.95 (1 transaction)
Life Consumption: $62.96 (3 transactions)
Medical Care: $58.00 (1 transaction)
Self-Care: $54.94 (1 transaction)

3. Comparison with Previous Week:

Unfortunately, data from the previous week is not available. A comparison cannot be made. Tracking expenses consistently week-over-week is highly recommended for identifying trends.

4. Noteworthy Spending Patterns:


High Housing Costs: $1257.03 represents almost 38% of total spending.
Clothing Spend: $342.23 across 5 transactions indicates frequent smaller purchases in this category.
Recurring Expenses: $1149.13 is a substantial portion of your weekly budget, and understanding what this includes is crucial.

5. Recommendations for Next Week:


Track ALL Spending: Ensure every expense, no matter how small, is recorded.
Review Recurring Expenses: Identify opportunities to reduce or renegotiate recurring bills.
Clothing Budget: Consider setting a weekly clothing budget to curb impulse purchases. The 5 transactions suggest potential overspending in this area.
Previous Week Data: Start tracking next week's expenses diligently, so a comparison can be made in future reports.
"""

# Create sender instance (doesn't need valid credentials for testing)
sender = EmailSender(
    smtp_host="smtp.gmail.com",
    smtp_port=587,
    smtp_user="test@example.com",
    smtp_password="test",
    from_email="test@example.com"
)

# Test conversion
html = sender._markdown_to_html(test_text)

print("=== ISSUES TO FIX ===")
print("1. Trailing asterisks should be removed")
print("2. Empty lines between numbered items and bullets should be removed")
print()

print("=== CONVERTED HTML ===")
print(html)
print()

# Check for issues
if '*' in html and '<em>' not in html:
    print("❌ FAILED: Orphaned asterisks still present")
else:
    print("✅ PASSED: No orphaned asterisks")

# Check for excessive breaks before lists
if '<br><ul>' in html or '<br> <ul>' in html:
    print("❌ FAILED: Extra breaks before lists")
else:
    print("✅ PASSED: No extra breaks before lists")

# Save full email for inspection
full_html = sender._create_html_body(test_text, "Week of Jan 01 - Jan 07, 2026")

with open('/tmp/test_user_email.html', 'w') as f:
    f.write(full_html)

print("\n✅ Saved to /tmp/test_user_email.html - open in browser to inspect")
