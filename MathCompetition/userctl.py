#!/usr/bin/env python3
"""Manage MathCompetition accounts (no self sign-up — a parent creates the profiles).

    python3 userctl.py migrate                              # create/upgrade the mathlab tables (admin role)
    python3 userctl.py create-user grace --role child  [--display-name Grace]
    python3 userctl.py create-user dad   --role parent [--display-name Dad]
    python3 userctl.py set-password grace
    python3 userctl.py list-users

Settings come from MathCompetition/.env (see .env.example). Only a display name and learning records
are stored for a child: no age, school or e-mail.
"""

import argparse
import getpass
import sys

import accounts


def ask_password() -> str:
    pw = getpass.getpass("Password: ")
    if getpass.getpass("Again: ") != pw:
        sys.exit("The two passwords differ.")
    return pw


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("migrate")
    p = sub.add_parser("create-user")
    p.add_argument("username")
    p.add_argument("--role", choices=accounts.ROLES, default="child")
    p.add_argument("--display-name")
    p.add_argument("--password", help="non-interactive (avoid: ends up in shell history)")
    p = sub.add_parser("set-password")
    p.add_argument("username")
    p.add_argument("--password")
    sub.add_parser("list-users")
    a = ap.parse_args(argv)

    if accounts.psycopg is None:
        sys.exit("psycopg is not installed:  pip install 'psycopg[binary]'")
    need = accounts.admin_url() if a.cmd == "migrate" else accounts.database_url()
    if not need:
        sys.exit("DATABASE_ADMIN_URL / DATABASE_URL is not set (see .env.example)")
    try:
        if a.cmd == "migrate":
            done = accounts.migrate()
            print("applied: " + ", ".join(done) if done else "already up to date")
        elif a.cmd == "create-user":
            accounts.create_user(a.username, a.password or ask_password(), a.role, a.display_name)
            print(f"created {a.username.strip().lower()} ({a.role})")
        elif a.cmd == "set-password":
            print("password changed" if accounts.set_password(a.username, a.password or ask_password()) else "no such user")
        else:
            for username, name, role, created in accounts.list_users():
                print(f"{username:<16} {name:<16} {role:<7} {created:%Y-%m-%d}")
    except ValueError as exc:
        sys.exit(str(exc))
    except Exception as exc:  # database down, wrong password…
        sys.exit(f"database error: {exc}")


if __name__ == "__main__":
    main()
