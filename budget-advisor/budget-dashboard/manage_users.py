"""
CLI to add/update/remove users in the local users.json file used by auth.py.

Usage:
    python manage_users.py add <username> <role: admin|user>
    python manage_users.py remove <username>
    python manage_users.py list
"""

import getpass
import json
import sys

from auth import USERS_FILE, hash_password, load_users


def save_users(users: list[dict]) -> None:
    with open(USERS_FILE, "w") as f:
        json.dump(users, f, indent=2)


def add_user(username: str, role: str) -> None:
    if role not in ("admin", "user"):
        print(f"Invalid role '{role}'. Must be 'admin' or 'user'.")
        sys.exit(1)

    password = getpass.getpass(f"Password for {username}: ")
    if not password:
        print("Password cannot be empty.")
        sys.exit(1)

    users = [u for u in load_users() if u.get("username") != username]
    users.append({"username": username, "password_hash": hash_password(username, password), "role": role})
    save_users(users)
    print(f"Saved user '{username}' with role '{role}' to {USERS_FILE}")


def remove_user(username: str) -> None:
    users = [u for u in load_users() if u.get("username") != username]
    save_users(users)
    print(f"Removed '{username}' (if present) from {USERS_FILE}")


def list_users() -> None:
    for user in load_users():
        print(f"{user.get('username')}: {user.get('role')}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1]
    if command == "add" and len(sys.argv) == 4:
        add_user(sys.argv[2], sys.argv[3])
    elif command == "remove" and len(sys.argv) == 3:
        remove_user(sys.argv[2])
    elif command == "list":
        list_users()
    else:
        print(__doc__)
        sys.exit(1)
