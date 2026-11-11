"""Account management (no self sign-up).

    uv run python -m app.cli create-user grace --role student [--display-name Grace]
    uv run python -m app.cli set-password grace
    uv run python -m app.cli list-users

Only a display name and learning records are stored for children: no age, school or e-mail.
"""
import argparse
import getpass
import sys

from sqlalchemy import text

from .auth import hash_password
from .db import get_engine


def _ask_password() -> str:
    pw = getpass.getpass("Mot de passe : ")
    if len(pw) < 6:
        sys.exit("Au moins 6 caractères.")
    if getpass.getpass("Encore une fois : ") != pw:
        sys.exit("Les deux mots de passe ne correspondent pas.")
    return pw


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(prog="python -m app.cli", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("create-user")
    p.add_argument("username")
    p.add_argument("--role", choices=["student", "parent", "admin"], default="student")
    p.add_argument("--display-name")
    p.add_argument("--password", help="non-interactive (avoid: ends up in shell history)")
    p = sub.add_parser("set-password")
    p.add_argument("username")
    p.add_argument("--password")
    sub.add_parser("list-users")
    a = ap.parse_args(argv)

    with get_engine().begin() as c:
        if a.cmd == "create-user":
            username = a.username.strip().lower()
            if c.execute(text("SELECT 1 FROM lecture.app_user WHERE username=:u"), {"u": username}).first():
                sys.exit(f"{username} existe déjà")
            pw = a.password or _ask_password()
            c.execute(text("""INSERT INTO lecture.app_user (username, display_name, password_hash, role)
                VALUES (:u, :d, :h, :r)"""), {"u": username, "d": a.display_name or a.username.capitalize(),
                                             "h": hash_password(pw), "r": a.role})
            print(f"créé : {username} ({a.role})")
        elif a.cmd == "set-password":
            pw = a.password or _ask_password()
            n = c.execute(text("UPDATE lecture.app_user SET password_hash=:h WHERE username=:u"),
                          {"h": hash_password(pw), "u": a.username.strip().lower()}).rowcount
            print("mot de passe changé" if n else "utilisateur inconnu")
        else:
            for r in c.execute(text("SELECT username, display_name, role, created_at FROM lecture.app_user ORDER BY id")):
                print(f"{r.username:<16} {r.display_name:<16} {r.role:<8} {r.created_at:%Y-%m-%d}")


if __name__ == "__main__":
    main()
