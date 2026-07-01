from datetime import date, timedelta

import streamlit as st
from dotenv import load_dotenv

import auth
import db

load_dotenv()

st.set_page_config(page_title="Upload Attachment", page_icon="\U0001F4CE", layout="wide")
auth.render_login_sidebar()
st.title("Upload Attachment")

st.markdown("Attach a receipt/document to an existing **expense** row.")
st.caption(
    "Note: income rows have no attachment column in family_budget.Incomes today, "
    "so only expenses are supported here."
)

col1, col2, col3, col4 = st.columns(4)
with col1:
    start_date = st.date_input("Start date", value=date.today() - timedelta(days=30))
with col2:
    end_date = st.date_input("End date", value=date.today())
with col3:
    name_search = st.text_input("Merchant name contains")
with col4:
    attachment_status = st.selectbox("Attachment", ["All", "Missing only", "Has attachment"])

all_types = db.get_expense_types()
col5, col6, col7 = st.columns(3)
with col5:
    selected_types = st.multiselect("Category", options=all_types)
with col6:
    min_amount = st.number_input("Min amount", value=0.0, step=10.0)
with col7:
    max_amount = st.number_input("Max amount", value=0.0, step=10.0, help="0 means no upper bound")

filters = {"start_date": start_date, "end_date": end_date, "name_search": name_search or None}
if selected_types:
    filters["types"] = selected_types

df = db.fetch_expenses(filters)

if min_amount:
    df = df[df["expense_numeric"] >= min_amount]
if max_amount:
    df = df[df["expense_numeric"] <= max_amount]
if attachment_status == "Missing only":
    df = df[df["attachment"].isna() | (df["attachment"] == "")]
elif attachment_status == "Has attachment":
    df = df[df["attachment"].notna() & (df["attachment"] != "")]

df = df.reset_index(drop=True)

if df.empty:
    st.info("No expenses match these filters.")
    st.stop()

st.caption(f"{len(df)} rows — click a row below to select it")

event = st.dataframe(
    df,
    use_container_width=True,
    hide_index=True,
    on_select="rerun",
    selection_mode="single-row",
)

selected_positions = event.selection.rows if event and event.selection else []

if not selected_positions:
    st.info("Select a row in the table above to attach a document to it.")
    st.stop()

selected_row = df.iloc[selected_positions[0]]

st.divider()
st.subheader(f"Expense #{int(selected_row.id)} — {selected_row.date} — {selected_row.merchantName}")
st.write(f"Current attachment: `{selected_row.attachment or '(none)'}`")

uploaded_file = st.file_uploader("Choose a document", type=None)

if st.button("Upload and attach", type="primary", disabled=uploaded_file is None):
    relative_path = db.save_uploaded_file(uploaded_file, int(selected_row.id), category="expense")
    db.update_expense_attachment(int(selected_row.id), relative_path)
    st.success(f"Attached `{relative_path}` to expense #{int(selected_row.id)}.")
    st.rerun()
