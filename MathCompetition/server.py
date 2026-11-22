#!/usr/bin/env python3
"""MathCompetition — a tiny dependency-free server for interactive contest-prep weeks.

    python3 server.py                  # http://127.0.0.1:12998
    python3 server.py --host 0.0.0.0   # also reachable from a tablet on the home network
    python3 server.py --base-path /math   # when a gateway serves it under /math/ (it strips the prefix)

Weeks are auto-discovered: every folder in ``weeks/`` that contains a ``week.json``
shows up on the home page. Nothing is cached, so dropping in a new week (or editing
one) only needs a browser refresh — no restart.

Two tracks share one server and one engine:
    contest   weeks/<id>/   Math Contest Lab (CJMC / Gauss prep)      URLs under /week/
    study     study/<id>/   School Study (normal class sheets)        URLs under /study/

Routes
    /                          contest home: all weeks, newest first
    /week/<id>/                week hub: the pages (lesson, practice, homework, ...)
    /week/<id>/<slug>          one page of the week (see "pages" in week.json)
    /week/<id>/<file>          static files that belong to the week (js, images, ...)
    /study/                    study home (same layout, its own colours and wording)
    /study/<id>/...            same three routes as /week/<id>/ for a study unit
    /static/<file>             shared css/js
    /api/weeks, /api/study     JSON list of units (handy for scripts)

Accounts (optional — only when DATABASE_URL, SESSION_SECRET and psycopg are set, see accounts.py)
    /login                     sign in (child or parent profile)
    /parent/                   parents: every child's points, finished items and where they needed hints
    /api/session.js            tiny script the pages load first: who is signed in + their saved progress
    /api/login, /api/logout, /api/progress (GET/PUT), /api/progress/import, /api/parent/...
"""

from __future__ import annotations

import argparse
import html
import json
import mimetypes
import os
import re
import sys
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

import accounts

ROOT = Path(__file__).resolve().parent
WEEKS_DIR = ROOT / "weeks"
STUDY_DIR = ROOT / "study"
STATIC_DIR = ROOT / "static"
TEMPLATES_DIR = ROOT / "templates"

# URL prefix when a reverse proxy mounts the site under a path (it must strip the prefix before
# forwarding). Empty when served at the root. Set with --base-path or MATH_BASE_PATH.
BASE_PATH = ""
ABS_LINK_RE = re.compile(r'(\b(?:href|src)=")/(?!/)')


def set_base_path(value: str) -> None:
    global BASE_PATH
    value = (value or "").strip().strip("/")
    BASE_PATH = f"/{value}" if value else ""


def rebase(text: str) -> str:
    """Prefix root-relative href/src attributes with BASE_PATH (no-op when served at the root)."""
    return ABS_LINK_RE.sub(lambda m: f"{m.group(1)}{BASE_PATH}/", text) if BASE_PATH else text


CORE_TAG = '<script src="/static/js/core.js"></script>'
SESSION_TAG = '<script src="/api/session.js"></script>'


def with_session(text: str) -> str:
    """Make every page that loads core.js load the session script first (so progress is known synchronously)."""
    return text.replace(CORE_TAG, SESSION_TAG + CORE_TAG, 1) if SESSION_TAG not in text else text


# Floating links added to standalone pages (bottom-left: the top-left and bottom-right corners are
# usually taken by a page's own menu / back-to-top buttons). Uses root-relative hrefs so --base-path works.
BACK_PILL = """<style>
.mc-back{position:fixed;left:12px;bottom:14px;z-index:9997;display:flex;gap:2px;font:700 13px/1 Nunito,system-ui,sans-serif;
  background:#fff;color:#2b2d42;border:1px solid #d9d9d9;border-radius:999px;box-shadow:0 4px 14px rgba(43,45,66,.2);overflow:hidden}
.mc-back a{color:inherit;text-decoration:none;padding:10px 12px;white-space:nowrap}
.mc-back a:hover{background:rgba(127,127,127,.15)}
html[data-theme="dark"] .mc-back,html[data-theme="night"] .mc-back{background:#26293f;color:#ecebf5;border-color:#3a3e5e}
@media print{.mc-back{display:none}}
</style>
<nav class="mc-back" aria-label="{{short}}"><a href="{{home}}">{{emoji}} {{short}}</a><a href="{{prefix}}/{{week}}/">‹ {{label}}</a></nav>"""

