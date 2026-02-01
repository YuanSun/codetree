# New MCP Tools for Monthly Expense Queries

## Overview

Added two new tools to the Budget Advisor MCP Server for querying monthly expense data with year and month parameters.

## Tools Added

### 1. `get_monthly_grouped_expenses`

**Description**: Get aggregated expenses grouped by category for a specific month.

**Parameters**:
- `target_year` (number, required): Year (e.g., 2024)
- `target_month` (number, required): Month (1-12)

**Returns**: List of expense categories with total amounts

**SQL Query**:
```sql
SELECT
    "typeName",
    SUM("expense_numeric") AS total_expense
FROM family_budget.dailyexpensevw
WHERE
    EXTRACT(YEAR FROM "date") = :target_year
    AND EXTRACT(MONTH FROM "date") = :target_month
GROUP BY "typeName"
ORDER BY total_expense DESC;
```

**Example Usage**:
```python
# Get January 2024 expenses grouped by category
result = await session.call_tool(
    "get_monthly_grouped_expenses",
    arguments={
        "target_year": 2024,
        "target_month": 1
    }
)
```

**Example Response**:
```json
[
  {
    "typeName": "Housing (Rent/Mortgage)",
    "total_expense": 1257.03
  },
  {
    "typeName": "Food",
    "total_expense": 368.70
  },
  ...
]
```

---

### 2. `get_monthly_detailed_expenses`

**Description**: Get detailed transaction-level expenses for a specific month.

**Parameters**:
- `target_year` (number, required): Year (e.g., 2024)
- `target_month` (number, required): Month (1-12)

**Returns**: List of all transactions with full details

**SQL Query**:
```sql
SELECT
    "typeName",
    "date",
    "expense",
    "merchantName",
    "merchantCity",
    "merchantStateOrProvince",
    "merchantCountry",
    "comment",
    "attachment",
    "expense_numeric"
FROM family_budget.dailyexpensevw
WHERE
    EXTRACT(YEAR FROM "date") = :target_year
    AND EXTRACT(MONTH FROM "date") = :target_month
ORDER BY "typeName", "date";
```

**Example Usage**:
```python
# Get all January 2024 transactions with details
result = await session.call_tool(
    "get_monthly_detailed_expenses",
    arguments={
        "target_year": 2024,
        "target_month": 1
    }
)
```

**Example Response**:
```json
[
  {
    "typeName": "Food",
    "date": "2024-01-15",
    "expense": "45.99",
    "merchantName": "Whole Foods Market",
    "merchantCity": "San Francisco",
    "merchantStateOrProvince": "CA",
    "merchantCountry": "USA",
    "comment": "Weekly groceries",
    "attachment": null,
    "expense_numeric": 45.99
  },
  ...
]
```

## Use Cases

### 1. Month-to-Month Comparison
```python
# Compare January and February 2024
jan_data = await session.call_tool("get_monthly_grouped_expenses",
    {"target_year": 2024, "target_month": 1})
feb_data = await session.call_tool("get_monthly_grouped_expenses",
    {"target_year": 2024, "target_month": 2})
```

### 2. Year-over-Year Analysis
```python
# Compare January 2024 vs January 2025
jan_2024 = await session.call_tool("get_monthly_grouped_expenses",
    {"target_year": 2024, "target_month": 1})
jan_2025 = await session.call_tool("get_monthly_grouped_expenses",
    {"target_year": 2025, "target_month": 1})
```

### 3. Detailed Transaction Review
```python
# Get all December transactions for holiday spending analysis
dec_details = await session.call_tool("get_monthly_detailed_expenses",
    {"target_year": 2024, "target_month": 12})
```

### 4. AI Advisor Queries
The AI advisor can now answer questions like:
- "Compare my spending in October 2024 vs November 2024"
- "Show me all my restaurant expenses in December 2024"
- "What were my total expenses by category in July 2024?"
- "List all transactions at Whole Foods in January 2024"

## Availability

These tools are available in:
- ✅ **server.py** (stdio MCP server)
- ✅ **server_http.py** (HTTP/SSE MCP server)

## Testing

Run the test scripts to verify functionality:

```bash
# Test database functions directly
python3 test_db_functions.py

# Test via MCP client (requires MCP server running)
python3 test_new_tools.py
```

## Migration from Existing Tools

### Old Way:
```python
# Only supports YYYY-MM format string
result = await session.call_tool("get_monthly_summary", {"month": "2024-01"})
```

### New Way:
```python
# More flexible with separate year/month integers
result = await session.call_tool("get_monthly_grouped_expenses", {
    "target_year": 2024,
    "target_month": 1
})
```

**Note**: The old `get_monthly_summary` tool is still available for backward compatibility.

## Implementation Details

- **Location**: All functions are in `db_operations.py` (following DRY principle)
- **Security**: Uses parameterized queries to prevent SQL injection
- **Error Handling**: Validates required parameters and provides clear error messages
- **Connection Pooling**: Uses shared database connection pool for efficiency
- **Logging**: Logs all queries with year/month information for debugging

## Future Enhancements

Potential future additions:
- Year-to-date aggregation tool
- Custom date range queries
- Category filtering for detailed expenses
- Merchant-based filtering
- Export to CSV/Excel functionality
