"""Server + content tests. Run:  python3 -m unittest discover -s tests   (from MathCompetition/)"""

import json
import sys
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import server  # noqa: E402
import weekctl  # noqa: E402


class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.base = f"http://127.0.0.1:{cls.httpd.server_address[1]}"
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()

    def get(self, path):
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, *a, **k):
                return None

        opener = urllib.request.build_opener(NoRedirect)
        try:
            with opener.open(self.base + path) as r:
                return r.status, r.read().decode("utf-8", "replace"), r.headers
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode("utf-8", "replace"), e.headers

    def test_home_lists_weeks(self):
        status, body, _ = self.get("/")
        self.assertEqual(status, 200)
        self.assertIn("Rates, Ratio, Percent &amp; Mean", body)

    def test_week_pages(self):
        for path in ("/week/week08/", "/week/week08/lesson", "/week/week08/practice", "/week/week08/homework"):
            with self.subTest(path=path):
                self.assertEqual(self.get(path)[0], 200)

    def test_week_without_trailing_slash_redirects(self):
        status, _, headers = self.get("/week/week08")
        self.assertEqual(status, 301)
        self.assertEqual(headers["Location"], "/week/week08/")

    def test_quiz_page_embeds_data_safely(self):
        _, body, _ = self.get("/week/week08/practice")
        self.assertIn('id="quiz-data"', body)
        self.assertNotIn("</script><", body.replace('</script>\n<script>MC.quiz', ""))

    def test_api(self):
        status, body, _ = self.get("/api/weeks")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)[0]["id"], "week08")

    def test_static_and_week_files(self):
        for path in ("/static/css/base.css", "/static/js/core.js", "/week/week08/lesson.js", "/week/week08/figures.js"):
            with self.subTest(path=path):
                self.assertEqual(self.get(path)[0], 200)

    def test_unknown_is_404(self):
        for path in ("/nope", "/week/nope/", "/week/week08/nothing"):
            with self.subTest(path=path):
                self.assertEqual(self.get(path)[0], 404)

    def test_no_path_traversal_and_no_source_leak(self):
        for path in ("/static/../server.py", "/static/%2e%2e/server.py", "/week/week08/%2e%2e/%2e%2e/server.py",
                     "/week/week08/..%2f..%2fserver.py", "/week/week08/lesson.py", "/static/js/../../weekctl.py"):
            with self.subTest(path=path):
                status, body, _ = self.get(path)
                self.assertEqual(status, 404)
                self.assertNotIn("ThreadingHTTPServer", body)


class ContentTests(unittest.TestCase):
    def test_every_week_passes_weekctl_check(self):
        for folder in sorted(p for p in (ROOT / "weeks").iterdir() if p.is_dir()):
            with self.subTest(week=folder.name):
                self.assertEqual(weekctl.check_week(folder), [])

    def test_checker_catches_bad_answer_index(self):
        bad = {"questions": [{"id": "q", "text": "t", "choices": ["a", "b"], "answer": 5, "difficulty": "easy", "hints": ["h"], "solution": ["s"]}]}
        tmp = ROOT / "tests" / "_bad_quiz.json"
        tmp.write_text(json.dumps(bad))
        try:
            errs = weekctl.check_quiz("w", "p", tmp)
        finally:
            tmp.unlink()
        self.assertTrue(any("answer" in e for e in errs))


if __name__ == "__main__":
    unittest.main()
