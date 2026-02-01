# New MCP Tools for Monthly Expense Queries

## Overview

Added three new tools to the Budget Advisor MCP Server for querying monthly expense data with year and month parameters, including a validated category-based query tool.

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

---

### 3. `get_expenses_by_category`

**Description**: Get all expenses for a specific category (typeName) with validation against the MerchantType table.

**Parameters**:
- `target_year` (number, required): Year (e.g., 2024)
- `target_month` (number, required): Month (1-12)
- `type_name` (string, required): Category name (e.g., "Food", "Transportation/Gas")

**Returns**: List of all expense records matching the category, year, and month

**Validation**: The tool first queries `family_budget."MerchantType"` to get valid categories, then validates the provided `type_name` before querying expenses.

**SQL Queries**:
```sql
-- Step 1: Get valid categories (for validation)
SELECT "typeName"
FROM family_budget."MerchantType"
ORDER BY "typeName";

-- Step 2: Query expenses (only if type_name is valid)
SELECT *
FROM family_budget.dailyexpensevw
WHERE
    "typeName" = :type_name
    AND EXTRACT(YEAR FROM "date") = :target_year
    AND EXTRACT(MONTH FROM "date") = :target_month
ORDER BY "date";
```

**Example Usage**:
```python
# Get all Food expenses for January 2024
result = await session.call_tool(
    "get_expenses_by_category",
    arguments={
        "target_year": 2024,
        "target_month": 1,
        "type_name": "Food"
    }
)
```

**Example Response**:
```json
[
  {
    "id": 12345,
    "typeName": "Food",
    "date": "2024-01-05",
    "expense": "85.23",
    "merchantName": "Safeway",
    "merchantCity": "San Francisco",
    "merchantStateOrProvince": "CA",
    "merchantCountry": "USA",
    "comment": "Weekly groceries",
    "attachment": null,
    "expense_numeric": 85.23
  },
  {
    "id": 12389,
    "typeName": "Food",
    "date": "2024-01-12",
    "expense": "42.17",
    "merchantName": "Trader Joe's",
    "merchantCity": "Berkeley",
    "merchantStateOrProvince": "CA",
    "merchantCountry": "USA",
    "comment": null,
    "attachment": null,
    "expense_numeric": 42.17
  },
  ...
]
```

**Error Handling**:
If an invalid category is provided, the tool returns a clear error:
```json
{
  "error": "Invalid typeName: 'InvalidCategory'. Valid types are: Book & Education, Clothing, Entertainment, Food, ..."
}
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

### 4. Category-Specific Analysis
```python
# Get all Food expenses for January 2024
food_expenses = await session.call_tool("get_expenses_by_category", {
    "target_year": 2024,
    "target_month": 1,
    "type_name": "Food"
})

# Calculate total food spending
total = sum(item['expense_numeric'] for item in food_expenses)
```

### 5. AI Advisor Queries
The AI advisor can now answer questions like:
- "Compare my spending in October 2024 vs November 2024"
- "Show me all my restaurant expenses in December 2024"
- "What were my total expenses by category in July 2024?"
- "List all transactions at Whole Foods in January 2024"
- "How much did I spend on Food in January 2024?" (uses `get_expenses_by_category`)

## Availability

These tools are available in:
- ✅ **server.py** (stdio MCP server)
- ✅ **server_http.py** (HTTP/SSE MCP server)

## Testing

Run the test scripts to verify functionality:

```bash
# Test database functions directly
python3 test_db_functions.py

# Test category query with validation
python3 test_category_query.py

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

## Benefits of get_expenses_by_category

The new `get_expenses_by_category` tool provides several advantages over using raw SQL queries:

### 1. **Validation**
- Automatically validates category names against the MerchantType table
- Prevents typos and invalid queries
- Provides helpful error messages listing all valid categories

### 2. **Safety**
- Uses parameterized queries to prevent SQL injection
- No need to construct SQL strings manually
- Type-safe parameters (integers for year/month, validated string for category)

### 3. **Simplicity**
- Clean, intuitive API: just provide year, month, and category name
- No need to know the database schema or SQL syntax
- Consistent with other MCP tools

### 4. **Better AI Integration**
- AI can easily query specific categories by name
- Clear error messages help AI understand what went wrong
- Structured parameters make it easier for AI to construct valid queries

### Comparison:

**Old Way (using query_expenses)**:
```python
# Requires SQL knowledge, no validation, error-prone
result = await session.call_tool("query_expenses", {
    "query": "SELECT * FROM family_budget.dailyexpensevw WHERE \"typeName\" = 'Fod' AND EXTRACT(YEAR FROM date) = 2024"
})
# Typo in 'Food' -> returns empty result, hard to debug
```

**New Way (using get_expenses_by_category)**:
```python
# Simple, validated, clear errors
result = await session.call_tool("get_expenses_by_category", {
    "target_year": 2024,
    "target_month": 1,
    "type_name": "Fod"
})
# Returns: "Invalid typeName: 'Fod'. Valid types are: Food, ..."
```

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
