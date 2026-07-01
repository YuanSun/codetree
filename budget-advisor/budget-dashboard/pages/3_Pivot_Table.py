from datetime import date, timedelta

import pandas as pd
import streamlit as st
from dotenv import load_dotenv

import db

load_dotenv()

st.set_page_config(page_title="Pivot Table", page_icon="\U0001F5C3", layout="wide")
st.title("Pivot Table")

dataset = st.radio("Dataset", ["Expenses", "Income"], horizontal=True)

col1, col2 = st.columns(2)
with col1:
    start_date = st.date_input("Start date", value=date.today() - timedelta(days=365))
with col2:
    end_date = st.date_input("End date", value=date.today())

filters = {"start_date": start_date, "end_date": end_date}

if dataset == "Expenses":
    df = db.fetch_expenses(filters)
    value_col_default = "expense_numeric"
    dimension_cols = ["typeName", "merchantName", "merchantCity", "merchantStateOrProvince", "merchantCountry"]
    value_options = ["expense_numeric"]
else:
    df = db.fetch_income(filters)
    value_col_default = "income_numeric"
    dimension_cols = ["typeName", "sourceName", "sourceCity", "sourceStateOrProvince", "sourceCountry"]
    value_options = ["income_numeric"]

if df.empty:
    st.info("No rows match these filters.")
    st.stop()

df["date"] = pd.to_datetime(df["date"])
df["year"] = df["date"].dt.year
df["month"] = df["date"].dt.month
df["year_month"] = df["date"].dt.to_period("M").astype(str)

dimension_options = dimension_cols + ["year", "month", "year_month"]

col1, col2 = st.columns(2)
with col1:
    rows = st.multiselect("Rows", options=dimension_options, default=[dimension_options[0]])
with col2:
    columns = st.multiselect("Columns", options=dimension_options)

col3, col4 = st.columns(2)
with col3:
    value_col = st.selectbox("Value", options=value_options, index=value_options.index(value_col_default))
with col4:
    aggfunc = st.selectbox("Aggregation", options=["sum", "count", "mean", "min", "max"])

if not rows:
    st.info("Pick at least one field for Rows.")
    st.stop()

pivot = pd.pivot_table(
    df,
    index=rows,
    columns=columns or None,
    values=value_col,
    aggfunc=aggfunc,
    fill_value=0,
    margins=True,
    margins_name="Total",
)

st.dataframe(pivot, use_container_width=True)

st.download_button(
    "Download CSV",
    data=pivot.to_csv().encode("utf-8"),
    file_name=f"{dataset.lower()}_pivot.csv",
    mime="text/csv",
)
