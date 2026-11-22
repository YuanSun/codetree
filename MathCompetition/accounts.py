"""Accounts and saved progress in Postgres (optional).

Child and parent profiles, a signed login cookie, and the progress each child earns. Everything lives in
the ``mathlab`` schema of the family Postgres, next to ``family_budget`` and ``lecture``.

Optional on purpose: without ``psycopg``, ``DATABASE_URL`` and ``SESSION_SECRET`` the server runs exactly as
before and progress stays in each browser's localStorage. Only ``psycopg`` is a dependency; passwords use
the standard library's scrypt and the cookie is an HMAC-signed token, so there is nothing else to install.

Settings come from the environment or ``MathCompetition/.env`` (see ``.env.example``).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import time
from http.cookies import SimpleCookie
from pathlib import Path

try:  # psycopg is the only optional dependency
    import psycopg
    from psycopg.types.json import Jsonb
except ImportError:  # pragma: no cover - exercised by running without it
    psycopg = None
    Jsonb = None

ROOT = Path(__file__).resolve().parent
COOKIE = "mc_session"
SESSION_DAYS = 30
MAX_FAILS, LOCK_SECONDS = 5, 300
ROLES = ("child", "parent")
KEY_RE = re.compile(r"^[A-Za-z0-9_.-]{1,64}$")
MAX_OPS = 500
MAX_ITEM_BYTES = 4096


def load_dotenv(path: Path = ROOT / ".env") -> None:
    """Read KEY=VALUE lines into os.environ (existing variables win). No-op when the file is missing."""
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        val = re.sub(r"\s+#.*$", "", val).strip()
        if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
            val = val[1:-1]
        os.environ.setdefault(key.strip(), val)


load_dotenv()


def _conninfo(url: str) -> str:
    """Accept SQLAlchemy-style URLs (postgresql+psycopg://…) as used by lecture-magique."""
    return re.sub(r"^postgres(ql)?\+\w+://", "postgresql://", url)


def database_url() -> str:
    return os.environ.get("DATABASE_URL", "").strip()


def admin_url() -> str:
    return os.environ.get("DATABASE_ADMIN_URL", "").strip() or database_url()


def secret() -> str:
    return os.environ.get("SESSION_SECRET", "").strip()


def enabled() -> bool:
    return bool(psycopg and database_url() and secret())


def why_disabled() -> str:
    if psycopg is None:
        return "psycopg is not installed (pip install 'psycopg[binary]')"
    if not database_url():
        return "DATABASE_URL is not set"
    if not secret():
        return "SESSION_SECRET is not set"
    return ""


def connect(url: str | None = None):
    if psycopg is None:
        raise RuntimeError("psycopg is not installed")
    return psycopg.connect(_conninfo(url or database_url()), connect_timeout=3)


# --------------------------------------------------------------------- passwords


def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


def _unb64(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def hash_password(password: str) -> str:
    n, r, p = 2**14, 8, 1
    salt = os.urandom(16)
    dk = hashlib.scrypt(password.encode(), salt=salt, n=n, r=r, p=p, maxmem=64 * 1024 * 1024, dklen=32)
    return f"scrypt${n}${r}${p}${_b64(salt)}${_b64(dk)}"


def verify_password(stored: str, password: str) -> bool:
    try:
        scheme, n, r, p, salt, want = stored.split("$")
        if scheme != "scrypt":
            return False
        dk = hashlib.scrypt(password.encode(), salt=_unb64(salt), n=int(n), r=int(r), p=int(p),
                            maxmem=64 * 1024 * 1024, dklen=32)
        return hmac.compare_digest(dk, _unb64(want))
    except (ValueError, TypeError):
        return False


_DUMMY = hash_password("timing-equaliser")


# ----------------------------------------------------------------------- cookie


def _pv(password_hash: str) -> str:
    """A fragment of the hash: changing the password signs the account out of every device."""
    return password_hash[-12:]


def make_token(uid: int, password_hash: str, days: int = SESSION_DAYS) -> str:
    payload = _b64(json.dumps({"u": uid, "pv": _pv(password_hash), "e": int(time.time()) + days * 86400}).encode())
    sig = _b64(hmac.new(secret().encode(), payload.encode(), hashlib.sha256).digest())
    return f"{payload}.{sig}"


def read_token(token: str) -> tuple[int, str] | None:
    """Return (uid, pv) for a valid, unexpired token, else None."""
    try:
        payload, sig = token.split(".")
        want = _b64(hmac.new(secret().encode(), payload.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, want):
            return None
        data = json.loads(_unb64(payload))
        if data["e"] < time.time():
            return None
        return int(data["u"]), str(data["pv"])
    except (ValueError, KeyError, TypeError):
        return None


class Lockout:
    """5 wrong passwords for a username -> locked for 5 minutes (in memory; a restart clears it)."""

    def __init__(self) -> None:
        self.fails: dict[str, int] = {}
        self.until: dict[str, float] = {}

    def locked_for(self, username: str) -> int:
        return max(0, int(self.until.get(username, 0) - time.monotonic() + 0.999))

    def fail(self, username: str) -> None:
        n = self.fails.get(username, 0) + 1
        self.fails[username] = n
        if n >= MAX_FAILS:
            self.until[username] = time.monotonic() + LOCK_SECONDS
            self.fails[username] = 0

    def success(self, username: str) -> None:
        self.fails.pop(username, None)
        self.until.pop(username, None)


lockout = Lockout()


class AuthError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status, self.message = status, message


def _user_dict(row) -> dict:
    return {"id": row[0], "username": row[1], "name": row[2], "role": row[3]}


def login(username: str, password: str) -> tuple[dict, str]:
    """Check a password. Returns (user, cookie token) or raises AuthError."""
    username = (username or "").strip().lower()
    wait = lockout.locked_for(username)
    if wait:
        raise AuthError(429, f"Too many tries. Try again in {wait // 60 + 1} min.")
    with connect() as conn:
        row = conn.execute("SELECT id, username, display_name, role, password_hash FROM mathlab.app_user "
                           "WHERE username = %s", (username,)).fetchone()
    ok = verify_password(row[4], password or "") if row else (verify_password(_DUMMY, password or "") and False)
    if not ok:
        lockout.fail(username)
        raise AuthError(401, "Wrong name or password.")
    lockout.success(username)
    return _user_dict(row), make_token(row[0], row[4])


def user_from_cookie(cookie_header: str | None) -> dict | None:
    """The signed-in user for a Cookie header, or None. Raises on database errors (caller decides)."""
    if not cookie_header or not enabled():
        return None
    jar = SimpleCookie()
    try:
        jar.load(cookie_header)
    except Exception:  # malformed header
        return None
    morsel = jar.get(COOKIE)
    parsed = read_token(morsel.value) if morsel else None
    if not parsed:
        return None
    uid, pv = parsed
    with connect() as conn:
        row = conn.execute("SELECT id, username, display_name, role, password_hash FROM mathlab.app_user WHERE id = %s",
                           (uid,)).fetchone()
    if not row or _pv(row[4]) != pv:
        return None
    return _user_dict(row)


# --------------------------------------------------------------------- progress


def _clean_item(val: object) -> dict:
    if not isinstance(val, dict) or len(json.dumps(val)) > MAX_ITEM_BYTES:
        raise ValueError("item must be a small object")
    return val


def _key(*parts: object) -> tuple[str, ...]:
    if not all(isinstance(p, str) and KEY_RE.match(p) for p in parts):
        raise ValueError("bad unit/page/item name")
    return tuple(parts)  # type: ignore[return-value]


def _xp(value: object) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or not 0 <= value <= 10_000_000:
        raise ValueError("bad xp")
    return value


def load_state(uid: int) -> dict:
    """{"xp": n, "weeks": {unit: {page: {item: {...}}}}} — the shape core.js keeps."""
    weeks: dict = {}
    with connect() as conn:
        xp = conn.execute("SELECT xp FROM mathlab.profile WHERE user_id = %s", (uid,)).fetchone()
        for unit, page, item, data in conn.execute(
                "SELECT unit, page, item, data FROM mathlab.progress WHERE user_id = %s", (uid,)):
            weeks.setdefault(unit, {}).setdefault(page, {})[item] = data
    return {"xp": xp[0] if xp else 0, "weeks": weeks}


def apply_ops(uid: int, ops: dict) -> None:
    """ops = {"set": [[unit,page,item,{…}],…], "del": [[unit,page,item],…], "xp": n}. Validates everything first."""
    sets = ops.get("set") or []
    dels = ops.get("del") or []
    if not isinstance(sets, list) or not isinstance(dels, list) or len(sets) + len(dels) > MAX_OPS:
        raise ValueError("too many operations")
    sets = [(*_key(*s[:3]), _clean_item(s[3])) for s in sets if isinstance(s, list) and len(s) == 4]
    dels = [_key(*d[:3]) for d in dels if isinstance(d, list) and len(d) == 3]
    xp = _xp(ops["xp"]) if ops.get("xp") is not None else None
    with connect() as conn:
        for unit, page, item, data in sets:
            conn.execute("INSERT INTO mathlab.progress (user_id, unit, page, item, data) VALUES (%s,%s,%s,%s,%s) "
                         "ON CONFLICT (user_id, unit, page, item) DO UPDATE SET data = EXCLUDED.data, updated_at = now()",
                         (uid, unit, page, item, Jsonb(data)))
        for unit, page, item in dels:
            conn.execute("DELETE FROM mathlab.progress WHERE user_id=%s AND unit=%s AND page=%s AND item=%s",
                         (uid, unit, page, item))
        if xp is not None:
            _write_xp(conn, uid, xp)


def _write_xp(conn, uid: int, xp: int) -> None:
    # never goes down: two devices can only ever add points
    conn.execute("INSERT INTO mathlab.profile (user_id, xp) VALUES (%s,%s) ON CONFLICT (user_id) DO UPDATE "
                 "SET xp = GREATEST(mathlab.profile.xp, EXCLUDED.xp), updated_at = now()", (uid, xp))


def import_state(uid: int, state: dict) -> int:
    """Copy a browser's localStorage progress into the account. Existing rows are kept. Returns rows added."""
    weeks = state.get("weeks") if isinstance(state, dict) else None
    rows = []
    for unit, pages in (weeks or {}).items():
        for page, items in (pages or {}).items():
            for item, data in (items or {}).items():
                rows.append((*_key(unit, page, item), _clean_item(data)))
    if len(rows) > 5000:
        raise ValueError("too much to import")
    xp = _xp(state.get("xp", 0)) if isinstance(state, dict) else 0
    added = 0
    with connect() as conn:
        for unit, page, item, data in rows:
            added += conn.execute("INSERT INTO mathlab.progress (user_id, unit, page, item, data) VALUES (%s,%s,%s,%s,%s) "
                                  "ON CONFLICT DO NOTHING", (uid, unit, page, item, Jsonb(data))).rowcount
        _write_xp(conn, uid, xp)
    return added


def is_empty(state: dict) -> bool:
    return not state["xp"] and not any(items for pages in state["weeks"].values() for items in pages.values())


# ----------------------------------------------------------------------- parents


def children_overview() -> list[dict]:
    """Every child with points, items finished and when they last did anything."""
    with connect() as conn:
        kids = conn.execute("SELECT u.id, u.username, u.display_name, COALESCE(p.xp, 0) FROM mathlab.app_user u "
                            "LEFT JOIN mathlab.profile p ON p.user_id = u.id WHERE u.role = 'child' ORDER BY u.id").fetchall()
        stats = {}
        for uid, data, updated in conn.execute("SELECT user_id, data, updated_at FROM mathlab.progress"):
            s = stats.setdefault(uid, {"done": 0, "last": None, "stars": 0})
            if data.get("done"):
                s["done"] += 1
                s["stars"] += int(data.get("stars") or 0)
            if s["last"] is None or updated > s["last"]:
                s["last"] = updated
    out = []
    for uid, username, name, xp in kids:
        s = stats.get(uid, {"done": 0, "last": None, "stars": 0})
        out.append({"id": uid, "username": username, "name": name, "xp": xp, "done": s["done"], "stars": s["stars"],
                    "last": s["last"].isoformat() if s["last"] else None})
    return out


def child_detail(uid: int) -> dict | None:
    with connect() as conn:
        row = conn.execute("SELECT id, username, display_name, role FROM mathlab.app_user WHERE id=%s AND role='child'",
                           (uid,)).fetchone()
        if not row:
            return None
        items = [{"unit": u, "page": p, "item": i, "data": d, "at": at.isoformat()} for u, p, i, d, at in conn.execute(
            "SELECT unit, page, item, data, updated_at FROM mathlab.progress WHERE user_id=%s ORDER BY updated_at DESC", (uid,))]
    state = load_state(uid)
    return {"user": _user_dict(row), "xp": state["xp"], "items": items}


# -------------------------------------------------------------------- management


MIGRATIONS = sorted((ROOT / "db").glob("0*.sql"))


def migrate(url: str | None = None) -> list[str]:
    """Apply db/0*.sql that have not run yet (as the admin role). Returns the names applied."""
    applied = []
    with connect(url or admin_url()) as conn:
        conn.execute("CREATE SCHEMA IF NOT EXISTS mathlab")
        conn.execute("CREATE TABLE IF NOT EXISTS mathlab.schema_migrations (version text PRIMARY KEY, "
                     "applied_at timestamptz NOT NULL DEFAULT now())")
        done = {r[0] for r in conn.execute("SELECT version FROM mathlab.schema_migrations")}
        for f in MIGRATIONS:
            if f.name in done:
                continue
            conn.execute(f.read_text(encoding="utf-8"))
            conn.execute("INSERT INTO mathlab.schema_migrations (version) VALUES (%s)", (f.name,))
            applied.append(f.name)
    return applied


def create_user(username: str, password: str, role: str, display_name: str | None = None) -> None:
    username = username.strip().lower()
    if role not in ROLES:
        raise ValueError(f"role must be one of {ROLES}")
    if not re.match(r"^[a-z0-9_.-]{2,32}$", username):
        raise ValueError("username: 2–32 letters, digits, . _ -")
    if len(password) < 6:
        raise ValueError("password needs at least 6 characters")
    with connect() as conn:
        if conn.execute("SELECT 1 FROM mathlab.app_user WHERE username=%s", (username,)).fetchone():
            raise ValueError(f"{username} already exists")
        conn.execute("INSERT INTO mathlab.app_user (username, display_name, password_hash, role) VALUES (%s,%s,%s,%s)",
                     (username, display_name or username.capitalize(), hash_password(password), role))


def set_password(username: str, password: str) -> bool:
    if len(password) < 6:
        raise ValueError("password needs at least 6 characters")
    with connect() as conn:
        return conn.execute("UPDATE mathlab.app_user SET password_hash=%s WHERE username=%s",
                            (hash_password(password), username.strip().lower())).rowcount > 0


def list_users() -> list[tuple]:
    with connect() as conn:
        return conn.execute("SELECT username, display_name, role, created_at FROM mathlab.app_user ORDER BY id").fetchall()
