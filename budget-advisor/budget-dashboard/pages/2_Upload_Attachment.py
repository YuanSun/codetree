from datetime import date, timedelta

import streamlit as st
from dotenv import load_dotenv

import db

load_dotenv()

st.set_page_config(page_title="Upload Attachment", page_icon="\U0001F4CE", layout="wide")
st.title("Upload Attachment")

st.markdown("Attach a receipt/document to an existing **expense** row.")
st.caption(
    "Note: income rows have no attachment column in family_budget.Incomes today, "
    "so only expenses are supported here."
)

col1, col2, col3 = st.columns(3)
with col1:
    start_date = st.date_input("Start date", value=date.today() - timedelta(days=30))
with col2:
    end_date = st.date_input("End date", value=date.today())
with col3:
    name_search = st.text_input("Merchant name contains")

filters = {"start_date": start_date, "end_date": end_date, "name_search": name_search or None}
df = db.fetch_expenses(filters)

if df.empty:
    st.info("No expenses match these filters.")
    st.stop()

df = df.reset_index(drop=True)
options = {
    idx: f"#{row.id} — {row.date} — {row.merchantName} — {row.expense_numeric:,.2f}"
    + (f" — has attachment: {row.attachment}" if row.attachment else "")
    for idx, row in df.iterrows()
}

selected_idx = st.selectbox(
    "Select a row",
    options=list(options.keys()),
    format_func=lambda idx: options[idx],
)
selected_row = df.loc[selected_idx]

st.write(f"Current attachment: `{selected_row.attachment or '(none)'}`")

uploaded_file = st.file_uploader("Choose a document", type=None)

if st.button("Upload and attach", type="primary", disabled=uploaded_file is None):
    relative_path = db.save_uploaded_file(uploaded_file, int(selected_row.id), category="expense")
    db.update_expense_attachment(int(selected_row.id), relative_path)
    st.success(f"Attached `{relative_path}` to expense #{int(selected_row.id)}.")
    st.rerun()
