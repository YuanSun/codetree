# Budget Advisor - Expense Reporter

Automatically generates weekly and monthly expense analysis using the advisor agent and sends email reports.

## Features

- 📊 **Weekly Analysis**: Leverages the existing advisor-agent to analyze weekly expenses
- 📅 **Monthly Reviews**: Comprehensive month-over-month comparison with visual charts
- 📧 **Email Reports**: Sends formatted HTML and plain text email reports
- 📈 **Visual Charts**: Pie charts showing category breakdowns in monthly reports
- ⏰ **Automated Scheduling**: Runs on a schedule (weekly/monthly)
- 🎨 **Beautiful Formatting**: Professional HTML email templates with tables
- ⚙️ **Configurable**: Easy configuration via environment variables

## Architecture

```
expense-reporter/
├── email_sender.py        # SMTP email sending functionality
├── expense_reporter.py    # Main reporter that uses advisor-agent
├── scheduler.py           # Automated scheduling
├── requirements.txt       # Python dependencies
├── .env.example           # Configuration template
└── README.md             # This file
```

**Dependencies:**
- Uses `advisor-agent` for expense analysis
- Uses `postgres-mcp-server` for data access (through advisor-agent)
- Requires Ollama for AI-powered analysis

## Setup

### 1. Install Dependencies

```bash
cd budget-advisor/expense-reporter
pip install -r requirements.txt
```

**Dependencies:**
- `schedule` - For automated scheduling
- `python-dotenv` - For environment variable management
- `matplotlib` - For generating pie charts in monthly reports

### 2. Configure Email

Copy the example configuration:

```bash
cp .env.example .env
```

Edit `.env` and configure your email settings:

#### For Gmail:

1. **Enable 2-Factor Authentication** on your Google account
2. **Generate an App Password**:
   - Go to https://myaccount.google.com/security
   - Select "2-Step Verification"
   - Scroll down to "App passwords"
   - Generate a new app password for "Mail"
3. **Configure .env**:
   ```bash
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=your-app-specific-password  # Use the generated app password
   FROM_EMAIL=your-email@gmail.com
   SMTP_USE_TLS=true
   REPORT_TO_EMAIL=recipient@example.com
   ```

#### For Outlook/Hotmail:

```bash
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASSWORD=your-password
FROM_EMAIL=your-email@outlook.com
SMTP_USE_TLS=true
REPORT_TO_EMAIL=recipient@example.com
```

#### For Other Email Providers:

Check your email provider's SMTP settings and configure accordingly.

### 3. Configure Schedule

In `.env`, set when you want to receive reports:

```bash
# Weekly Report Configuration
WEEKLY_REPORT_ENABLED=true          # Enable/disable weekly reports
WEEKLY_REPORT_DAY=monday            # Day of week (monday-sunday)
WEEKLY_REPORT_TIME=09:00            # Time in HH:MM format (24-hour)

# Monthly Report Configuration
MONTHLY_REPORT_ENABLED=true         # Enable/disable monthly reports
MONTHLY_REPORT_TIME=09:00           # Time in HH:MM format (24-hour)
                                     # Runs on 1st of each month
```

**Configuration Options:**
- Valid days: `monday`, `tuesday`, `wednesday`, `thursday`, `friday`, `saturday`, `sunday`
- Time format: `HH:MM` (24-hour format)
- Monthly reports automatically run on the 1st of each month
- You can enable/disable each report type independently

### 4. Ensure Dependencies are Running

Make sure these components are set up and running:

1. **PostgreSQL database** with your budget data
2. **Ollama** with your chosen model (e.g., llama3.2)
3. **MCP server** configuration (server.py should be accessible)

## Usage

### Run Weekly Report (Manual Test)

Test the weekly reporter by running it once:

```bash
cd budget-advisor/expense-reporter
python3.11 expense_reporter.py --mode weekly
```

This will:
1. Connect to the advisor agent
2. Generate weekly expense analysis
3. Send email report to `REPORT_TO_EMAIL`

