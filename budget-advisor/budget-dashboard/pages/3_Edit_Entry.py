from datetime import date, timedelta

import streamlit as st
from dotenv import load_dotenv

import auth
import db

load_dotenv()

st.set_page_config(page_title="Edit Entry", page_icon="\U0000270F", layout="wide")
role = auth.render_login_sidebar()
st.title("Edit Entry")

st.markdown("Modify an existing **expense** row's date, amount, or comment.")
st.caption(
    "Merchant, category, and location live in shared lookup tables used by other rows too, "
    "so they aren't editable here."
)

if role != "admin":
    st.warning("Only admin users can edit entries. Log in as an admin in the sidebar to unlock editing.")

col1, col2, col3 = st.columns(3)
with col1:
    start_date = st.date_input("Start date", value=date.today() - timedelta(days=30))
with col2:
    end_date = st.date_input("End date", value=date.today())
with col3:
    name_search = st.text_input("Merchant name contains")

filters = {"start_date": start_date, "end_date": end_date, "name_search": name_search or None}
df = db.fetch_expenses(filters)
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
    st.info("Select a row in the table above to edit it.")
    st.stop()

selected_row = df.iloc[selected_positions[0]]

st.divider()
st.subheader(f"Expense #{int(selected_row.id)} — {selected_row.merchantName}")

with st.form("edit_entry_form"):
    new_date = st.date_input("Date", value=selected_row.date)
    new_amount = st.number_input("Amount", value=float(selected_row.expense_numeric), step=1.0)
    new_comment = st.text_area("Comment", value=selected_row.comment or "")
    submitted = st.form_submit_button("Save changes", type="primary", disabled=role != "admin")

if submitted:
    db.update_expense_fields(int(selected_row.id), new_date, new_amount, new_comment)
    st.success(f"Updated expense #{int(selected_row.id)}.")
    st.rerun()
