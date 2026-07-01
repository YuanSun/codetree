# Budget Dashboard

A quick Streamlit page over the `family_budget` Postgres data used by the rest of `budget-advisor`.

## Features

- **Data Table**: browse `dailyexpensevw` / `incomevw` with date, category, and name filters; download as CSV.
- **Upload Attachment**: pick an existing expense row and attach a receipt/document to it (stored on local disk, path saved in `DailyExpense.attachment`).
- **Pivot Table**: Excel-style pivot over expenses or income — pick Rows/Columns/Value/Aggregation.

## Setup

```bash
cd budget-dashboard
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your database credentials
streamlit run app.py
```

Then open the URL Streamlit prints (defaults to http://localhost:8501).

## Notes

- Attachments are only supported for expenses. `family_budget.Incomes` has no `attachment` column today, so the Upload Attachment page only works against expenses.
- Uploaded files are stored under `ATTACHMENT_STORAGE_DIR` (default `./uploads`), organized as `uploads/expense/{row_id}/{file}`. This directory is gitignored.
- This app connects directly to Postgres with its own connection pool (`db.py`) — it does not share a process with `postgres-mcp-server`, but can point at the same database via the same env var names.

## Testing

```bash
pip install -r requirements.txt pytest
pytest tests/
```
