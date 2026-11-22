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

    def test_password_hash_roundtrip(self):
        h = accounts.hash_password("correct horse")
        self.assertTrue(h.startswith("scrypt$"))
        self.assertTrue(accounts.verify_password(h, "correct horse"))
        self.assertFalse(accounts.verify_password(h, "wrong"))
        self.assertNotEqual(h, accounts.hash_password("correct horse"))   # salted
        self.assertFalse(accounts.verify_password("garbage", "x"))

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


@unittest.skipUnless(accounts.psycopg and TEST_URL and "test" in urlparse(TEST_URL).path,
                     "set MATHLAB_TEST_URL to a scratch database whose name contains 'test'")
class DatabaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._env = dict(os.environ)
        os.environ.update(DATABASE_URL=TEST_URL, SESSION_SECRET="unit-test-secret")
        accounts.migrate(TEST_URL)
        with accounts.connect(TEST_URL) as c:
            c.execute("TRUNCATE mathlab.progress, mathlab.profile, mathlab.app_user RESTART IDENTITY CASCADE")
        accounts.create_user("kid", "kidpass1", "child", "Kid")
        accounts.create_user("kid2", "kidpass2", "child", "Kid Two")
        accounts.create_user("mom", "mompass1", "parent", "Mom")
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
        self.assertEqual(data["user"]["role"], "child")

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
        self.assertEqual(set(names), {"kid", "kid2"})                                        # children only, no parents
        self.assertGreaterEqual(names["kid"]["done"], 1)
        _, detail, _ = self.call("GET", f"/api/parent/child/{names['kid']['id']}", cookie=mom)
        self.assertTrue(any(i["item"] == "ex09" for i in detail["items"]))
        parent_id = self.call("POST", "/api/login", {"username": "mom", "password": "mompass1"})[1]["user"]["id"]
        self.assertEqual(self.call("GET", f"/api/parent/child/{parent_id}", cookie=mom)[0], 404)   # not a child

    def test_password_change_signs_out(self):
        accounts.create_user("temp", "temppass1", "child")
        cookie, _ = self.sign_in("temp", "temppass1")
        self.assertEqual(self.call("GET", "/api/progress", cookie=cookie)[0], 200)
        accounts.set_password("temp", "temppass2")
        self.assertEqual(self.call("GET", "/api/progress", cookie=cookie)[0], 401)


if __name__ == "__main__":
    unittest.main()
