#!/usr/bin/env python3
"""Test table conversion from markdown to HTML"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from email_sender import EmailSender

# Sample analysis with markdown table (from user's email)
sample_analysis = """Weekly Expense Report - Current Week

1. Total Spending: $5356.63

2. Spending Breakdown:

| Category | Amount ($) | Transactions |
|-----------------------|------------|--------------|
| Housing (Rent/Mortgage) | 1257.03 | 1 |
| Book & Education | 1155.00 | 1 |
| Recurring Expenses | 1149.13 | 3 |
| Clothing | 659.41 | 7 |
| Food | 368.70 | 3 |
| Entertainment | 345.92 | 3 |
| Life Consumption | 208.21 | 8 |
| Restaurant | 72.95 | 1 |
| Medical Care | 58.00 | 1 |
| Self-Care | 54.94 | 1 |
| Transportation/Gas | 27.34 | 1 |

3. Comparison with Previous Week:

Unfortunately, data from the previous week is not available for comparison. This limits our ability to identify trends effectively.

4. Unusual/Noteworthy Spending Patterns:

- High Spending on Housing & Education: Housing ($1257.03) and Books/Education ($1155.00) represent a significant portion (over 43%) of your weekly spending.
- Numerous Small Transactions: "Life Consumption" has a relatively high transaction count (8) for a moderate amount ($208.21), suggesting frequent small purchases.
- Clothing Spend: $659.41 across 7 transactions is also a notable expense.

5. Recommendations for Next Week:

- Review Housing/Education Costs: Assess if there are any opportunities to reduce these large expenses (e.g., exploring more affordable educational resources, refinancing options).
- Track "Life Consumption": Monitor these smaller transactions closely. Identify what they are and determine if any are non-essential and can be reduced.
- Budget for Clothing: Consider setting a weekly or monthly clothing budget to avoid overspending.
- Gather Previous Week's Data: To gain a better understanding of your spending habits, please provide data from the previous week. This will allow for a more comprehensive analysis and personalized recommendations.
"""

# Create a dummy email sender instance just to test the conversion
sender = EmailSender(
    smtp_host="smtp.example.com",
    smtp_port=587,
    smtp_user="test@example.com",
    smtp_password="dummy",
    from_email="test@example.com"
)

# Test the markdown to HTML conversion
html_output = sender._markdown_to_html(sample_analysis)

print("=" * 80)
print("HTML OUTPUT:")
print("=" * 80)
print(html_output)
print("\n" + "=" * 80)
print("VERIFICATION:")
print("=" * 80)

# Check for key elements
checks = {
    "Contains <table>": "<table>" in html_output,
    "Contains <thead>": "<thead>" in html_output,
    "Contains <tbody>": "<tbody>" in html_output,
    "Contains <th>": "<th>" in html_output,
    "Contains <td>": "<td>" in html_output,
    "Contains <ol> (numbered list)": "<ol>" in html_output,
    "Contains <ul> (bullet list)": "<ul>" in html_output,
    "No markdown pipes (|)": "|" not in html_output or html_output.count("|") < 5,
    "No markdown table separators": "---" not in html_output,
}

for check, passed in checks.items():
    status = "✓" if passed else "✗"
    print(f"{status} {check}")

# Save to HTML file for visual inspection
html_file = "/tmp/email_test.html"
with open(html_file, "w") as f:
    full_html = sender._create_html_body(sample_analysis, "Week of January 1-7, 2026")
    f.write(full_html)

print(f"\n✓ Full HTML email saved to: {html_file}")
print("  You can open this file in a web browser to see how the email looks!")
