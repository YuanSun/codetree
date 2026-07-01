import calendar
from datetime import date

import altair as alt
import streamlit as st
from dotenv import load_dotenv

import auth

load_dotenv()

st.set_page_config(page_title="Overview", page_icon="\U0001F4CA", layout="wide")
auth.render_login_sidebar()

st.title("Overview")
st.markdown(
    """
Quick views over your `family_budget` Postgres data.

Use the sidebar to navigate:

- **Data Table** — browse expenses/income with filters
- **Upload Attachment** — attach a receipt/document to an existing expense row
- **Edit Entry** — modify an existing expense row's date/amount/comment (admin only)
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

st.divider()
st.subheader("Yearly Balance")

try:
    years = db.get_balance_years()
    if not years:
        st.info("No family_budget.balance_{year}_vw views found yet.")
    else:
        selected_year = st.selectbox("Year", options=sorted(years, reverse=True))
        balance_df = db.fetch_balance(selected_year)

        if balance_df.empty:
            st.info(f"No data in balance_{selected_year}_vw.")
        else:
            balance_df["month"] = balance_df["month"].astype(int)
            balance_df["month_name"] = balance_df["month"].map(lambda m: calendar.month_abbr[m])
            month_order = list(balance_df.sort_values("month")["month_name"])

            total_expense = balance_df["expense"].sum()
            total_income = balance_df["income"].sum()
            total_balance = balance_df["balance"].sum()

            col1, col2, col3 = st.columns(3)
            col1.metric(f"{selected_year} expenses", f"{total_expense:,.2f}")
            col2.metric(f"{selected_year} income", f"{total_income:,.2f}")
            col3.metric(f"{selected_year} balance", f"{total_balance:,.2f}")

            display_df = balance_df[["month_name", "expense", "income", "balance"]].rename(
                columns={"month_name": "month"}
            )
            st.dataframe(display_df, width="stretch", hide_index=True)

            melted = balance_df.melt(
                id_vars=["month_name"], value_vars=["expense", "income"], var_name="series", value_name="amount"
            )
            bars = (
                alt.Chart(melted)
                .mark_bar()
                .encode(
                    x=alt.X("month_name:N", sort=month_order, title="Month"),
                    y=alt.Y("amount:Q", title="Amount"),
                    color=alt.Color("series:N", title=""),
                    xOffset="series:N",
                    tooltip=["month_name", "series", "amount"],
                )
            )
            balance_line = (
                alt.Chart(balance_df)
                .mark_line(point=True, color="black")
                .encode(
                    x=alt.X("month_name:N", sort=month_order),
                    y=alt.Y("balance:Q", title="Balance"),
                    tooltip=["month_name", "balance"],
                )
            )
            st.altair_chart(bars + balance_line, width="stretch")
except Exception as e:
    st.info(f"Could not load yearly balance data. ({e})")
