"""Accounts tests. The pure ones always run; the Postgres ones need a scratch database:

    createdb mathlab_test
    MATHLAB_TEST_URL=postgresql://you@localhost/mathlab_test python3 -m unittest discover -s tests

(the URL's database name must contain "test": the tests wipe the mathlab tables there).
"""

import json
import os
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import accounts  # noqa: E402
import server  # noqa: E402

TEST_URL = os.environ.get("MATHLAB_TEST_URL", "")


class PureTests(unittest.TestCase):
    def setUp(self):
        self._env = dict(os.environ)
        os.environ["SESSION_SECRET"] = "unit-test-secret"

    def tearDown(self):
        os.environ.clear()
        os.environ.update(self._env)

    @unittest.skipUnless(accounts.PasswordHasher, "argon2-cffi not installed")
    def test_verifies_lecture_magique_argon2_hashes(self):
        from argon2 import PasswordHasher
        h = PasswordHasher().hash("correct horse")          # what Lecture Magique stores
        self.assertTrue(accounts.verify_password(h, "correct horse"))
        self.assertFalse(accounts.verify_password(h, "wrong"))
        self.assertFalse(accounts.verify_password("garbage", "x"))
        self.assertFalse(accounts.verify_password("scrypt$1$2$3$a$b", "x"))

    def test_role_mapping(self):
        self.assertEqual({r: accounts.ROLE_MAP[r] for r in ("student", "parent", "admin")},
                         {"student": "child", "parent": "parent", "admin": "parent"})

    def test_users_table_must_look_like_schema_table(self):
        os.environ["USERS_TABLE"] = "lecture.app_user; drop table x"
        with self.assertRaises(RuntimeError):
            accounts.users_table()
        os.environ.pop("USERS_TABLE")
        self.assertEqual(accounts.users_table(), "lecture.app_user")

    def test_token_roundtrip_and_tamper(self):
        t = accounts.make_token(7, "somehashvalue123456")
        self.assertEqual(accounts.read_token(t), (7, accounts._pv("somehashvalue123456")))
        payload, sig = t.split(".")
        self.assertIsNone(accounts.read_token(payload + "." + sig[:-2] + "xx"))
        self.assertIsNone(accounts.read_token("nonsense"))
        self.assertIsNone(accounts.read_token(accounts.make_token(7, "h", days=-1)))   # expired
        os.environ["SESSION_SECRET"] = "another-secret"
        self.assertIsNone(accounts.read_token(t))

    def test_lockout(self):
        lock = accounts.Lockout()
        for _ in range(accounts.MAX_FAILS):
            self.assertEqual(lock.locked_for("kid"), 0)
            lock.fail("kid")
        self.assertGreater(lock.locked_for("kid"), 0)
        lock.success("kid")
        self.assertEqual(lock.locked_for("kid"), 0)

    def test_dotenv(self):
        with tempfile.TemporaryDirectory() as d:
            f = Path(d) / ".env"
            f.write_text('# c\nMC_T1=plain\nMC_T2="quoted value"  # note\nMC_T3=a=b\nSESSION_SECRET=ignored\n')
            accounts.load_dotenv(f)
            self.assertEqual(os.environ["MC_T1"], "plain")
            self.assertEqual(os.environ["MC_T2"], "quoted value")
            self.assertEqual(os.environ["MC_T3"], "a=b")
            self.assertEqual(os.environ["SESSION_SECRET"], "unit-test-secret")   # existing variables win
        for k in ("MC_T1", "MC_T2", "MC_T3"):
            os.environ.pop(k, None)

    def test_conninfo_accepts_sqlalchemy_urls(self):
        self.assertEqual(accounts._conninfo("postgresql+psycopg://u:p@h:5432/db"), "postgresql://u:p@h:5432/db")
        self.assertEqual(accounts._conninfo("postgresql://u@h/db"), "postgresql://u@h/db")

    def test_input_validation(self):
        with self.assertRaises(ValueError):
            accounts._key("a/b", "p", "i")
        with self.assertRaises(ValueError):
            accounts._clean_item({"x": "y" * 5000})
        with self.assertRaises(ValueError):
            accounts._xp(-1)
        with self.assertRaises(ValueError):
            accounts._xp(True)

    def test_safe_next_blocks_open_redirects(self):
        for bad in ("//evil.com", "https://evil.com", "javascript:alert(1)", "/\\evil.com", ""):
            self.assertEqual(server.safe_next(bad), "/")
        self.assertEqual(server.safe_next("/week/week08/practice"), "/week/week08/practice")


