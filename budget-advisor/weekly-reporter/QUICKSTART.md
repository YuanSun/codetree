# Quick Start Guide - Weekly Reporter

Get your weekly expense reports up and running in 5 minutes!

## Prerequisites

✅ PostgreSQL database with budget data
✅ Ollama running with a model (e.g., llama3.2)
✅ MCP server and advisor-agent configured

## Step 1: Install Dependencies

```bash
cd budget-advisor/weekly-reporter
pip install -r requirements.txt
```

## Step 2: Configure Email

```bash
# Copy the example configuration
cp .env.example .env

# Edit with your favorite editor
nano .env  # or vim .env, or code .env
```

**Minimum required configuration:**

```bash
# For Gmail (recommended for testing)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password  # Generate at: https://myaccount.google.com/apppasswords
FROM_EMAIL=your-email@gmail.com
SMTP_USE_TLS=true

# Where to send the report
REPORT_TO_EMAIL=your-email@gmail.com  # Can be the same as FROM_EMAIL for testing

# When to send (every Monday at 9 AM)
REPORT_SCHEDULE_DAY=monday
REPORT_SCHEDULE_TIME=09:00
```

**Gmail App Password Setup:**
1. Go to https://myaccount.google.com/security
2. Enable 2-Step Verification if not already enabled
3. Go to https://myaccount.google.com/apppasswords
4. Create a new app password for "Mail"
5. Use the generated 16-character password in `SMTP_PASSWORD`

## Step 3: Test Email Configuration

```bash
python3.11 test_email.py
```

✅ **Success**: Check your inbox for the test email
❌ **Failed**: Check the error message and verify your SMTP settings

## Step 4: Test Weekly Report

Run the reporter once to see a real weekly report:

```bash
python3.11 weekly_reporter.py
```

This will:
1. Connect to your advisor agent
2. Analyze this week's expenses
3. Generate AI-powered insights
4. Send a formatted email report

**Expected output:**
```
INFO: Initializing weekly reporter...
INFO: ✓ Connected to advisor agent
INFO: ✓ Email sender configured
INFO: Generating weekly analysis...
INFO: ✓ Weekly analysis generated
INFO: ✓ Email sent successfully
INFO: ✅ Weekly report sent to your-email@gmail.com
```

## Step 5: Start Automatic Scheduling

To receive weekly reports automatically:

```bash
# Run the scheduler (keeps running)
python3.11 scheduler.py
```

**To run in background:**

```bash
# Option 1: Using nohup
nohup python3.11 scheduler.py > scheduler.log 2>&1 &

# Option 2: Using screen (recommended for testing)
screen -S budget-reporter
python3.11 scheduler.py
# Press Ctrl+A then D to detach

# To reattach later:
screen -r budget-reporter
```

## Verification

After starting the scheduler, you should see:

```
INFO: Starting Budget Advisor Weekly Reporter Scheduler
INFO: Report will be sent to: your-email@gmail.com
INFO: Schedule: Every Monday at 09:00
INFO: ✓ Scheduler started. Press Ctrl+C to stop.
```

The scheduler will now run continuously and send reports at the configured time.

## What's Next?

### Customize Your Schedule

Edit `.env` to change when reports are sent:

```bash
# Send every Friday afternoon
REPORT_SCHEDULE_DAY=friday
REPORT_SCHEDULE_TIME=17:00

# Send every Sunday evening
REPORT_SCHEDULE_DAY=sunday
REPORT_SCHEDULE_TIME=20:00
```

### Run as a System Service

For production use, set up the scheduler as a system service so it starts automatically on boot.

See the main README.md for:
- systemd service setup (Linux/macOS)
- cron setup (alternative)
- Docker deployment

### Multiple Reports

Want different schedules or recipients? Run multiple scheduler instances with different `.env` files:

```bash
# Create separate config directories
mkdir ~/budget-reporter-daily
cp .env ~/budget-reporter-daily/.env
# Edit ~/budget-reporter-daily/.env with daily settings

# Run with different config
cd ~/budget-reporter-daily
DOTENV_PATH=~/budget-reporter-daily/.env python3.11 /path/to/scheduler.py
```

## Troubleshooting

### "REPORT_TO_EMAIL not set"
➡️ Make sure you created `.env` file (not just `.env.example`)

### "Failed to send email"
➡️ Run `python3.11 test_email.py` to diagnose SMTP issues
➡️ Check Gmail app password is correct (not your regular password)
➡️ Verify SMTP_HOST and SMTP_PORT match your email provider

### "Failed to connect to advisor agent"
➡️ Make sure Ollama is running: `curl http://localhost:11434/api/tags`
➡️ Check MCP server configuration in advisor-agent
➡️ Verify database connection settings

### "No data in weekly report"
➡️ Check database has recent data (last 7 days)
➡️ Verify table `family_budget.dailyexpensevw` exists
➡️ Test with advisor agent directly: `cd ../advisor-agent && python3.11 advisor.py`

## Getting Help

If you encounter issues:

1. Check logs for error messages
2. Run test scripts: `test_email.py` and `weekly_reporter.py`
3. Verify all prerequisites are running
4. Review the full README.md for detailed troubleshooting

## Example Email Report

You'll receive a professional HTML email with:

```
📊 Budget Advisor - Weekly Report (Jan 01, 2026)

Week of December 29 - January 04, 2026

Weekly Expense Summary:
• Total Spending: $458.30
• Categories:
  - Food: $215.50 (12 transactions)
  - Transport: $95.00 (5 transactions)
  - Entertainment: $87.80 (8 transactions)
  - Utilities: $60.00 (3 transactions)

Analysis:
Your spending this week was 15% higher than average, primarily due to
increased food expenses. Consider meal planning for next week to reduce
dining out costs.

Recommendations:
1. Set a food budget of $180 for next week
2. Review recurring subscriptions in Entertainment
3. Great job keeping transportation costs low!
```

Happy budgeting! 📊💰
