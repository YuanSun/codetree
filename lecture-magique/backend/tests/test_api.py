import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.auth import hash_password, lockout
from importer.article import import_pack, set_status
from importer.robert import import_entries
from tests.test_article_import import PACK, dictionary

PW = "secret123"


@pytest.fixture
def world(db):
    lockout.fails.clear()
    lockout.until.clear()
    with db.begin() as c:
        import_entries(c, dictionary())
        import_pack(c, PACK)
        set_status(c, PACK["slug"], "published")
        draft = dict(PACK, slug="draft-article", title="Brouillon")
        import_pack(c, draft)
        for name, role in (("grace", "student"), ("leo", "student"), ("ryan", "parent")):
            c.execute(text("INSERT INTO lecture.app_user (username, display_name, password_hash, role) "
                           "VALUES (:u, :u, :h, :r)"), {"u": name, "h": hash_password(PW), "r": role})
        ids = dict(c.execute(text("SELECT slug, id FROM lecture.article")).all())
    from app.main import app
    return {"app": app, "published": ids[PACK["slug"]], "draft": ids["draft-article"], "db": db}


def client(world, username=None):
    c = TestClient(world["app"])
    if username:
        r = c.post("/api/auth/login", json={"username": username, "password": PW})
        assert r.status_code == 200, r.text
    return c


def word_token(world, surface):
    with world["db"].connect() as c:
        return c.execute(text("""SELECT t.id, t.lemma_id FROM lecture.token t JOIN lecture.paragraph p ON p.id=t.paragraph_id
            JOIN lecture.chapter ch ON ch.id=p.chapter_id WHERE ch.article_id=:a AND t.surface=:s ORDER BY t.id LIMIT 1"""),
                         {"a": world["published"], "s": surface}).one()


def ev(token_id, rating="unknown", **kw):
    return {"id": str(uuid.uuid4()), "token_id": token_id, "self_rating": rating, "dwell_ms": 1500, **kw}


def test_login_cookie_me_logout(world):
    c = TestClient(world["app"])
    assert c.get("/api/me").status_code == 401
    r = c.post("/api/auth/login", json={"username": "Grace", "password": PW})
    assert r.status_code == 200
    cookie = r.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie and "max-age=2592000" in cookie
    assert c.get("/api/me").json()["username"] == "grace"
    c.post("/api/auth/logout")
    assert c.get("/api/me").status_code == 401


def test_lockout_after_five_failures(world):
    c = TestClient(world["app"])
    for _ in range(5):
        assert c.post("/api/auth/login", json={"username": "grace", "password": "nope"}).status_code == 401
    r = c.post("/api/auth/login", json={"username": "grace", "password": PW})
    assert r.status_code == 429  # correct password refused while locked
    lockout.until["grace"] = 0  # 5 minutes later
    assert c.post("/api/auth/login", json={"username": "grace", "password": PW}).status_code == 200


def test_tampered_cookie_rejected(world):
    c = client(world, "grace")
    c.cookies.set("lm_session", c.cookies.get("lm_session")[:-2] + "xx")
    assert c.get("/api/me").status_code == 401


def test_bookshelf_hides_drafts_from_students(world):
    g = client(world, "grace").get("/api/articles").json()
    assert [a["slug"] for a in g] == [PACK["slug"]]
    p = client(world, "ryan").get("/api/articles").json()
    assert {a["slug"] for a in p} == {PACK["slug"], "draft-article"}
    assert client(world, "grace").get(f"/api/articles/{world['draft']}/chapters/1").status_code == 404


def test_chapter_payload_has_everything_for_instant_cards(world):
    c = client(world, "grace")
    d = c.get(f"/api/articles/{world['published']}/chapters/1").json()
    assert d["chapter"]["seq"] == 1 and len(d["chapters"]) == 2
    assert d["question"].startswith("Pourquoi")
    for p in d["paragraphs"]:
        for tid, s, e, lemma_id, sense_id, morph in p["tokens"]:
            if lemma_id:
                lem = d["lemmas"][str(lemma_id)]
                assert sense_id in lem["senses"]
                assert str(sense_id) in d["senses"]
    assert d["words"] == {}


