"""Passwords (argon2id), login lockout, and the signed session cookie.

Session = signed cookie {"uid", "pv"} where pv is a fragment of the password hash, so changing a
password logs out every device. HttpOnly, SameSite=Lax, 30 days; not Secure because the site is
served over plain http on the home network (see CLAUDE.md).

Lockout: 5 consecutive failures for a username -> locked 5 minutes. Kept in process memory
(the app is a single process); a restart clears it, which is acceptable for a home LAN.
"""
import time
from dataclasses import dataclass

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Depends, HTTPException, Request, Response
from itsdangerous import BadSignature, URLSafeTimedSerializer
from sqlalchemy import Connection, text

from .config import settings
from .db import get_conn

COOKIE = "lm_session"
MAX_FAILS = 5
LOCK_SECONDS = 300
_hasher = PasswordHasher()  # argon2id by default
_DUMMY = _hasher.hash("timing-equaliser")


def hash_password(pw: str) -> str:
    return _hasher.hash(pw)


def verify_password(stored: str, pw: str) -> bool:
    try:
        return _hasher.verify(stored, pw)
    except (VerificationError, InvalidHashError):
        return False


@dataclass
class User:
    id: int
    username: str
    display_name: str
    role: str
    settings: dict


class Lockout:
    def __init__(self) -> None:
        self.fails: dict[str, int] = {}
        self.until: dict[str, float] = {}

    def locked_for(self, username: str) -> int:
        left = self.until.get(username, 0) - time.monotonic()
        return max(0, int(left + 0.999))

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


def _serializer() -> URLSafeTimedSerializer:
    if not settings.session_secret:
        raise RuntimeError("SESSION_SECRET is not set")
    return URLSafeTimedSerializer(settings.session_secret, salt="lecture-magique-session")


def _pv(password_hash: str) -> str:
    return password_hash[-12:]


def login(conn: Connection, response: Response, username: str, password: str) -> User:
    username = username.strip().lower()
    wait = lockout.locked_for(username)
    if wait:
        raise HTTPException(429, f"Trop d'essais. Réessaie dans {wait // 60 + 1} min.",
                            headers={"Retry-After": str(wait)})
    row = conn.execute(text("SELECT id, username, display_name, role, settings, password_hash "
                            "FROM lecture.app_user WHERE username = :u"), {"u": username}).first()
    ok = verify_password(row.password_hash, password) if row else (verify_password(_DUMMY, password) and False)
    if not ok:
        lockout.fail(username)
        raise HTTPException(401, "Nom d'utilisateur ou mot de passe incorrect.")
    lockout.success(username)
    token = _serializer().dumps({"uid": row.id, "pv": _pv(row.password_hash)})
    response.set_cookie(COOKIE, token, max_age=settings.session_days * 86400, httponly=True, samesite="lax",
                        secure=False, path="/")
    return User(row.id, row.username, row.display_name, row.role, row.settings)


def logout(response: Response) -> None:
    response.delete_cookie(COOKIE, path="/", httponly=True, samesite="lax")


def current_user(request: Request, conn: Connection = Depends(get_conn)) -> User:
    token = request.cookies.get(COOKIE)
    if not token:
        raise HTTPException(401, "Non connecté")
    try:
        data = _serializer().loads(token, max_age=settings.session_days * 86400)
    except BadSignature:
        raise HTTPException(401, "Session expirée")
    row = conn.execute(text("SELECT id, username, display_name, role, settings, password_hash "
                            "FROM lecture.app_user WHERE id = :id"), {"id": data.get("uid")}).first()
    if not row or _pv(row.password_hash) != data.get("pv"):
        raise HTTPException(401, "Session expirée")
    return User(row.id, row.username, row.display_name, row.role, row.settings)


def require_parent(user: User = Depends(current_user)) -> User:
    if user.role not in ("parent", "admin"):
        raise HTTPException(403, "Réservé aux parents")
    return user
