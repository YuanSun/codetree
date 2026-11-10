#!/usr/bin/env python3
"""Helper for adding and checking weeks.

    python3 weekctl.py new 9 "Geometry & Angles"     # scaffold weeks/week09/        (Math Contest Lab)
    python3 weekctl.py new 7 "Decimals" --study       # scaffold study/sem07/         (School Study)
    python3 weekctl.py check                          # validate every unit in both tracks
    python3 weekctl.py check week08                   # validate one unit (also: sem05)

`check` catches the mistakes that would otherwise show up as a broken page in front
of the kid: an answer index outside the choices, duplicate question ids, a skill that
has no tab, a missing file, a trap message pointing at a choice that doesn't exist...
Exit code is 1 when anything is wrong, so it also works in CI.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
WEEKS = ROOT / "weeks"          # contest track  -> /week/<id>/
STUDY = ROOT / "study"          # study track    -> /study/<id>/
DIFFICULTIES = {"easy", "medium", "medium-hard", "hard"}


# ----------------------------------------------------------------------------- check
def check_week(folder: Path) -> list[str]:
    errs: list[str] = []
    err = lambda msg: errs.append(f"{folder.name}: {msg}")  # noqa: E731
    meta_file = folder / "week.json"
    if not meta_file.is_file():
        return [f"{folder.name}: missing week.json"]
    try:
        meta = json.loads(meta_file.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return [f"{folder.name}: week.json is not valid JSON ({exc})"]

    for key in ("number", "title", "pages"):
        if key not in meta:
            err(f"week.json is missing '{key}'")
    slugs: set[str] = set()
    for page in meta.get("pages", []):
        slug = page.get("slug")
        if not slug or not re.fullmatch(r"[a-z0-9_-]+", slug):
            err(f"page needs a url-safe 'slug' (got {slug!r})")
            continue
        if slug in slugs:
            err(f"duplicate page slug '{slug}'")
        slugs.add(slug)
        if page.get("type", "html") not in ("html", "quiz"):
            err(f"page '{slug}': type must be 'html' or 'quiz'")
        target = folder / page.get("file", "")
        if not target.is_file():
            err(f"page '{slug}': file '{page.get('file')}' not found")
            continue
        for script in page.get("scripts", []):
            if not (folder / script).is_file():
                err(f"page '{slug}': script '{script}' not found")
        if page.get("type") == "quiz":
            errs.extend(check_quiz(folder.name, slug, target))
        elif page.get("type", "html") == "html" and not page.get("tasks"):
            print(f"  note: {folder.name}/{slug} has no 'tasks' count, so its progress bar stays hidden")
    return errs


def check_quiz(week: str, slug: str, path: Path) -> list[str]:
    errs: list[str] = []
    err = lambda qid, msg: errs.append(f"{week}/{slug} [{qid}]: {msg}")  # noqa: E731
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return [f"{week}/{slug}: {path.name} is not valid JSON ({exc})"]
    groups = {g["id"] for g in data.get("groups", [])}
    seen: set[str] = set()
    for i, q in enumerate(data.get("questions", [])):
        qid = q.get("id", f"#{i + 1}")
        if qid in seen:
            err(qid, "duplicate id")
        seen.add(qid)
        for key in ("id", "text", "choices", "answer", "solution"):
            if key not in q:
                err(qid, f"missing '{key}'")
        n = len(q.get("choices", []))
        if not 2 <= n <= 5:
            err(qid, f"needs 2-5 choices (has {n})")
        if not isinstance(q.get("answer"), int) or not 0 <= q.get("answer", -1) < n:
            err(qid, f"'answer' must be a 0-based index into choices (got {q.get('answer')!r})")
        if q.get("difficulty") not in DIFFICULTIES:
            err(qid, f"difficulty must be one of {sorted(DIFFICULTIES)} (got {q.get('difficulty')!r})")
        if groups and q.get("skill") not in groups:
            err(qid, f"'skill' {q.get('skill')!r} has no matching group tab {sorted(groups)}")
        for k in q.get("traps", {}):
            if not k.isdigit() or int(k) >= n:
                err(qid, f"trap key {k!r} is not a valid choice index")
            elif int(k) == q.get("answer"):
                err(qid, f"trap key {k!r} is the CORRECT answer")
        if not q.get("hints"):
            err(qid, "no hints (the hint ladder is the point — aim for 3)")
        if not q.get("solution"):
            err(qid, "empty solution")
    return errs


# ------------------------------------------------------------------------------- new
LESSON_HTML = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>__LABEL__ · The Quest</title>
  <link rel="stylesheet" href="/static/css/base.css">
</head>
<body data-page="lesson"__TRACK__ data-week="__ID__" data-page-slug="lesson" data-week-title="__LABEL__">
<div id="mc-nav"></div>
<main class="wrap">
  <section class="hero"><div class="eyebrow">__LABEL__ · The Quest</div><h1>__TITLE__</h1></section>

  <section class="level">
    <div class="lab"><div class="lab-title">🧪 Lab 1</div>
      <div id="steps"></div>
    </div>
  </section>
</main>
<script src="/static/js/core.js"></script>
<script>
  // Replace with real labs. MC.guided = "you do each step" worked example (see weeks/week08/lesson.js).
  MC.guided(MC.$('#steps'), {
    week: '__ID__', page: 'lesson', id: 'lab1',
    steps: [{ q: 'What is 6 × 7?', type: 'number', answer: 42, ok: 'Yes — 42.' }],
  });
</script>
</body>
</html>
"""

