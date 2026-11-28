import json, pathlib, shutil, subprocess, sys, tempfile, unittest

HERE = pathlib.Path(__file__).resolve().parent.parent
BUILD = HERE / "build.py"


def run(src, out):
    return subprocess.run([sys.executable, str(BUILD), str(src), str(out)], capture_output=True, text=True)


class BuildTest(unittest.TestCase):
    def setUp(self):
        self.tmp = pathlib.Path(tempfile.mkdtemp())
        self.src = self.tmp / "src"
        shutil.copytree(HERE / "example", self.src)

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def test_builds_page_and_copies_report(self):
        r = run(self.src, self.tmp / "out")
        self.assertEqual(r.returncode, 0, r.stderr)
        page = (self.tmp / "out" / "index.html").read_text(encoding="utf-8")
        self.assertIn("Ratings by piece", page)
        self.assertIn("7.5/100 mots", page)  # 12 errors in 160 words
        self.assertTrue((self.tmp / "out" / "reports" / "sample.html").is_file())

    def test_report_without_scorecard_is_listed(self):
        (self.src / "sample.json").unlink()
        (self.src / "2026-12-amis.html").write_text("<title>Mes amis</title><p>x</p>", encoding="utf-8")
        r = run(self.src, self.tmp / "out")
        self.assertEqual(r.returncode, 0, r.stderr)
        page = (self.tmp / "out" / "index.html").read_text(encoding="utf-8")
        self.assertIn("Mes amis", page)
        self.assertIn("déc. 2026", page)
        self.assertNotIn("Ratings by piece", page)

    def test_refuses_unknown_category(self):
        card = json.loads((self.src / "sample.json").read_text(encoding="utf-8"))
        card["errors"]["grammer"] = 1
        (self.src / "sample.json").write_text(json.dumps(card), encoding="utf-8")
        r = run(self.src, self.tmp / "out")
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("unknown error category 'grammer'", r.stderr)

    def test_refuses_missing_report(self):
        (self.src / "sample.html").rename(self.src / "other.html")
        r = run(self.src, self.tmp / "out")
        self.assertIn("report file sample.html not found", r.stderr)


if __name__ == "__main__":
    unittest.main()