def test_lookups_logged_idempotent_and_update_user_word(world):
    c = client(world, "grace")
    tid, lid = word_token(world, "énigmatique")
    tid2, lid2 = word_token(world, "galant")
    e1 = ev(tid)
    r = c.post("/api/lookups", json={"events": [e1, ev(tid2, "known"), ev(999999)]}).json()
    assert len(r["accepted"]) == 2 and len(r["rejected"]) == 1
    assert c.post("/api/lookups", json={"events": [e1]}).json()["duplicate"] == [e1["id"]]  # retry
    c.post("/api/lookups", json={"events": [ev(tid, "vague")]})
    with world["db"].connect() as db:
        n = db.execute(text("SELECT count(*) FROM lecture.lookup_event")).scalar()
        w = {r.lemma_id: r for r in db.execute(text("SELECT * FROM lecture.user_word"))}
        e = db.execute(text("SELECT self_rating, dwell_ms FROM lecture.lookup_event WHERE client_event_id=:i"),
                       {"i": e1["id"]}).one()
    assert n == 3
    assert (e.self_rating, e.dwell_ms) == ("unknown", 1500)
    assert (w[lid].lookup_count, w[lid].status, w[lid].familiarity, w[lid].first_token_id) == (2, "learning", 0, tid)
    # Phase 2: the first tap is an FSRS "Again"; the second tap the same day is logged but not re-rated.
    assert w[lid].stability is not None and w[lid].due_at is not None and w[lid].reps == 1
    assert w[lid2].stability is None  # first tap "known": kept out of review
    assert (w[lid2].lookup_count, w[lid2].status) == (1, "known")
    d = c.get(f"/api/articles/{world['published']}/chapters/1").json()
    assert d["words"][str(lid)]["lookups"] == 2


def test_complete_chapter_counts_exposures_only_for_untapped_words(world):
    c = client(world, "grace")
    tid_a, lid_a = word_token(world, "énigmatique")
    tid_b, lid_b = word_token(world, "galant")
    old = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
    c.post("/api/lookups", json={"events": [ev(tid_a, at=old), ev(tid_b, at=old)]})
    opened = datetime.now(timezone.utc) - timedelta(minutes=5)
    c.post("/api/lookups", json={"events": [ev(tid_b)]})  # tapped again during this reading
    ch_id = c.get(f"/api/articles/{world['published']}/chapters/1").json()["chapter"]["id"]
    r = c.post(f"/api/chapters/{ch_id}/complete", json={"opened_at": opened.isoformat()}).json()
    assert r == {"next_seq": 2, "exposures": 1, "finished": False, "chapters_done": [1]}
    with world["db"].connect() as db:
        exp = dict(db.execute(text("SELECT lemma_id, exposure_count FROM lecture.user_word")).all())
    assert exp == {lid_a: 1, lid_b: 0}
    ch2 = c.get(f"/api/articles/{world['published']}/chapters/2").json()["chapter"]["id"]
    assert c.post(f"/api/chapters/{ch2}/complete", json={}).json()["finished"] is True


def test_progress_saved(world):
    c = client(world, "grace")
    a = world["published"]
    assert c.put(f"/api/progress/{a}", json={"chapter": 2, "paragraph": 1, "seconds": 30}).status_code == 200
    c.put(f"/api/progress/{a}", json={"chapter": 2, "paragraph": 1, "seconds": 5000})  # rejected (>3600)
    c.put(f"/api/progress/{a}", json={"chapter": 2, "paragraph": 1, "seconds": 900})  # capped at 600
    p = c.get("/api/articles").json()[0]["progress"]
    assert p["last_chapter"] == 2 and p["seconds_read"] == 630


def test_student_a_cannot_see_student_b_progress_or_words(world):
    a, b = client(world, "grace"), client(world, "leo")
    art = world["published"]
    tid, lid = word_token(world, "énigmatique")
    a.post("/api/lookups", json={"events": [ev(tid)]})
    a.put(f"/api/progress/{art}", json={"chapter": 2, "seconds": 120})
    ch_id = a.get(f"/api/articles/{art}/chapters/1").json()["chapter"]["id"]
    a.post(f"/api/chapters/{ch_id}/complete", json={})

    assert b.get("/api/articles").json()[0]["progress"] is None
    d = b.get(f"/api/articles/{art}/chapters/1").json()
    assert d["words"] == {} and d["progress"] is None
    # B tapping the same word creates B's own row and does not touch A's
    b.post("/api/lookups", json={"events": [ev(tid)]})
    with world["db"].connect() as db:
        rows = db.execute(text("""SELECT u.username, w.lookup_count FROM lecture.user_word w
            JOIN lecture.app_user u ON u.id = w.user_id WHERE w.lemma_id = :l ORDER BY 1"""), {"l": lid}).all()
    assert [tuple(r) for r in rows] == [("grace", 1), ("leo", 1)]
    # A still sees only A's data
    assert a.get(f"/api/articles/{art}/chapters/1").json()["words"][str(lid)]["lookups"] == 1
    # user_id in the body is ignored: the session decides
    r = b.post("/api/lookups", json={"events": [dict(ev(tid), user_id=1)]})
    assert r.status_code == 200
    with world["db"].connect() as db:
        assert db.execute(text("SELECT lookup_count FROM lecture.user_word w JOIN lecture.app_user u ON u.id=w.user_id "
                               "WHERE u.username='grace' AND w.lemma_id=:l"), {"l": lid}).scalar() == 1