### Run Monthly Report

Generate and send a monthly review report:

```bash
cd budget-advisor/expense-reporter
# Send report for previous month (default)
python3.11 expense_reporter.py --mode monthly

# Send report for specific month
python3.11 expense_reporter.py --mode monthly --year 2026 --month 1
```

This will:
1. Call advisor agent to generate monthly review with month-over-month comparison
2. Parse the review to extract category spending data
3. Generate a pie chart showing category breakdown
4. Format email with comparison table and chart
5. Send HTML email to `REPORT_TO_EMAIL`

### Run on Schedule

Start the scheduler to send reports automatically:

```bash
cd budget-advisor/expense-reporter
python3.11 scheduler.py
```

The scheduler will:
- Run continuously in the background
- Send weekly reports on the configured day/time
- Send monthly reports on the 1st of each month (if configured)
- Log all activities

**Keep it running:**

```bash
# Run in background with nohup
nohup python3.11 scheduler.py > scheduler.log 2>&1 &

# Or use a process manager like systemd, supervisor, or pm2
```

### Using systemd (Linux/macOS)

Create a systemd service file `/etc/systemd/system/budget-reporter.service`:

```ini
[Unit]
Description=Budget Advisor Expense Reporter
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/codetree/budget-advisor/expense-reporter
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStart=/usr/local/bin/python3.11 /path/to/codetree/budget-advisor/expense-reporter/scheduler.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl enable budget-reporter
sudo systemctl start budget-reporter
sudo systemctl status budget-reporter
```

### Using cron (Alternative)

Add to crontab for automated execution:

```bash
crontab -e

# Weekly report every Monday at 9 AM
0 9 * * 1 cd /path/to/codetree/budget-advisor/expense-reporter && /usr/local/bin/python3.11 expense_reporter.py --mode weekly

# Monthly report on the 1st of each month at 9 AM
0 9 1 * * cd /path/to/codetree/budget-advisor/expense-reporter && /usr/local/bin/python3.11 expense_reporter.py --mode monthly
```

## Email Report Format

### Weekly Report

The weekly email report includes:

1. **Week Information**: Date range for the analyzed week
2. **Expense Summary**:
   - Total spending
   - Breakdown by category
   - Transaction counts
3. **Analysis & Insights**:
   - Spending patterns
   - Comparison with previous weeks
   - Unusual expenses
4. **Recommendations**: AI-generated advice for the upcoming week

### Monthly Report

The monthly email report includes:

1. **Month Information**: Month and year being reviewed
2. **Pie Chart**: Visual breakdown of expenses by category
3. **Comparison Table**: Month-over-month comparison with columns:
   - Category name
   - Current month spending
   - Previous month spending
   - Dollar change (Δ)
   - Percentage change
4. **Analysis & Insights**:
   - Spending trends
   - Categories with significant changes
   - Notable patterns
5. **Recommendations**: AI-generated advice for the upcoming month

**Email Features:**
- Professional HTML formatting with gradient headers
- Plain text fallback for compatibility
- Mobile-friendly responsive design
- Clear sections and visual hierarchy
- Inline charts and formatted tables
- Color-coded positive/negative changes

## Troubleshooting

### Email not sending

**Check SMTP credentials:**
```bash
python3.11 -c "
from email_sender import create_email_sender_from_env
sender = create_email_sender_from_env()
print('SMTP configured successfully')
"
```

**Common issues:**
- Gmail: Make sure you're using an App Password, not your regular password
- Firewall: Ensure port 587 (or 465) is not blocked
- Authentication: Verify username/password are correct

### Advisor agent connection fails

**Check MCP server is accessible:**
```bash
cd budget-advisor/postgres-mcp-server
python3.11 server.py  # Should start without errors
```

**Check Ollama is running:**
```bash
curl http://localhost:11434/api/tags
```

### No analysis generated