class DisabledServerTests(unittest.TestCase):
    """No DATABASE_URL: the site works exactly as before and says so."""

    @classmethod
    def setUpClass(cls):
        cls._env = dict(os.environ)
        for k in ("DATABASE_URL", "SESSION_SECRET"):
            os.environ.pop(k, None)
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.base = f"http://127.0.0.1:{cls.httpd.server_address[1]}"
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        os.environ.clear()
        os.environ.update(cls._env)

    def test_session_js_says_disabled(self):
        with urllib.request.urlopen(self.base + "/api/session.js") as r:
            body = r.read().decode()
        self.assertIn('"enabled": false', body)
        self.assertIn('"user": null', body)

    def test_account_endpoints_404(self):
        for path in ("/api/progress", "/api/parent/overview"):
            with self.assertRaises(urllib.error.HTTPError) as cm:
                urllib.request.urlopen(self.base + path)
            self.assertEqual(cm.exception.code, 404)

    def test_pages_load_session_script_first(self):
        for path in ("/week/week08/lesson", "/week/week08/practice", "/"):
            with urllib.request.urlopen(self.base + path) as r:
                body = r.read().decode()
            self.assertLess(body.index("/api/session.js"), body.index("/static/js/core.js"), path)


@unittest.skipUnless(accounts.psycopg and accounts.PasswordHasher and TEST_URL and "test" in urlparse(TEST_URL).path,
                     "set MATHLAB_TEST_URL to a scratch database whose name contains 'test'")
class DatabaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._env = dict(os.environ)
        os.environ.update(DATABASE_URL=TEST_URL, SESSION_SECRET="unit-test-secret")
        accounts.migrate(TEST_URL)
        from argon2 import PasswordHasher
        ph = PasswordHasher()
        with accounts.connect(TEST_URL) as c:            # a stand-in for Lecture Magique's profiles table
            c.execute("CREATE SCHEMA IF NOT EXISTS lecture")
            c.execute("CREATE TABLE IF NOT EXISTS lecture.app_user (id bigserial PRIMARY KEY, username text UNIQUE NOT NULL, "
                      "display_name text NOT NULL, password_hash text NOT NULL, role text NOT NULL, settings jsonb DEFAULT '{}')")
            c.execute("TRUNCATE mathlab.progress, mathlab.profile, lecture.app_user RESTART IDENTITY CASCADE")
            for name, pw, role, display in (("kid", "kidpass1", "student", "Kid"), ("kid2", "kidpass2", "student", "Kid Two"),
                                            ("mom", "mompass1", "parent", "Mom"), ("boss", "bosspass1", "admin", "Boss")):
                c.execute("INSERT INTO lecture.app_user (username, display_name, password_hash, role) VALUES (%s,%s,%s,%s)",
                          (name, display, ph.hash(pw), role))
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.base = f"http://127.0.0.1:{cls.httpd.server_address[1]}"
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        os.environ.clear()
        os.environ.update(cls._env)

    def call(self, method, path, body=None, cookie=None, ctype="application/json"):
        req = urllib.request.Request(self.base + path, method=method,
                                     data=None if body is None else (json.dumps(body).encode() if ctype == "application/json" else body))
        if body is not None:
            req.add_header("Content-Type", ctype)
        if cookie:
            req.add_header("Cookie", cookie)
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, json.loads(r.read() or b"null"), r.headers
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read() or b"null"), e.headers

    def sign_in(self, user, pw):
        status, data, headers = self.call("POST", "/api/login", {"username": user, "password": pw})
        self.assertEqual(status, 200, data)
        return headers["Set-Cookie"].split(";")[0], data

    def test_login_progress_and_roles(self):
        # wrong password, and non-JSON bodies, are refused
        self.assertEqual(self.call("POST", "/api/login", {"username": "kid", "password": "nope"})[0], 401)
        self.assertEqual(self.call("POST", "/api/login", b"username=kid", ctype="application/x-www-form-urlencoded")[0], 400)
        cookie, data = self.sign_in("Kid", "kidpass1")          # usernames are case-insensitive
        self.assertTrue(data["empty"])
        self.assertEqual(data["user"]["role"], "child")                  # Lecture's "student"

        # saving: set, delete, xp never goes down
        item = {"done": 1, "stars": 2, "hints": 3, "attempts": 4}
        self.assertEqual(self.call("PUT", "/api/progress", {"set": [["week08", "practice", "ex01", item]], "xp": 40}, cookie)[0], 200)
        self.assertEqual(self.call("PUT", "/api/progress", {"set": [["week08", "practice", "ex02", {"done": 1}]], "xp": 10}, cookie)[0], 200)
        _, state, _ = self.call("GET", "/api/progress", cookie=cookie)
        self.assertEqual(state["xp"], 40)
        self.assertEqual(state["weeks"]["week08"]["practice"]["ex01"], item)
        self.call("PUT", "/api/progress", {"del": [["week08", "practice", "ex02"]]}, cookie)
        _, state, _ = self.call("GET", "/api/progress", cookie=cookie)
        self.assertNotIn("ex02", state["weeks"]["week08"]["practice"])
        self.assertEqual(self.call("PUT", "/api/progress", {"set": [["../x", "p", "i", {}]]}, cookie)[0], 400)

        # the page-load script carries the same state
        req = urllib.request.Request(self.base + "/api/session.js", headers={"Cookie": cookie})
        with urllib.request.urlopen(req) as r:
            self.assertIn('"ex01"', r.read().decode())

        # profiles are separate
        cookie2, data2 = self.sign_in("kid2", "kidpass2")
        self.assertTrue(data2["empty"])
        self.assertEqual(self.call("GET", "/api/progress", cookie=cookie2)[1]["xp"], 0)

        # signed out / tampered cookie
        self.assertEqual(self.call("GET", "/api/progress")[0], 401)
        self.assertEqual(self.call("PUT", "/api/progress", {"xp": 5})[0], 401)
        self.assertEqual(self.call("GET", "/api/progress", cookie="mc_session=abc.def")[0], 401)

        # import keeps existing rows and adds missing ones
        imp = {"xp": 100, "weeks": {"week08": {"practice": {"ex01": {"done": 1, "stars": 3}, "ex05": {"done": 1}}}}}
        self.assertEqual(self.call("POST", "/api/progress/import", imp, cookie)[1]["added"], 1)
        _, state, _ = self.call("GET", "/api/progress", cookie=cookie)
        self.assertEqual(state["weeks"]["week08"]["practice"]["ex01"]["stars"], 2)     # not overwritten
        self.assertEqual(state["xp"], 100)

    def test_parent_view(self):
        kid, _ = self.sign_in("kid", "kidpass1")
        self.call("PUT", "/api/progress", {"set": [["week08", "practice", "ex09", {"done": 1, "stars": 1, "hints": 3}]], "xp": 20}, kid)
        self.assertEqual(self.call("GET", "/api/parent/overview", cookie=kid)[0], 403)      # a child cannot
        self.assertEqual(self.call("GET", "/api/parent/overview")[0], 401)
        mom, data = self.sign_in("mom", "mompass1")
        _, overview, _ = self.call("GET", "/api/parent/overview", cookie=mom)
        names = {c["username"]: c for c in overview["children"]}
        self.assertEqual(set(names), {"kid", "kid2"})                                        # students only, no parents/admin
        self.assertGreaterEqual(names["kid"]["done"], 1)
        _, detail, _ = self.call("GET", f"/api/parent/child/{names['kid']['id']}", cookie=mom)
        self.assertTrue(any(i["item"] == "ex09" for i in detail["items"]))
        parent_id = self.call("POST", "/api/login", {"username": "mom", "password": "mompass1"})[1]["user"]["id"]
        self.assertEqual(self.call("GET", f"/api/parent/child/{parent_id}", cookie=mom)[0], 404)   # not a child

    def test_admin_counts_as_parent(self):
        cookie, data = self.sign_in("boss", "bosspass1")
        self.assertEqual(data["user"]["role"], "parent")
        self.assertEqual(self.call("GET", "/api/parent/overview", cookie=cookie)[0], 200)

    def test_password_change_signs_out(self):
        from argon2 import PasswordHasher
        cookie, _ = self.sign_in("kid2", "kidpass2")
        self.assertEqual(self.call("GET", "/api/progress", cookie=cookie)[0], 200)
        with accounts.connect(TEST_URL) as c:     # a password change made in Lecture Magique signs out here too
            c.execute("UPDATE lecture.app_user SET password_hash=%s WHERE username='kid2'", (PasswordHasher().hash("newpass22"),))
        self.assertEqual(self.call("GET", "/api/progress", cookie=cookie)[0], 401)
        self.assertEqual(self.sign_in("kid2", "newpass22")[1]["user"]["username"], "kid2")


if __name__ == "__main__":
    unittest.main()
