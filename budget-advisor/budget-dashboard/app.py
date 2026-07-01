import os
from datetime import date

import streamlit as st
from dotenv import load_dotenv

load_dotenv()

st.set_page_config(page_title="Budget Dashboard", page_icon="\U0001F4CA", layout="wide")

st.title("Budget Dashboard")
st.markdown(
    """
Quick views over your `family_budget` Postgres data.

Use the sidebar to navigate:

- **Data Table** — browse expenses/income with filters
- **Upload Attachment** — attach a receipt/document to an existing expense row
- **Pivot Table** — Excel-style pivot/aggregation over expenses or income
"""
)

try:
    import db

    this_month_start = date.today().replace(day=1)
    expenses_df = db.fetch_expenses({"start_date": this_month_start})
    income_df = db.fetch_income({"start_date": this_month_start})

    col1, col2 = st.columns(2)
    col1.metric("This month's expenses", f"{expenses_df['expense_numeric'].sum():,.2f}")
    col2.metric("This month's income", f"{income_df['income_numeric'].sum():,.2f}")
except Exception as e:
    st.info(f"Connect a database to see this month's summary here. ({e})")
