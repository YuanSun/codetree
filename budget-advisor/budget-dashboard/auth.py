"""
Lightweight named-account login for gating admin-only actions (editing
entries). Not bank-grade security -- this is a personal/family tool run
locally -- but avoids storing or transmitting plaintext passwords.

Users are stored in a local JSON file (path from DASHBOARD_USERS_FILE,
default ./users.json), each entry: {"username", "password_hash", "role"}.
Manage entries with manage_users.py rather than editing the file by hand.
"""

import hashlib
import json
import os
from typing import Optional

import streamlit as st

_DEFAULT_USERS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "users.json")
USERS_FILE = os.getenv("DASHBOARD_USERS_FILE", _DEFAULT_USERS_FILE)


def hash_password(username: str, password: str) -> str:
    return hashlib.sha256(f"{username}:{password}".encode("utf-8")).hexdigest()


def load_users() -> list[dict]:
    if not os.path.exists(USERS_FILE):
        return []
    with open(USERS_FILE) as f:
        return json.load(f)


def verify_login(username: str, password: str) -> Optional[str]:
    """Return the user's role if credentials are valid, else None."""
    if not username or not password:
        return None
    expected_hash = hash_password(username, password)
    for user in load_users():
        if user.get("username") == username and user.get("password_hash") == expected_hash:
            return user.get("role", "user")
    return None


def render_login_sidebar() -> str:
    """
    Render a login/logout widget in the sidebar and return the current
    role ("admin" or "user"). Defaults to "user" when logged out.
    """
    if "username" not in st.session_state:
        st.session_state.username = None
        st.session_state.role = "user"

    with st.sidebar:
        st.divider()
        if st.session_state.username:
            st.caption(f"Logged in as **{st.session_state.username}** ({st.session_state.role})")
            if st.button("Log out"):
                st.session_state.username = None
                st.session_state.role = "user"
                st.rerun()
        else:
            st.caption("Logged out (view-only). Log in for admin actions.")
            with st.form("login_form", clear_on_submit=True):
                username = st.text_input("Username")
                password = st.text_input("Password", type="password")
                submitted = st.form_submit_button("Log in")
            if submitted:
                role = verify_login(username, password)
                if role:
                    st.session_state.username = username
                    st.session_state.role = role
                    st.rerun()
                else:
                    st.error("Invalid username or password")

    return st.session_state.role


def is_admin() -> bool:
    return st.session_state.get("role") == "admin"
