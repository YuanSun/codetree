# Monthly Expense Review Feature

## Overview

The Monthly Expense Review feature provides a comprehensive comparison between two consecutive months, showing detailed breakdowns by category and AI-generated analysis.

## Features

- **Side-by-Side Comparison Table**: Compare current month with previous month
- **Category-Level Analysis**: See exactly which categories increased or decreased
- **Delta and Percentage Change**: Clear visualization of spending changes
- **AI-Powered Insights**: Automated analysis highlighting key trends and recommendations
- **Auto-Detection**: Automatically reviews the appropriate month when run at the beginning of a new month

## Usage

### Command Line

#### Review Previous Month (Auto-Detect)
```bash
# Automatically detects the appropriate month to review
# - If run in first 3 days of month: reviews previous month
# - Otherwise: reviews current month
python3 advisor.py --mode monthly-review
```

#### Review Specific Month
```bash
# Review January 2026 (compares with December 2025)
python3 advisor.py --mode monthly-review --year 2026 --month 1

# Review December 2025 (compares with November 2025)
python3 advisor.py --mode monthly-review --year 2025 --month 12
```

### Interactive Mode

Start interactive mode and use the `/monthly-review` command:

```bash
python3 advisor.py --mode interactive
```

Then type:
```
/monthly-review
```

### Programmatic Access

```python
from advisor import BudgetAdvisor
import asyncio

async def generate_review():
    advisor = BudgetAdvisor()
    await advisor.connect_to_mcp_server()

    # Generate review for January 2026
    review = await advisor.generate_monthly_review(2026, 1)
    print(review)

    await advisor.close()

asyncio.run(generate_review())
```

## Output Format

The monthly review generates two sections:

### 1. Comparison Table

```
====================================================================================================
Expense Overview – 2026 Jan vs. 2025 Dec
====================================================================================================

Category                             2026 Jan    2025 Dec    Δ (Change)    % Change
----------------------------------------------------------------------------------------------------
Book & Education                    $4,221.31   $1,781.17      +2,440.14        +137%
Rent / Mortgage / Utilities         $2,357.44   $2,048.04        +309.40         +15%
Food                                $1,710.72   $1,119.30        +591.42         +53%
Monthly recurring expense           $1,627.29   $2,396.11        −768.82         −32%
Life consumption                    $1,293.14     $675.38        +617.76         +92%
Clothing                              $972.24     $679.77        +292.47         +43%
One-time shopping                     $699.05           –        +699.05         NEW
Transportation & Gas                  $593.76     $691.71         −97.95         −14%
Self-care                             $580.76     $463.10        +117.66         +25%
Restaurant                            $496.25     $870.23        −373.98         −43%
Sport                                 $448.40           –        +448.40         NEW
Financial expense                     $366.11     $558.15        −192.04         −34%
Entertainment                         $177.40     $244.51         −67.11         −27%
Cosmetics                             $152.33           –        +152.33         NEW
Housing                                     –     $160.00              –     REMOVED
Medical care                                –      $58.00              –     REMOVED
----------------------------------------------------------------------------------------------------
TOTAL                              $16,606.20  $12,845.47      +3,760.73         +29%
====================================================================================================
```

### 2. AI Analysis

The AI provides:
- **Overall Assessment**: Summary of spending pattern changes
- **Key Insights**: Top 3-4 notable changes and their implications
- **Categories Needing Attention**: Which categories should be monitored
- **Recommendations**: 2-3 specific actionable suggestions
- **Positive Notes**: Encouraging trends or good financial habits

## Special Handling

- **New Categories**: Shown with "NEW" percentage and full amount as delta
- **Removed Categories**: Shown with "REMOVED" percentage
- **No Change**: Shown as "–" for both delta and percentage
- **Negative Values**: Handled correctly in calculations (e.g., refunds)

## Use Cases

### 1. Beginning of Month Review
Run on the 1st-3rd of each month to automatically review the previous month:
```bash
python3 advisor.py --mode monthly-review
```

### 2. Mid-Month Check-In
Review current month progress compared to previous month:
```bash
python3 advisor.py --mode monthly-review --year 2026 --month 2
```

### 3. Historical Analysis
Compare any two consecutive months:
```bash
python3 advisor.py --mode monthly-review --year 2025 --month 6
```

### 4. Automated Reporting
Integrate into cron job or scheduled task for automatic monthly reports:
```bash
# Run on the 1st of every month at 9 AM
0 9 1 * * /path/to/python3 /path/to/advisor.py --mode monthly-review > monthly_report.txt
```

## Integration with Email Reporter

You can also integrate the monthly review into the weekly-reporter for monthly email summaries.

Example modification to `weekly_reporter.py`:
```python
# At the beginning of each month, generate and email monthly review
if datetime.now().day <= 3:
    # Generate monthly review instead of weekly
    result = subprocess.run(
        [python_cmd, advisor_path, "--mode", "monthly-review"],
        capture_output=True,
        text=True,
        timeout=120
    )
    # Send via email...
```

## Requirements

- **MCP Tools**: Uses `get_monthly_grouped_expenses` tool
- **Ollama**: For AI analysis generation
- **Database**: Must have at least 2 months of expense data

## Testing

Run the test script to verify functionality:
```bash
python3 test_monthly_review.py
```

## Tips

1. **Best Time to Run**: First few days of a new month for previous month review
2. **Regular Schedule**: Set up monthly cron job for consistent tracking
3. **Compare with Goals**: Use the insights to adjust monthly budgets
4. **Track Trends**: Run reviews for multiple months to identify long-term patterns
5. **Act on Recommendations**: The AI suggestions are actionable - implement them!

## Troubleshooting

### "No data returned"
- Ensure the MCP server is running
- Verify database has expense data for the requested months
- Check database connection settings in `.env`

### "Connection timeout"
- Increase timeout in advisor.py (default 120 seconds)
- Check if Ollama is running for AI analysis

### "Invalid month"
- Month must be 1-12
- Year must be a valid integer
- Ensure the month has data in the database
