import json
import os
import sys
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import auth


class TestHashPassword:
    def test_same_input_produces_same_hash(self):
        assert auth.hash_password("alice", "secret") == auth.hash_password("alice", "secret")

    def test_different_username_changes_hash(self):
        assert auth.hash_password("alice", "secret") != auth.hash_password("bob", "secret")

    def test_does_not_store_plaintext(self):
        assert "secret" not in auth.hash_password("alice", "secret")


class TestVerifyLogin:
    def _write_users(self, tmp_path, users):
        path = tmp_path / "users.json"
        path.write_text(json.dumps(users))
        return str(path)

    def test_valid_credentials_return_role(self, tmp_path):
        users = [{"username": "alice", "password_hash": auth.hash_password("alice", "secret"), "role": "admin"}]
        users_file = self._write_users(tmp_path, users)
        with patch.object(auth, "USERS_FILE", users_file):
            assert auth.verify_login("alice", "secret") == "admin"

    def test_wrong_password_returns_none(self, tmp_path):
        users = [{"username": "alice", "password_hash": auth.hash_password("alice", "secret"), "role": "admin"}]
        users_file = self._write_users(tmp_path, users)
        with patch.object(auth, "USERS_FILE", users_file):
            assert auth.verify_login("alice", "wrong") is None

    def test_unknown_user_returns_none(self, tmp_path):
        users_file = self._write_users(tmp_path, [])
        with patch.object(auth, "USERS_FILE", users_file):
            assert auth.verify_login("nobody", "secret") is None

    def test_missing_users_file_returns_none(self, tmp_path):
        with patch.object(auth, "USERS_FILE", str(tmp_path / "does_not_exist.json")):
            assert auth.verify_login("alice", "secret") is None

    def test_empty_credentials_return_none(self):
        assert auth.verify_login("", "") is None