**Check database has recent data:**
```bash
psql -h localhost -U your_user -d budget -c "SELECT COUNT(*) FROM family_budget.dailyexpensevw WHERE date >= CURRENT_DATE - INTERVAL '7 days';"
```

### Scheduler not running on time

**Check system time:**
```bash
date  # Make sure system time is correct
```

**Check scheduler logs:**
```bash
# If running in foreground, check the output
# If running with nohup, check the log file
tail -f scheduler.log
```

## Testing

### Test Email Sending

```bash
cd budget-advisor/expense-reporter
python3.11 << EOF
import asyncio
from email_sender import create_email_sender_from_env

sender = create_email_sender_from_env()
result = sender.send_report(
    to_email="${REPORT_TO_EMAIL}",
    subject="Test Email",
    analysis="This is a test email from Budget Advisor",
    week_info="Test Week"
)
print("✓ Email sent!" if result else "✗ Email failed")
EOF
```

### Test Weekly Report Generation

```bash
python3.11 expense_reporter.py --mode weekly
```

Check your email inbox for the weekly report.

### Test Monthly Report Generation

```bash
# Run interactive test script
python3.11 test_monthly_email.py
```

This will:
1. Generate a monthly review for January 2026
2. Create a pie chart from the category data
3. Send a formatted email with table and chart
4. Prompt for confirmation before sending

Or test directly:

```bash
python3.11 expense_reporter.py --mode monthly --year 2026 --month 1
```

Check your email inbox for the monthly report with comparison table and pie chart.

## Configuration Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `SMTP_HOST` | SMTP server hostname | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP server port | `587` (TLS) or `465` (SSL) |
| `SMTP_USER` | SMTP username | `your-email@gmail.com` |
| `SMTP_PASSWORD` | SMTP password or app password | `abcd efgh ijkl mnop` |
| `FROM_EMAIL` | Sender email address | `your-email@gmail.com` |
| `SMTP_USE_TLS` | Use TLS encryption | `true` or `false` |
| `REPORT_TO_EMAIL` | Recipient email address | `recipient@example.com` |
| `WEEKLY_REPORT_ENABLED` | Enable weekly reports | `true` or `false` |
| `WEEKLY_REPORT_DAY` | Day to send weekly report | `monday` through `sunday` |
| `WEEKLY_REPORT_TIME` | Time to send weekly report | `09:00` (24-hour format) |
| `MONTHLY_REPORT_ENABLED` | Enable monthly reports | `true` or `false` |
| `MONTHLY_REPORT_TIME` | Time to send monthly report (on 1st) | `09:00` (24-hour format) |
| `LOG_LEVEL` | Logging verbosity | `DEBUG`, `INFO`, `WARNING`, `ERROR` |

## Advanced Usage

### Multiple Recipients

To send to multiple recipients, you can:

1. **Run multiple scheduler instances** with different `REPORT_TO_EMAIL`
2. **Modify `email_sender.py`** to accept comma-separated emails
3. **Create a distribution list** in your email provider

### Custom Analysis

Modify `weekly_reporter.py` to customize the analysis:

```python
# In generate_weekly_analysis()
analysis_prompt = """
Your custom analysis prompt here.
Ask specific questions about spending categories,
trends, or generate custom insights.
"""
```

### Different Schedules

Run multiple schedulers for different schedules:

- Daily summary: `REPORT_SCHEDULE_DAY=daily`
- Bi-weekly: Run two instances on alternating weeks
- Month-end: Use cron instead for more complex scheduling

## Security Notes

⚠️ **Important Security Considerations:**

1. **Never commit `.env` file** - It contains sensitive credentials
2. **Use app-specific passwords** - Don't use your main email password
3. **Restrict file permissions**:
   ```bash
   chmod 600 .env
   ```
4. **Store credentials securely** - Consider using a secrets manager for production
5. **Use TLS/SSL** - Always use encrypted connections (SMTP_USE_TLS=true)

## License

Same as the Budget Advisor project.
