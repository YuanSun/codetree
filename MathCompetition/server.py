#!/usr/bin/env python3
"""MathCompetition — a tiny dependency-free server for interactive contest-prep weeks.

    python3 server.py                  # http://127.0.0.1:12998
    python3 server.py --host 0.0.0.0   # also reachable from a tablet on the home network

Weeks are auto-discovered: every folder in ``weeks/`` that contains a ``week.json``
shows up on the home page. Nothing is cached, so dropping in a new week (or editing
one) only needs a browser refresh — no restart.

Routes
    /                          home: all weeks, newest first
    /week/<id>/                week hub: the pages (lesson, practice, homework, ...)
    /week/<id>/<slug>          one page of the week (see "pages" in week.json)
    /week/<id>/<file>          static files that belong to the week (js, images, ...)
    /static/<file>             shared css/js
    /api/weeks                 JSON list of weeks (handy for scripts)
"""

from __future__ import annotations

import argparse
import html
import json
import mimetypes
import re
import sys
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parent
WEEKS_DIR = ROOT / "weeks"
STATIC_DIR = ROOT / "static"
TEMPLATES_DIR = ROOT / "templates"

ID_RE = re.compile(r"^[a-z0-9][a-z0-9_-]*$")
# Files a week folder may serve directly. Anything else (e.g. .py) is never exposed.
SERVABLE = {
    ".html", ".js", ".css", ".json", ".png", ".jpg", ".jpeg", ".gif", ".webp",
    ".svg", ".mp3", ".mp4", ".webm", ".woff2", ".pdf",
}


# --------------------------------------------------------------------------- data


