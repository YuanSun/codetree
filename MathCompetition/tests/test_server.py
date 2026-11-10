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

    def test_standalone_page_gets_back_links(self):
        status, body, _ = self.get("/week/week07/detective")
        self.assertEqual(status, 200)
        self.assertIn("<title>Math Detective", body)
        self.assertIn('class="mc-back"', body)
        self.assertIn('href="/week/week07/"', body)
        self.assertEqual(body.count("</body>"), 1)
        # regular html pages are untouched
        self.assertNotIn("mc-back", self.get("/week/week08/lesson")[1])

    def test_study_track_is_separate_from_the_contest_lab(self):
        status, home, _ = self.get("/")
        self.assertEqual(status, 200)
        self.assertNotIn("/study/sem0", home)           # study units never show up in the contest list
        self.assertIn('href="/study/"', home)           # ...but the switcher links to them
        status, study, _ = self.get("/study/")
        self.assertEqual(status, 200)
        self.assertIn('data-track="study"', study)
        for unit in ("sem0506", "sem06", "sem05"):
            self.assertIn(f'href="/study/{unit}/"', study)
        self.assertNotIn("/week/week0", study)
        self.assertEqual([w["id"] for w in json.loads(self.get("/api/study")[1])], ["sem0506", "sem06", "sem05"])

    def test_study_pages(self):
        for path in ("/study/sem05/", "/study/sem05/lesson", "/study/sem05/practice", "/study/sem06/lesson", "/study/sem06/practice",
                     "/study/sem0506/", "/study/sem0506/parcours", "/study/sem05/lesson.js"):
            with self.subTest(path=path):
                self.assertEqual(self.get(path)[0], 200)
        status, body, _ = self.get("/study/sem05/practice")
        self.assertIn('data-track="study"', body)
        self.assertIn('data-week="sem05"', body)
        _, page, _ = self.get("/study/sem0506/parcours")
        self.assertIn('href="/study/"', page)
        self.assertIn('href="/study/sem0506/"', page)
        self.assertIn("Parcours d'étude", page)
        self.assertEqual(self.get("/study/sem99/")[0], 404)

    def test_study_redirects(self):
        status, _, headers = self.get("/study")
        self.assertEqual((status, headers["Location"]), (301, "/study/"))
        status, _, headers = self.get("/study/sem05")
        self.assertEqual((status, headers["Location"]), (301, "/study/sem05/"))

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
        for folder in sorted(p for root in ("weeks", "study") for p in (ROOT / root).iterdir() if p.is_dir()):
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


class BasePathTests(unittest.TestCase):
    """When a gateway mounts the site under /math, every generated link must carry the prefix."""

    @classmethod
    def setUpClass(cls):
        server.set_base_path("/math/")
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.base = f"http://127.0.0.1:{cls.httpd.server_address[1]}"
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        server.set_base_path("")

    def get(self, path):
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, *a, **k):
                return None

        try:
            with urllib.request.build_opener(NoRedirect).open(self.base + path) as r:
                return r.status, r.read().decode("utf-8", "replace"), r.headers
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode("utf-8", "replace"), e.headers

    def test_generated_pages_are_prefixed(self):
        for path in ("/", "/week/week08/", "/week/week08/practice", "/week/week08/lesson", "/nope"):
            with self.subTest(path=path):
                _, body, _ = self.get(path)
                self.assertNotRegex(body, r'(?:href|src)="/(?!math/|/)', "unprefixed absolute link")
        self.assertIn('href="/math/static/css/base.css"', self.get("/")[1])
        self.assertIn('href="/math/week/week08/"', self.get("/")[1])

    def test_study_links_are_prefixed(self):
        for path in ("/study/", "/study/sem05/", "/study/sem0506/parcours"):
            with self.subTest(path=path):
                status, body, _ = self.get(path)
                self.assertEqual(status, 200)
                self.assertNotRegex(body, r'(?:href|src)="/(?!math/|/)')
        self.assertIn('href="/math/study/sem05/"', self.get("/study/")[1])
        self.assertIn('href="/math/study/"', self.get("/study/sem0506/parcours")[1])

    def test_redirect_is_prefixed(self):
        self.assertEqual(self.get("/week/week08")[2]["Location"], "/math/week/week08/")
