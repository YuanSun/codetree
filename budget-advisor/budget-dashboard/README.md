# Budget Dashboard

A quick Streamlit page over the `family_budget` Postgres data used by the rest of `budget-advisor`.

## Features

- **Overview** (`app.py`, the landing page): this month's expense/income totals, plus a **Yearly Balance** section — pick a year and see the monthly expense/income/balance breakdown (table + bar+line chart) from `family_budget.balance_{year}_vw`. Which years show up is discovered automatically from the schema, so adding a new `balance_2027_vw` view next year just works.
- **Data Table**: browse `dailyexpensevw` / `incomevw` with date, category, and name filters; download as CSV. Also has a **Group by** section below — pick one or more columns and an aggregation function (sum/count/mean/min/max) to summarize the currently filtered rows, sorted descending; downloadable as its own CSV.
- **Upload Attachment**: filter by date, category, name, amount range, and attachment status, then click a row directly in the table to select it and attach a receipt/document. The file's raw bytes are stored directly in `DailyExpense.attachment` (a `bytea` column) — not on disk. Open to any logged-in or logged-out user.
- **Edit Entry** *(admin only)*: click a row and edit its date, amount, or comment. Merchant/category/location aren't editable here since they live in shared lookup tables used by other rows.
- **Pivot Table**: Excel-style pivot over expenses or income — pick Rows/Columns/Value/Aggregation — plus a Bar/Line/Area/Pie chart of the top N rows underneath for a quick visual read.

## Setup

```bash
cd budget-dashboard
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your database credentials

# Create at least one admin user (prompts for a password)
python manage_users.py add reggie admin
# Optionally add view-only users
python manage_users.py add family user

streamlit run app.py
```

Then open the URL Streamlit prints (defaults to http://localhost:8501).

`.streamlit/config.toml` sets `server.headless = true`, so it won't automatically pop open a browser tab each time you start it.

## Notes

- Attachments are only supported for expenses. `family_budget.Incomes` has no `attachment` column today, so the Upload Attachment page only works against expenses.
- Attachments are stored as raw bytes directly in the `DailyExpense.attachment` `bytea` column, not as files on disk. This is intentionally simple for a personal/family tool with a small number of attachments — it's not meant to scale to large volumes of large files (e.g. many multi-MB PDFs), since every listing query and connection carries that cost. The original filename isn't preserved (the schema only has an `attachment` column, no filename column), so downloads are named generically (`expense_{id}_attachment`).
- This app connects directly to Postgres with its own connection pool (`db.py`) — it does not share a process with `postgres-mcp-server`, but can point at the same database via the same env var names.
- **Auth**: `auth.py` gates the Edit Entry page behind a login stored in a local `users.json` (gitignored, defaults next to this app; override with `DASHBOARD_USERS_FILE`). Manage accounts with `python manage_users.py add|remove|list` — this hashes passwords for you rather than storing them in plaintext. It's a lightweight, personal-use login, not intended for internet-facing deployment.
  - `password_hash` is a **plain SHA-256 of the password** (`{"username": "...", "password_hash": "...", "role": "admin"}`) — no per-user salt — so you can also build entries by hand with any SHA-256 tool, e.g. `printf '%s' 'yourpassword' | sha256sum` (make sure there's no trailing newline, which `sha256sum` alone would include).
- `update_expense_fields` in `db.py` writes directly to `DailyExpense.expense_numeric`; if your schema treats `expense` (the raw text amount) as independently significant rather than derived, you may want to extend that function to keep both in sync.

## Testing

```bash
pip install -r requirements.txt pytest
pytest tests/
```