def load_weeks() -> list[dict]:
    """Read every ``weeks/*/week.json``. Newest (highest number) first. Bad weeks are skipped."""
    weeks = []
    if not WEEKS_DIR.is_dir():
        return weeks
    for folder in sorted(WEEKS_DIR.iterdir()):
        meta_file = folder / "week.json"
        if not (folder.is_dir() and ID_RE.match(folder.name) and meta_file.is_file()):
            continue
        try:
            meta = json.loads(meta_file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            print(f"warning: skipping {folder.name}: {exc}", file=sys.stderr)
            continue
        meta["id"] = folder.name
        meta.setdefault("number", 0)
        meta.setdefault("title", folder.name)
        meta.setdefault("emoji", "📘")
        meta.setdefault("pages", [])
        for page in meta["pages"]:
            page.setdefault("type", "html")
            page.setdefault("title", page.get("slug", ""))
            page["total"] = page_total(folder, page)
        weeks.append(meta)
    weeks.sort(key=lambda w: (-int(w["number"]), w["id"]))
    return weeks


def page_total(folder: Path, page: dict) -> int:
    """How many things there are to complete on a page (used for progress rings)."""
    if page["type"] == "quiz":
        try:
            data = json.loads((folder / page["file"]).read_text(encoding="utf-8"))
            return len(data.get("questions", []))
        except (OSError, json.JSONDecodeError, KeyError):
            return 0
    return int(page.get("tasks", 0))


def find_week(week_id: str) -> dict | None:
    return next((w for w in load_weeks() if w["id"] == week_id), None)


# ------------------------------------------------------------------------ rendering


def render(template: str, **values: str) -> str:
    text = (TEMPLATES_DIR / template).read_text(encoding="utf-8")
    for key, value in values.items():
        text = text.replace("{{" + key + "}}", value)
    return text


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def json_for_script(data: object) -> str:
    """JSON that is safe to embed inside a <script> tag."""
    return json.dumps(data, ensure_ascii=False).replace("</", "<\\/").replace("<!--", "<\\!--")


def floaters() -> str:
    """Decorative drifting math symbols for hero banners."""
    spec = [("+", 6, 12, 54), ("−", 88, 20, 46), ("×", 20, 62, 60), ("÷", 74, 58, 52), ("%", 48, 8, 44), ("=", 92, 70, 40), ("π", 8, 80, 48), ("½", 60, 76, 42)]
    spans = "".join(
        f'<span style="left:{x}%;top:{y}%;font-size:{size}px;animation-delay:-{i * 1.1:.1f}s">{ch}</span>'
        for i, (ch, x, y, size) in enumerate(spec)
    )
    return f'<div class="floaters" aria-hidden="true">{spans}</div>'


def home_page() -> str:
    cards = []
    for w in load_weeks():
        total = sum(p["total"] for p in w["pages"])
        skills = "".join(f'<span class="chip">{esc(s)}</span>' for s in w.get("skills", []))
        cards.append(
            f"""
        <a class="week-card" href="/week/{esc(w['id'])}/" data-week="{esc(w['id'])}" data-total="{total}">
          <div class="week-emoji">{esc(w['emoji'])}</div>
          <div class="week-num">Week {esc(w['number'])}</div>
          <h2>{esc(w['title'])}</h2>
          <p>{esc(w.get('tagline', ''))}</p>
          <div class="chips">{skills}</div>
          <div class="meter"><i style="width:0%"></i></div>
          <div class="meter-label" data-label>Not started — let's go!</div>
        </a>"""
        )
    body = (
        "".join(cards)
        if cards
        else "<p>No weeks yet. Add a folder to <code>weeks/</code> with a <code>week.json</code>.</p>"
    )
    return render(
        "layout.html",
        title="Math Contest Lab",
        body_attrs='data-page="home"',
        head="",
        body=f"""
      <section class="hero hero-home">
        {floaters()}
        <h1>Math Contest Lab <span class="wiggle">🧪</span></h1>
        <p>Every week a new mission. Play with the ideas first — the contest questions get easy after that.</p>
      </section>
      <section class="week-grid">{body}</section>""",
        scripts="",
    )


def hub_page(week: dict) -> str:
    cards = []
    for p in week["pages"]:
        done_attr = f'data-week="{esc(week["id"])}" data-page-slug="{esc(p["slug"])}" data-total="{p["total"]}"'
        cards.append(
            f"""
        <a class="page-card" href="/week/{esc(week['id'])}/{esc(p['slug'])}" {done_attr}>
          <div class="page-emoji">{esc(p.get('emoji', '📄'))}</div>
          <div>
            <h3>{esc(p['title'])}</h3>
            <p>{esc(p.get('desc', ''))}</p>
            <div class="meter"><i style="width:0%"></i></div>
            <div class="meter-label" data-label></div>
          </div>
        </a>"""
        )
    credit = f'<p class="credit">{esc(week["credit"])}</p>' if week.get("credit") else ""
    return render(
        "layout.html",
        title=f"Week {week['number']} · {week['title']}",
        body_attrs=f'data-page="hub" data-week="{esc(week["id"])}" data-week-title="Week {esc(week["number"])}"',
        head="",
        body=f"""
      <section class="hero hero-home">
        {floaters()}
        <div class="eyebrow">Week {esc(week['number'])} · {esc(week.get('level', ''))}</div>
        <h1>{esc(week['title'])}</h1>
        <p>{esc(week.get('tagline', ''))}</p>
      </section>
      <section class="page-list">{''.join(cards)}</section>
      {credit}""",
        scripts="",
    )


def quiz_page(week: dict, page: dict) -> str:
    data = json.loads((WEEKS_DIR / week["id"] / page["file"]).read_text(encoding="utf-8"))
    extra = "".join(
        f'<script src="/week/{esc(week["id"])}/{esc(s)}"></script>' for s in page.get("scripts", [])
    )
    return render(
        "layout.html",
        title=f"{page['title']} · Week {week['number']}",
        body_attrs=(
            f'data-page="quiz" data-week="{esc(week["id"])}" data-page-slug="{esc(page["slug"])}" '
            f'data-week-title="Week {esc(week["number"])}"'
        ),
        head="",
        body='<div id="quiz-root"></div>',
        scripts=(
            f"{extra}\n"
            f'<script id="quiz-data" type="application/json">{json_for_script(data)}</script>\n'
            '<script>MC.quiz(document.getElementById("quiz-root"),'
            'JSON.parse(document.getElementById("quiz-data").textContent));</script>'
        ),
    )


# ------------------------------------------------------------------------- handler


class Handler(BaseHTTPRequestHandler):
    server_version = "MathCompetition/1.0"

    # -- helpers
    def _send(self, status: int, body: bytes, ctype: str, head_only: bool = False) -> None:
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        if not head_only:
            self.wfile.write(body)

    def _html(self, text: str, status: int = 200) -> None:
        self._send(status, text.encode("utf-8"), "text/html; charset=utf-8", self.command == "HEAD")

    def _not_found(self) -> None:
        self._html(
            render(
                "layout.html",
                title="Not found",
                body_attrs='data-page="404"',
                head="",
                body='<section class="hero"><h1>Oops — nothing here 🙈</h1>'
                '<p><a href="/">Back to the lab</a></p></section>',
                scripts="",
            ),
            HTTPStatus.NOT_FOUND,
        )

    def _file(self, base: Path, rel: str) -> None:
        """Serve ``rel`` from inside ``base`` — never outside it, never a non-whitelisted type."""
        target = (base / rel).resolve()
        if not target.is_relative_to(base.resolve()) or not target.is_file() or target.suffix.lower() not in SERVABLE:
            return self._not_found()
        ctype = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/javascript", "application/json"):
            ctype += "; charset=utf-8"
        self._send(200, target.read_bytes(), ctype, self.command == "HEAD")

    # -- routing
    def do_HEAD(self) -> None:  # noqa: N802
        self.do_GET()

    def do_GET(self) -> None:  # noqa: N802
        path = unquote(urlparse(self.path).path)

        if path == "/":
            return self._html(home_page())
        if path == "/api/weeks":
            body = json.dumps(load_weeks(), ensure_ascii=False).encode("utf-8")
            return self._send(200, body, "application/json; charset=utf-8", self.command == "HEAD")
        if path.startswith("/static/"):
            return self._file(STATIC_DIR, path[len("/static/"):])

        parts = [p for p in path.split("/") if p]
        if len(parts) >= 2 and parts[0] == "week" and ID_RE.match(parts[1]):
            week = find_week(parts[1])
            if week is None:
                return self._not_found()
            if len(parts) == 2:
                if not path.endswith("/"):  # keep relative links working
                    self.send_response(301)
                    self.send_header("Location", f"/week/{week['id']}/")
                    self.end_headers()
                    return
                return self._html(hub_page(week))
            if len(parts) == 3:
                page = next((p for p in week["pages"] if p["slug"] == parts[2]), None)
                if page is not None:
                    if page["type"] == "quiz":
                        return self._html(quiz_page(week, page))
                    return self._file(WEEKS_DIR / week["id"], page["file"])
                return self._file(WEEKS_DIR / week["id"], parts[2])
            return self._file(WEEKS_DIR / week["id"], "/".join(parts[2:]))
        return self._not_found()

    def log_message(self, fmt: str, *args: object) -> None:
        sys.stderr.write("  %s\n" % (fmt % args))


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--host", default="127.0.0.1", help="use 0.0.0.0 to open it to other devices on your network")
    ap.add_argument("--port", type=int, default=12998)
    args = ap.parse_args()
    httpd = ThreadingHTTPServer((args.host, args.port), Handler)
    weeks = load_weeks()
    print(f"Math Contest Lab — {len(weeks)} week(s) found")
    for w in weeks:
        print(f"  • Week {w['number']}: {w['title']}")
    print(f"\nOpen  http://{'localhost' if args.host in ('127.0.0.1', '0.0.0.0') else args.host}:{args.port}   (Ctrl+C to stop)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nBye!")


if __name__ == "__main__":
    main()