QUIZ_JSON = {
    "eyebrow": "",
    "title": "",
    "intro": "",
    "groups": [{"id": "topic", "label": "Topic", "emoji": "📘", "color": "#3b82f6"}],
    "questions": [
        {
            "id": "ex01", "skill": "topic", "difficulty": "easy", "source": "Contest Year, Grade — Q#",
            "text": "Question text. Fractions: [[3/8]]. Bold: **word**. Italic: *x*.",
            "choices": ["A", "B", "C", "D", "E"], "answer": 0,
            "hints": ["Nudge: what is it really asking?", "Set-up.", "Almost everything."],
            "traps": {"1": "Why a kid would pick B — and why it is wrong."},
            "solution": ["Step 1.", "Step 2 → **(A)**."],
            "idea": "The one-line skill reminder.",
        }
    ],
}


def new_week(number: int, title: str, study: bool = False) -> None:
    wid = f"{'sem' if study else 'week'}{number:02d}"
    label = f"{'Sem' if study else 'Week'} {number}"
    folder = (STUDY if study else WEEKS) / wid
    if folder.exists():
        sys.exit(f"{folder} already exists")
    hw_title = f"Homework {label}"
    meta = {
        "number": number, "title": title, "tagline": "", "level": "School study" if study else "G6–G7 · Contest Prep", "emoji": "📘", "skills": [], "credit": "",
        "pages": [
            {"slug": "lesson", "type": "html", "file": "lesson.html", "title": "The Quest", "emoji": "🗺️", "desc": "", "tasks": 1},
            {"slug": "practice", "type": "quiz", "file": "exercises.json", "title": "Exercise Bank", "emoji": "🏋️", "desc": ""},
            {"slug": "homework", "type": "quiz", "file": "homework.json", "title": hw_title, "emoji": "📝", "desc": ""},
        ],
    }
    lesson = (LESSON_HTML.replace("__ID__", wid).replace("__LABEL__", label).replace("__TITLE__", title)
              .replace("__TRACK__", ' data-track="study"' if study else ""))
    if study:   # the study track's own look comes from body[data-track="study"] in base.css
        meta["pages"] = [p for p in meta["pages"] if p["slug"] != "homework"]
    files = {
        "week.json": json.dumps(meta, indent=2, ensure_ascii=False) + "\n",
        "lesson.html": lesson,
        "exercises.json": json.dumps(dict(QUIZ_JSON, eyebrow=label, title="Class Sheet" if study else "Exercise Bank"), indent=2, ensure_ascii=False) + "\n",
        "homework.json": json.dumps(dict(QUIZ_JSON, eyebrow=label, title=hw_title), indent=2, ensure_ascii=False) + "\n",
    }
    if study:
        del files["homework.json"]
    folder.mkdir(parents=True)   # everything is built in memory first, so a bug above can't leave a half-made week
    for name, content in files.items():
        (folder / name).write_text(content, encoding="utf-8")
    print(f"Created {folder.relative_to(ROOT.parent)} — edit week.json, then fill in the lesson & questions.")
    print("Then run:  python3 weekctl.py check " + wid)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    n = sub.add_parser("new", help="scaffold a new week")
    n.add_argument("number", type=int)
    n.add_argument("title")
    n.add_argument("--study", action="store_true", help="create it in the School Study track (study/semNN) instead of the contest lab")
    c = sub.add_parser("check", help="validate week content")
    c.add_argument("week", nargs="?", help="e.g. week08 or sem05 (default: every unit in both tracks)")
    args = ap.parse_args()

    if args.cmd == "new":
        new_week(args.number, args.title, args.study)
        return
    if args.week:
        folders = [r / args.week for r in (WEEKS, STUDY) if (r / args.week).is_dir()] or [WEEKS / args.week]
    else:
        folders = [p for r in (WEEKS, STUDY) if r.is_dir() for p in sorted(r.iterdir()) if p.is_dir()]
    problems: list[str] = []
    for f in folders:
        if not f.is_dir():
            problems.append(f"{f.name}: no such week")
            continue
        found = check_week(f)
        print(f"{'✗' if found else '✓'} {f.name}")
        problems.extend(found)
    for p in problems:
        print("  - " + p)
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