# The two tracks. "item" prefixes a unit's number ("Week 8" / "Sem 5") unless its week.json has a "label".
TRACKS = {
    "week": {"dir": WEEKS_DIR, "prefix": "/week", "home": "/", "name": "Math Contest Lab", "short": "Math Lab", "emoji": "🧪", "item": "Week"},
    "study": {"dir": STUDY_DIR, "prefix": "/study", "home": "/study/", "name": "School Study", "short": "Study", "emoji": "📚", "item": "Sem"},
}

ID_RE = re.compile(r"^[a-z0-9][a-z0-9_-]*$")
# Files a week folder may serve directly. Anything else (e.g. .py) is never exposed.
SERVABLE = {
    ".html", ".js", ".css", ".json", ".png", ".jpg", ".jpeg", ".gif", ".webp",
    ".svg", ".mp3", ".mp4", ".webm", ".woff2", ".pdf",
}


# --------------------------------------------------------------------------- data


def load_weeks(track: str = "week") -> list[dict]:
    """Read every ``<track dir>/*/week.json``. Newest (highest number) first. Bad units are skipped."""
    weeks = []
    root = TRACKS[track]["dir"]
    if not root.is_dir():
        return weeks
    for folder in sorted(root.iterdir()):
        meta_file = folder / "week.json"
        if not (folder.is_dir() and ID_RE.match(folder.name) and meta_file.is_file()):
            continue
        try:
            meta = json.loads(meta_file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            print(f"warning: skipping {folder.name}: {exc}", file=sys.stderr)
            continue
        meta["id"] = folder.name
        meta["track"] = track
        meta.setdefault("number", 0)
        meta.setdefault("label", f"{TRACKS[track]['item']} {meta['number']}")
        meta.setdefault("title", folder.name)
        meta.setdefault("emoji", "📘")
        meta.setdefault("pages", [])
        for page in meta["pages"]:
            page.setdefault("type", "html")
            page.setdefault("title", page.get("slug", ""))
            page["total"] = page_total(folder, page)
        weeks.append(meta)
    weeks.sort(key=lambda w: (-float(w["number"]), w["id"]))   # a past exam can sit between weeks with e.g. number 8.5
    return weeks


def page_total(folder: Path, page: dict) -> int:
    """How many things there are to complete on a page (used for progress rings)."""
    if page["type"] == "exam":
        return 1          # "take the exam once" fills the progress ring
    if page["type"] == "quiz":
        try:
            data = json.loads((folder / page["file"]).read_text(encoding="utf-8"))
            return len(data.get("questions", []))
        except (OSError, json.JSONDecodeError, KeyError):
            return 0
    return int(page.get("tasks", 0))


def find_week(week_id: str, track: str = "week") -> dict | None:
    return next((w for w in load_weeks(track) if w["id"] == week_id), None)


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


def track_tabs(current: str) -> str:
    """Little switcher between the two tracks, shown under the hero on both home pages."""
    links = "".join(
        f'<a href="{esc(t["home"])}"{" class=on" if key == current else ""}>{t["emoji"]} {esc(t["name"])}</a>'
        for key, t in TRACKS.items()
    )
    return f'<nav class="track-switch" aria-label="Sections">{links}</nav>'


HOME_COPY = {
    "week": ("Math Contest Lab", "🧪", "Every week a new mission. Play with the ideas first — the contest questions get easy after that."),
    "study": ("School Study", "📚", "Your normal class sheets, made playable: fractions, PPCM &amp; PGCD, French grammar… Not contest prep — take your time and check your answers."),
}


def home_page(track: str = "week") -> str:
    t = TRACKS[track]
    cards = []
    for w in load_weeks(track):
        total = sum(p["total"] for p in w["pages"])
        skills = "".join(f'<span class="chip">{esc(s)}</span>' for s in w.get("skills", []))
        cards.append(
            f"""
        <a class="week-card" href="{t['prefix']}/{esc(w['id'])}/" data-week="{esc(w['id'])}" data-total="{total}">
          <div class="week-emoji">{esc(w['emoji'])}</div>
          <div class="week-num">{esc(w['label'])}</div>
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
        else f"<p>Nothing here yet. Add a folder to <code>{esc(t['dir'].name)}/</code> with a <code>week.json</code>.</p>"
    )
    name, emoji, blurb = HOME_COPY[track]
    return render(
        "layout.html",
        title=name,
        body_attrs=f'data-page="home" data-track="{track}"',
        head="",
        body=f"""
      <section class="hero hero-home">
        {floaters()}
        <h1>{name} <span class="wiggle">{emoji}</span></h1>
        <p>{blurb}</p>
      </section>
      {track_tabs(track)}
      <section class="week-grid">{body}</section>""",
        scripts="",
    )


def hub_page(week: dict) -> str:
    t = TRACKS[week["track"]]
    cards = []
    for p in week["pages"]:
        done_attr = f'data-week="{esc(week["id"])}" data-page-slug="{esc(p["slug"])}" data-total="{p["total"]}"'
        cards.append(
            f"""
        <a class="page-card" href="{t['prefix']}/{esc(week['id'])}/{esc(p['slug'])}" {done_attr}>
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
        title=f"{week['label']} · {week['title']}",
        body_attrs=f'data-page="hub" data-track="{week["track"]}" data-week="{esc(week["id"])}" data-week-title="{esc(week["label"])}"',
        head="",
        body=f"""
      <section class="hero hero-home">
        {floaters()}
        <div class="eyebrow">{esc(week['label'])} · {esc(week.get('level', ''))}</div>
        <h1>{esc(week['title'])}</h1>
        <p>{esc(week.get('tagline', ''))}</p>
      </section>
      <section class="page-list">{''.join(cards)}</section>
      {credit}""",
        scripts="",
    )


def quiz_page(week: dict, page: dict) -> str:
    t = TRACKS[week["track"]]
    data = json.loads((t["dir"] / week["id"] / page["file"]).read_text(encoding="utf-8"))
    extra = "".join(
        script_tag(t, week, s) for s in page.get("scripts", [])
    )
    return render(
        "layout.html",
        title=f"{page['title']} · {week['label']}",
        body_attrs=(
            f'data-page="quiz" data-track="{week["track"]}" data-week="{esc(week["id"])}" data-page-slug="{esc(page["slug"])}" '
            f'data-week-title="{esc(week["label"])}"'
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


def exam_page(week: dict, page: dict) -> str:
    """A timed mock exam (see static/js/exam.js). Uses the same JSON as a quiz page, plus an ``exam`` block."""
    t = TRACKS[week["track"]]
    data = json.loads((t["dir"] / week["id"] / page["file"]).read_text(encoding="utf-8"))
    extra = "".join(
        script_tag(t, week, s) for s in page.get("scripts", [])
    )
    return render(
        "layout.html",
        title=f"{page['title']} · {week['label']}",
        body_attrs=(
            f'data-page="exam" data-track="{week["track"]}" data-week="{esc(week["id"])}" data-page-slug="{esc(page["slug"])}" '
            f'data-week-title="{esc(week["label"])}"'
        ),
        head="",
        body='<div id="exam-root"></div>',
        scripts=(
            '<script src="/static/js/exam.js"></script>\n'
            f"{extra}\n"
            f'<script id="exam-data" type="application/json">{json_for_script(data)}</script>\n'
            '<script>MC.exam(document.getElementById("exam-root"),'
            'JSON.parse(document.getElementById("exam-data").textContent));</script>'
        ),
    )


def login_page(next_url: str) -> str:
    return render(
        "layout.html",
        title="Sign in · Math Lab",
        body_attrs='data-page="login"',
        head='<link rel="stylesheet" href="/static/css/account.css">',
        body='<section class="account-card"><div class="account-emoji">🔑</div><h1>Who is playing?</h1>'
        '<p class="muted">Sign in and your stars, points and badges follow you to every device.</p>'
        '<form id="login-form" autocomplete="on">'
        '<label>Name<input id="u" name="username" autocomplete="username" autocapitalize="none" required></label>'
        '<label>Password<input id="p" name="password" type="password" autocomplete="current-password" required></label>'
        '<button class="btn" type="submit">Let’s go ➜</button><div id="login-msg" class="account-msg" role="status"></div></form>'
        '<p class="muted small"><a id="skip" href="/">Skip — save on this device only</a></p></section>',
        scripts=f'<script>window.MC_NEXT={json_for_script(next_url)};</script>\n<script src="/static/js/account.js"></script>',
    )


def parent_page() -> str:
    return render(
        "layout.html",
        title="Parents · Math Lab",
        body_attrs='data-page="parent"',
        head='<link rel="stylesheet" href="/static/css/account.css">',
        body='<section class="hero"><h1>👪 Parent view</h1><p>How every child is doing, and where they needed help.</p></section>'
        '<div id="parent-root" class="parent-root"><p class="muted">Loading…</p></div>',
        scripts='<script src="/static/js/parent.js"></script>',
    )


def script_tag(track: dict, week: dict, name: str) -> str:
    """A page's extra script: a file of the unit, or a shared one (/static/js/…, e.g. the 3D viewer)."""
    if name.startswith("/static/js/") and ".." not in name:
        return f'<script src="{esc(name)}"></script>'
    return f'<script src="{track["prefix"]}/{esc(week["id"])}/{esc(name)}"></script>'


def safe_next(value: str) -> str:
    """Only ever send people back to a path on this site (no open redirects)."""
    value = (value or "").strip()
    return value if value.startswith("/") and not value.startswith("//") and "\\" not in value else f"{BASE_PATH}/"


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
        self._send(status, rebase(text).encode("utf-8"), "text/html; charset=utf-8", self.command == "HEAD")

    def _json(self, obj: object, status: int = 200, headers: dict | None = None) -> None:
        body = json.dumps(obj, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _body(self) -> dict | None:
        """The JSON request body. Anything not sent as application/json is refused: a cross-site <form> can
        only send other types, so this (with SameSite=Lax cookies) is the CSRF guard."""
        if not (self.headers.get("Content-Type") or "").lower().startswith("application/json"):
            return None
        try:
            n = int(self.headers.get("Content-Length") or 0)
            if not 0 < n <= 2_000_000:
                return None
            data = json.loads(self.rfile.read(n))
        except (ValueError, OSError):
            return None
        return data if isinstance(data, dict) else None

    def _session(self) -> tuple[dict | None, bool]:
        """(signed-in user or None, database_ok). A database outage must never break the pages."""
        if not accounts.enabled():
            return None, True
        try:
            return accounts.user_from_cookie(self.headers.get("Cookie")), True
        except Exception as exc:  # noqa: BLE001
            sys.stderr.write(f"  accounts: database unavailable ({exc})\n")
            return None, False

    def _cookie(self, token: str, max_age: int) -> dict:
        return {"Set-Cookie": f"{accounts.COOKIE}={token}; Path={BASE_PATH or '/'}; Max-Age={max_age}; HttpOnly; SameSite=Lax"}

    def _redirect(self, location: str) -> None:
        self.send_response(301)
        self.send_header("Location", location)
        self.end_headers()

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
        body = target.read_bytes()
        if ctype.startswith("text/html"):
            body = rebase(with_session(body.decode("utf-8"))).encode("utf-8")
        self._send(200, body, ctype, self.command == "HEAD")

    def _standalone(self, week: dict, page: dict) -> None:
        """A self-contained page (its own <html>, styles and scripts): serve it as-is, plus a small
        "back to the lab" pill so the child can always get home. Set ``"standalone": true`` in week.json."""
        t = TRACKS[week["track"]]
        base = (t["dir"] / week["id"]).resolve()
        target = (base / page["file"]).resolve()
        if not target.is_relative_to(base) or not target.is_file():
            return self._not_found()
        pill = (BACK_PILL.replace("{{week}}", esc(week["id"])).replace("{{label}}", esc(week["label"]))
                .replace("{{short}}", esc(t["short"])).replace("{{emoji}}", t["emoji"])
                .replace("{{home}}", t["home"]).replace("{{prefix}}", t["prefix"]))
        text = target.read_text(encoding="utf-8")
        text = text.replace("</body>", pill + "\n</body>", 1) if "</body>" in text else text + pill
        self._html(text)

    # -- accounts
    def _session_js(self) -> None:
        user, db_ok = self._session()
        info = {"enabled": accounts.enabled(), "dbDown": not db_ok, "user": user, "state": None}
        if user:
            try:
                info["state"] = accounts.load_state(user["id"])
            except Exception:  # noqa: BLE001
                info["user"], info["dbDown"] = None, True
        body = ("window.MC_SESSION=" + json_for_script(info) + ";").encode("utf-8")
        self._send(200, body, "application/javascript; charset=utf-8", self.command == "HEAD")

    def _need(self, role: str | None = None) -> dict | None:
        """The signed-in user, or send a 401/403 and return None."""
        if not accounts.enabled():
            self._json({"error": "accounts are not set up"}, 404)
            return None
        user, db_ok = self._session()
        if not db_ok:
            self._json({"error": "database unavailable"}, 503)
        elif not user:
            self._json({"error": "sign in first"}, 401)
        elif role and user["role"] != role:
            self._json({"error": "parents only"}, 403)
        else:
            return user
        return None

    def _account_get(self, path: str) -> bool:
        """GET /api/progress and /api/parent/…  Returns True when it answered."""
        try:
            if path == "/api/progress":
                if user := self._need():
                    self._json(accounts.load_state(user["id"]))
                return True
            if path == "/api/parent/overview":
                if self._need("parent"):
                    self._json({"children": accounts.children_overview()})
                return True
            m = re.match(r"^/api/parent/child/(\d+)$", path)
            if m:
                if self._need("parent"):
                    detail = accounts.child_detail(int(m.group(1)))
                    self._json(detail if detail else {"error": "no such child"}, 200 if detail else 404)
                return True
        except Exception as exc:  # noqa: BLE001
            sys.stderr.write(f"  accounts: {exc}\n")
            self._json({"error": "database error"}, 500)
            return True
        return False

    def do_POST(self) -> None:  # noqa: N802
        path = unquote(urlparse(self.path).path)
        if not path.startswith("/api/"):
            return self._not_found()
        if not accounts.enabled():
            return self._json({"error": "accounts are not set up"}, 404)
        body = self._body()
        if body is None:
            return self._json({"error": "send JSON"}, 400)
        try:
            if path == "/api/login":
                try:
                    user, token = accounts.login(str(body.get("username", "")), str(body.get("password", "")))
                except accounts.AuthError as exc:
                    return self._json({"error": exc.message}, exc.status)
                state = accounts.load_state(user["id"])
                return self._json({"user": user, "empty": accounts.is_empty(state)},
                                  headers=self._cookie(token, accounts.SESSION_DAYS * 86400))
            if path == "/api/logout":
                return self._json({"ok": True}, headers=self._cookie("", 0))
            if path == "/api/progress/import":
                if user := self._need():
                    return self._json({"added": accounts.import_state(user["id"], body)})
                return None
        except ValueError as exc:
            return self._json({"error": str(exc)}, 400)
        except Exception as exc:  # noqa: BLE001
            sys.stderr.write(f"  accounts: {exc}\n")
            return self._json({"error": "database error"}, 500)
        return self._not_found()

    def do_PUT(self) -> None:  # noqa: N802
        path = unquote(urlparse(self.path).path)
        if path != "/api/progress":
            return self._not_found()
        user = self._need()
        if not user:
            return None
        body = self._body()
        if body is None:
            return self._json({"error": "send JSON"}, 400)
        try:
            accounts.apply_ops(user["id"], body)
            return self._json({"ok": True})
        except ValueError as exc:
            return self._json({"error": str(exc)}, 400)
        except Exception as exc:  # noqa: BLE001
            sys.stderr.write(f"  accounts: {exc}\n")
            return self._json({"error": "database error"}, 500)

    # -- routing
    def do_HEAD(self) -> None:  # noqa: N802
        self.do_GET()

    def do_GET(self) -> None:  # noqa: N802
        path = unquote(urlparse(self.path).path)

        if path == "/api/session.js":
            return self._session_js()
        if path == "/login":
            q = parse_qs(urlparse(self.path).query)
            return self._html(login_page(safe_next((q.get("next") or [""])[0])))
        if path in ("/parent", "/parent/"):
            if not path.endswith("/"):
                return self._redirect(f"{BASE_PATH}/parent/")
            return self._html(parent_page())
        if path.startswith("/api/") and path not in ("/api/weeks", "/api/study") and self._account_get(path):
            return
        if path == "/":
            return self._html(home_page("week"))
        if path == "/study":
            return self._redirect(f"{BASE_PATH}/study/")
        if path == "/study/":
            return self._html(home_page("study"))
        for track, api in (("week", "/api/weeks"), ("study", "/api/study")):
            if path == api:
                body = json.dumps(load_weeks(track), ensure_ascii=False, default=str).encode("utf-8")
                return self._send(200, body, "application/json; charset=utf-8", self.command == "HEAD")
        if path.startswith("/static/"):
            return self._file(STATIC_DIR, path[len("/static/"):])

        parts = [p for p in path.split("/") if p]
        track = next((k for k, t in TRACKS.items() if len(parts) >= 2 and parts[0] == t["prefix"].strip("/")), None)
        if track and ID_RE.match(parts[1]):
            t = TRACKS[track]
            week = find_week(parts[1], track)
            if week is None:
                return self._not_found()
            if len(parts) == 2:
                if not path.endswith("/"):  # keep relative links working
                    return self._redirect(f"{BASE_PATH}{t['prefix']}/{week['id']}/")
                return self._html(hub_page(week))
            if len(parts) == 3:
                page = next((p for p in week["pages"] if p["slug"] == parts[2]), None)
                if page is not None:
                    if page["type"] == "quiz":
                        return self._html(quiz_page(week, page))
                    if page["type"] == "exam":
                        return self._html(exam_page(week, page))
                    if page.get("standalone"):
                        return self._standalone(week, page)
                    return self._file(t["dir"] / week["id"], page["file"])
                return self._file(t["dir"] / week["id"], parts[2])
            return self._file(t["dir"] / week["id"], "/".join(parts[2:]))
        return self._not_found()

    def log_message(self, fmt: str, *args: object) -> None:
        sys.stderr.write("  %s\n" % (fmt % args))


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--host", default="127.0.0.1", help="use 0.0.0.0 to open it to other devices on your network")
    ap.add_argument("--port", type=int, default=12998)
    ap.add_argument("--base-path", default=os.environ.get("MATH_BASE_PATH", ""),
                    help="URL prefix when mounted under a path by a gateway, e.g. /math")
    args = ap.parse_args()
    set_base_path(args.base_path)
    httpd = ThreadingHTTPServer((args.host, args.port), Handler)
    for track, t in TRACKS.items():
        units = load_weeks(track)
        print(f"{t['name']} — {len(units)} unit(s) found" + ("" if track == "week" else "  (under /study/)"))
        for w in units:
            print(f"  • {w['label']}: {w['title']}")
    print("Accounts: " + ("on (Postgres, schema mathlab)" if accounts.enabled() else f"off — {accounts.why_disabled()}; progress stays in each browser"))
    print(f"\nOpen  http://{'localhost' if args.host in ('127.0.0.1', '0.0.0.0') else args.host}:{args.port}   (Ctrl+C to stop)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nBye!")


if __name__ == "__main__":
    main()
