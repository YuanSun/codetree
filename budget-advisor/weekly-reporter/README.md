# Budget Advisor - Weekly Reporter

Automatically generates weekly expense analysis using the advisor agent and sends email reports.

## Features

- 📊 **Weekly Analysis**: Leverages the existing advisor-agent to analyze weekly expenses
- 📧 **Email Reports**: Sends formatted HTML and plain text email reports
- ⏰ **Automated Scheduling**: Runs on a schedule (e.g., every Monday morning)
- 🎨 **Beautiful Formatting**: Professional HTML email templates
- ⚙️ **Configurable**: Easy configuration via environment variables

## Architecture

```
weekly-reporter/
├── email_sender.py       # SMTP email sending functionality
├── weekly_reporter.py    # Main reporter that uses advisor-agent
├── scheduler.py          # Automated scheduling
├── requirements.txt      # Python dependencies
├── .env.example          # Configuration template
└── README.md            # This file
```

**Dependencies:**
- Uses `advisor-agent` for expense analysis
- Uses `postgres-mcp-server` for data access (through advisor-agent)
- Requires Ollama for AI-powered analysis

## Setup

### 1. Install Dependencies

```bash
cd budget-advisor/weekly-reporter
pip install -r requirements.txt
```

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
# Send report every Monday at 9:00 AM
REPORT_SCHEDULE_DAY=monday
REPORT_SCHEDULE_TIME=09:00
```

Valid days: `monday`, `tuesday`, `wednesday`, `thursday`, `friday`, `saturday`, `sunday`

Time format: `HH:MM` (24-hour format)

### 4. Ensure Dependencies are Running

Make sure these components are set up and running:

1. **PostgreSQL database** with your budget data
2. **Ollama** with your chosen model (e.g., llama3.2)
3. **MCP server** configuration (server.py should be accessible)

## Usage

### Run Once (Manual Test)

Test the reporter by running it once:

```bash
cd budget-advisor/weekly-reporter
python3.11 weekly_reporter.py
```

This will:
1. Connect to the advisor agent
2. Generate weekly expense analysis
3. Send email report to `REPORT_TO_EMAIL`

### Run on Schedule

Start the scheduler to send reports automatically:

```bash
cd budget-advisor/weekly-reporter
python3.11 scheduler.py
```

The scheduler will:
- Run continuously in the background
- Send reports on the configured day/time
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
Description=Budget Advisor Weekly Reporter
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/codetree/budget-advisor/weekly-reporter
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStart=/usr/local/bin/python3.11 /path/to/codetree/budget-advisor/weekly-reporter/scheduler.py
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

Add to crontab for weekly Monday 9 AM execution:

```bash
crontab -e

# Add this line:
0 9 * * 1 cd /path/to/codetree/budget-advisor/weekly-reporter && /usr/local/bin/python3.11 weekly_reporter.py
```

## Email Report Format

The email report includes:

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

**Email Features:**
- Professional HTML formatting with styling
- Plain text fallback for compatibility
- Mobile-friendly responsive design
- Clear sections and visual hierarchy

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
cd budget-advisor/weekly-reporter
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
python3.11 weekly_reporter.py
```

Check your email inbox for the report.

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
| `REPORT_SCHEDULE_DAY` | Day to send report | `monday` through `sunday` |
| `REPORT_SCHEDULE_TIME` | Time to send report | `09:00` (24-hour format) |
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
