from datetime import date, timedelta

import streamlit as st
from dotenv import load_dotenv

import auth
import db

load_dotenv()

st.set_page_config(page_title="Data Table", page_icon="\U0001F4CB", layout="wide")
auth.render_login_sidebar()
st.title("Data Table")

dataset = st.radio("Dataset", ["Expenses", "Income"], horizontal=True)

col1, col2, col3 = st.columns(3)
with col1:
    start_date = st.date_input("Start date", value=date.today() - timedelta(days=90))
with col2:
    end_date = st.date_input("End date", value=date.today())
with col3:
    name_search = st.text_input("Merchant / source name contains")

filters = {
    "start_date": start_date,
    "end_date": end_date,
    "name_search": name_search or None,
}

if dataset == "Expenses":
    all_types = db.get_expense_types()
else:
    all_types = db.get_income_types()

selected_types = st.multiselect("Category", options=all_types)
if selected_types:
    filters["types"] = selected_types

if dataset == "Expenses":
    df = db.fetch_expenses(filters)
    value_col = "expense_numeric"
    dimension_cols = ["typeName", "merchantName", "merchantCity", "merchantStateOrProvince", "merchantCountry"]
else:
    df = db.fetch_income(filters)
    value_col = "income_numeric"
    dimension_cols = ["typeName", "sourceName", "sourceCity", "sourceStateOrProvince", "sourceCountry"]

total = df[value_col].sum() if not df.empty else 0

st.caption(f"{len(df)} rows — total {total:,.2f}")
st.dataframe(df, width="stretch", hide_index=True)

st.download_button(
    "Download CSV",
    data=df.to_csv(index=False).encode("utf-8"),
    file_name=f"{dataset.lower()}.csv",
    mime="text/csv",
)

st.divider()
st.subheader("Group by")

col1, col2 = st.columns(2)
with col1:
    group_cols = st.multiselect("Group by column(s)", options=dimension_cols)
with col2:
    aggfunc = st.selectbox("Aggregation", options=["sum", "count", "mean", "min", "max"])

if group_cols and not df.empty:
    grouped = (
        df.groupby(group_cols)[value_col]
        .agg(aggfunc)
        .reset_index()
        .sort_values(value_col, ascending=False)
    )
    st.dataframe(grouped, width="stretch", hide_index=True)
    st.download_button(
        "Download grouped CSV",
        data=grouped.to_csv(index=False).encode("utf-8"),
        file_name=f"{dataset.lower()}_grouped.csv",
        mime="text/csv",
    )
elif group_cols:
    st.info("No rows to group.")
else:
    st.caption("Pick at least one column above to see a grouped summary.")
