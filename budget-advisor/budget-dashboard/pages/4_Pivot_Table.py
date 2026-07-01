from datetime import date, timedelta

import altair as alt
import pandas as pd
import streamlit as st
from dotenv import load_dotenv

import auth
import db

load_dotenv()

st.set_page_config(page_title="Pivot Table", page_icon="\U0001F5C3", layout="wide")
auth.render_login_sidebar()
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

st.dataframe(pivot, width="stretch")

st.download_button(
    "Download CSV",
    data=pivot.to_csv().encode("utf-8"),
    file_name=f"{dataset.lower()}_pivot.csv",
    mime="text/csv",
)

st.divider()
st.subheader("Chart")

pivot_chart = pd.pivot_table(
    df,
    index=rows,
    columns=columns or None,
    values=value_col,
    aggfunc=aggfunc,
    fill_value=0,
)

if isinstance(pivot_chart.columns, pd.MultiIndex):
    pivot_chart.columns = [" / ".join(str(c) for c in col) for col in pivot_chart.columns]
else:
    pivot_chart.columns = [str(c) for c in pivot_chart.columns]

pivot_chart.index = pivot_chart.index.map(lambda idx: " / ".join(str(v) for v in idx) if isinstance(idx, tuple) else str(idx))

row_total = pivot_chart.sum(axis=1)
pivot_chart = pivot_chart.loc[row_total.sort_values(ascending=False).index]

col1, col2 = st.columns(2)
with col1:
    chart_type = st.selectbox("Chart type", ["Bar", "Line", "Area", "Pie"])
with col2:
    top_n = st.slider("Show top N rows", min_value=5, max_value=max(5, len(pivot_chart)), value=min(15, len(pivot_chart)))

chart_data = pivot_chart.head(top_n)
row_order = list(chart_data.index)
series_names = list(chart_data.columns)

if chart_type == "Pie":
    if len(series_names) > 1:
        pie_series = st.selectbox("Series to chart", options=series_names)
    else:
        pie_series = series_names[0]
    pie_data = chart_data[[pie_series]].reset_index()
    pie_data.columns = ["row_label", "value"]
    pie_data["percentage"] = pie_data["value"] / pie_data["value"].sum() * 100
    pie_data["percentage_label"] = pie_data["percentage"].map(lambda p: f"{p:.1f}%")

    base = alt.Chart(pie_data).encode(
        theta=alt.Theta("value:Q", stack=True),
        color=alt.Color("row_label:N", sort=row_order, title=", ".join(rows)),
        tooltip=["row_label", "value", alt.Tooltip("percentage:Q", format=".1f", title="percentage")],
    )
    arc = base.mark_arc(outerRadius=120)
    labels = base.mark_text(radius=140, size=12).encode(text="percentage_label:N")
    st.altair_chart(arc + labels, width="stretch")
else:
    melted = chart_data.reset_index(names="row_label").melt(id_vars="row_label", var_name="series", value_name="value")
    mark = {"Bar": "bar", "Line": "line", "Area": "area"}[chart_type]
    encoding = {
        "x": alt.X("row_label:N", sort=row_order, title=", ".join(rows)),
        "y": alt.Y("value:Q", title=f"{aggfunc}({value_col})"),
        "tooltip": ["row_label", "series", "value"],
    }
    if len(series_names) > 1:
        encoding["color"] = alt.Color("series:N", title=", ".join(columns))
        if chart_type == "Bar":
            encoding["xOffset"] = "series:N"
    chart = getattr(alt.Chart(melted), f"mark_{mark}")().encode(**encoding)
    st.altair_chart(chart, width="stretch")
