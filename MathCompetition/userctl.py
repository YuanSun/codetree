#!/usr/bin/env python3
"""Set up and inspect MathCompetition's database part.

    python3 userctl.py migrate       # create/upgrade the mathlab tables and grants (run as the admin role)
    python3 userctl.py list-users    # the profiles that can sign in (they are Lecture Magique's)

There is no create-user here on purpose: children and parents are Lecture Magique profiles, shared by both sites.
Create or change them with its CLI, e.g.  cd lecture-magique/backend && uv run python -m app.cli create-user grace --role student

Settings come from MathCompetition/.env (see .env.example).
"""

from __future__ import annotations

import argparse
import sys

import accounts


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("migrate")
    sub.add_parser("list-users")
    a = ap.parse_args(argv)

    if accounts.psycopg is None:
        sys.exit("psycopg is not installed:  pip install -r requirements.txt")
    need = accounts.admin_url() if a.cmd == "migrate" else accounts.database_url()
    if not need:
        sys.exit("DATABASE_ADMIN_URL / DATABASE_URL is not set (see .env.example)")
    try:
        if a.cmd == "migrate":
            done = accounts.migrate()
            print("applied: " + ", ".join(done) if done else "already up to date")
        else:
            for username, name, role in accounts.list_users():
                print(f"{username:<16} {name:<16} {role:<8} -> {accounts.ROLE_MAP.get(role, 'child')}")
    except Exception as exc:  # database down, wrong password…
        sys.exit(f"database error: {exc}")


if __name__ == "__main__":
    main()
