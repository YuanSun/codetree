"""Word-tap events. The log is append-only and must never lose an event: phase 2 replays it to
seed FSRS. Each event carries a client UUID, so a batch the browser retries is stored once."""
from datetime import datetime, timedelta, timezone
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import Connection, text

from .. import review
from ..auth import User, current_user
from ..db import get_conn
from .reading import visible_statuses

router = APIRouter()


class LookupIn(BaseModel):
    id: UUID
    token_id: int
    self_rating: Literal["unknown", "vague", "known"] = "unknown"
    dwell_ms: int | None = Field(default=None, ge=0)
    at: datetime | None = None


class LookupBatch(BaseModel):
    events: list[LookupIn] = Field(max_length=500)


def _clamp_time(at: datetime | None, now: datetime) -> datetime:
    """Trust the tablet's clock for when the tap happened, within reason (queued events
    can arrive late; a wrong clock must not put them in the future or years back)."""
    if at is None:
        return now
    if at.tzinfo is None:
        at = at.replace(tzinfo=timezone.utc)
    return min(max(at, now - timedelta(days=30)), now)


@router.post("/lookups")
def post_lookups(batch: LookupBatch, user: User = Depends(current_user), conn: Connection = Depends(get_conn)):
    now = datetime.now(timezone.utc)
    events = sorted(batch.events, key=lambda e: _clamp_time(e.at, now))
    token_ids = list({e.token_id for e in events})
    tokens = {r.id: r.lemma_id for r in conn.execute(text("""
        SELECT t.id, t.lemma_id FROM lecture.token t
        JOIN lecture.paragraph p ON p.id = t.paragraph_id JOIN lecture.chapter c ON c.id = p.chapter_id
        JOIN lecture.article a ON a.id = c.article_id
        WHERE t.id = ANY(:ids) AND t.is_word AND a.status = ANY(:s)"""),
        {"ids": token_ids, "s": list(visible_statuses(user))})}
    accepted, duplicate, rejected = [], [], []
    for e in events:
        if e.token_id not in tokens:
            rejected.append(str(e.id))
            continue
        lemma_id = tokens[e.token_id]
        at = _clamp_time(e.at, now)
        new_id = conn.execute(text("""
            INSERT INTO lecture.lookup_event (user_id, token_id, lemma_id, self_rating, dwell_ms, created_at, client_event_id)
            VALUES (:u, :t, :l, :r, :d, :at, :cid)
            ON CONFLICT (client_event_id) DO NOTHING RETURNING id"""),
            {"u": user.id, "t": e.token_id, "l": lemma_id, "r": e.self_rating,
             "d": min(e.dwell_ms, 3_600_000) if e.dwell_ms is not None else None, "at": at, "cid": e.id}).scalar()
        if new_id is None:
            duplicate.append(str(e.id))
            continue
        accepted.append(str(e.id))
        if lemma_id is None:
            continue
        # First tap creates the word (familiarity 0); "known" on the first tap marks it known.
        # FSRS state is (re)built from lookup_event in app/review.py.
        conn.execute(text("""
            INSERT INTO lecture.user_word (user_id, lemma_id, status, familiarity, lookup_count, first_token_id, first_seen_at)
            VALUES (:u, :l, :status, 0, 1, :t, :at)
            ON CONFLICT (user_id, lemma_id) DO UPDATE SET lookup_count = lecture.user_word.lookup_count + 1"""),
            {"u": user.id, "l": lemma_id, "t": e.token_id, "at": at,
             "status": "known" if e.self_rating == "known" else "learning"})
        # Spaced repetition: the tap is also an FSRS rating (first one of the day only; see app/review.py).
        review.on_lookup(conn, user.id, lemma_id, e.self_rating, at)
    return {"accepted": accepted, "duplicate": duplicate, "rejected": rejected}
