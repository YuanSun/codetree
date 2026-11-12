"""Weekly défi (FSRS) and the word bag."""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app import review
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
        for name in ("grace", "leo"):
            c.execute(text("INSERT INTO lecture.app_user (username, display_name, password_hash, role) "
                           "VALUES (:u, :u, :h, 'student')"), {"u": name, "h": hash_password(PW)})
        # English glosses for a few words, so "meaning" questions can be built
        for lemma, gloss in (("maison", "house"), ("homme", "man"), ("société", "society"), ("année", "year"),
                             ("membre", "member"), ("tâche", "task")):
            c.execute(text("""INSERT INTO lecture.sense (lemma_id, source, seq, gloss_en)
                SELECT id, 'wiktionary_en', 0, :g FROM lecture.lemma WHERE lemma = :l"""), {"l": lemma, "g": gloss})
    from app.main import app
    return {"app": app, "db": db}


def login(world, name):
    c = TestClient(world["app"])
    assert c.post("/api/auth/login", json={"username": name, "password": PW}).status_code == 200
    return c


def tokens(world, n):
    """n word tokens with distinct lemmas (first occurrence of each)."""
    with world["db"].connect() as c:
        return c.execute(text("""SELECT DISTINCT ON (t.lemma_id) t.id, t.lemma_id FROM lecture.token t
            WHERE t.lemma_id IS NOT NULL AND t.is_word ORDER BY t.lemma_id, t.id LIMIT :n"""), {"n": n}).all()


def tap(client, token_id, rating="unknown", at=None):
    ev = {"id": str(uuid.uuid4()), "token_id": token_id, "self_rating": rating, "dwell_ms": 900}
    if at:
        ev["at"] = at.isoformat()
    r = client.post("/api/lookups", json={"events": [ev]})
    assert r.status_code == 200 and r.json()["accepted"]


def expected(world, item_id):
    with world["db"].connect() as c:
        return c.execute(text("SELECT expected->>'answer' FROM lecture.quiz_item WHERE id = :i"), {"i": item_id}).scalar()


def test_replay_builds_state_from_old_taps(world):
    """Words tapped before phase 2 (no FSRS state) get it from their lookup history."""
    t = tokens(world, 2)
    now = datetime.now(timezone.utc)
    with world["db"].begin() as c:
        uid = c.execute(text("SELECT id FROM lecture.app_user WHERE username='grace'")).scalar()
        for tok, ratings in ((t[0], ["unknown", "unknown", "vague"]), (t[1], ["known", "known"])):
            status = "known" if ratings[0] == "known" else "learning"
            c.execute(text("""INSERT INTO lecture.user_word (user_id, lemma_id, status, lookup_count, first_token_id)
                VALUES (:u, :l, :s, :n, :t)"""), {"u": uid, "l": tok.lemma_id, "s": status, "n": len(ratings), "t": tok.id})
            for i, r in enumerate(ratings):  # one tap per day, the same day twice for the first word
                day = now - timedelta(days=10 - (i if tok is t[1] else [0, 0, 5][i]))
                c.execute(text("""INSERT INTO lecture.lookup_event (user_id, token_id, lemma_id, self_rating, created_at)
                    VALUES (:u, :t, :l, :r, :d)"""), {"u": uid, "t": tok.id, "l": tok.lemma_id, "r": r, "d": day})
        review.ensure_fsrs(c, uid)
        w = {r.lemma_id: r for r in c.execute(text("SELECT * FROM lecture.user_word WHERE user_id = :u"), {"u": uid})}
        logs = c.execute(text("SELECT lemma_id, rating FROM lecture.review_log WHERE user_id = :u ORDER BY id"),
                         {"u": uid}).all()
    assert w[t[0].lemma_id].reps == 2  # Again (day 1; same-day repeat ignored) + Hard (day 6)
    assert [r.rating for r in logs if r.lemma_id == t[0].lemma_id] == [1, 2]
    assert w[t[0].lemma_id].familiarity == 0  # never in a défi yet
    assert w[t[1].lemma_id].fsrs_state is None and w[t[1].lemma_id].status == "known"


def test_first_defi_then_new_word_cap(world):
    g = login(world, "grace")
    assert g.get("/api/quiz/current").json()["quiz"] is None  # empty bag
    for tok in tokens(world, 22):
        tap(g, tok.id)
    q = g.get("/api/quiz/current").json()["quiz"]
    assert len(q["items"]) == review.QUIZ_SIZE  # first défi may be all new words
    assert {i["type"] for i in q["items"]} <= set(review.TYPES)
    assert all("answer" not in i["prompt"] for i in q["items"])  # answers stay on the server
    assert g.get("/api/quiz/current").json()["quiz"]["id"] == q["id"]  # same défi all week

    # answer everything correctly and fast, then pretend a week has passed
    for it in q["items"]:
        g.post(f"/api/quiz/items/{it['id']}/answer", json={"response": expected(world, it["id"]), "response_ms": 2000})
    with world["db"].begin() as c:
        c.execute(text("UPDATE lecture.quiz SET week_of = week_of - 7"))
        c.execute(text("UPDATE lecture.user_word SET due_at = now() - interval '1 day'"))
    q2 = g.get("/api/quiz/current").json()["quiz"]
    assert q2["id"] != q["id"]
    with world["db"].connect() as c:
        quizzed_before = {r for (r,) in c.execute(text(
            "SELECT lemma_id FROM lecture.quiz_item WHERE quiz_id = :q"), {"q": q["id"]})}
        lemmas2 = [r for (r,) in c.execute(text(
            "SELECT lemma_id FROM lecture.quiz_item WHERE quiz_id = :q"), {"q": q2["id"]})]
    new = [l for l in lemmas2 if l not in quizzed_before]
    assert len(new) <= review.MAX_NEW
    assert len(lemmas2) == review.QUIZ_SIZE  # due words first, then at most 5 new


def test_answers_rate_words_and_wrong_ones_come_back(world):
    g = login(world, "grace")
    for tok in tokens(world, 4):
        tap(g, tok.id)
    q = g.get("/api/quiz/current").json()["quiz"]
    first, second = q["items"][0], q["items"][1]

    ok = g.post(f"/api/quiz/items/{first['id']}/answer",
                json={"response": expected(world, first["id"]), "response_ms": 2500}).json()
    assert ok["correct"] is True and ok["familiarity"] >= 1
    again = g.post(f"/api/quiz/items/{first['id']}/answer", json={"response": "x", "response_ms": 10}).json()
    assert again["already"] is True and again["correct"] is True  # resent request: no second rating

    bad = g.post(f"/api/quiz/items/{second['id']}/answer", json={"response": "zzz", "response_ms": 4000}).json()
    assert bad["correct"] is False and bad["answer"] == expected(world, second["id"])
    q = g.get("/api/quiz/current").json()["quiz"]
    retry = q["items"][-1]
    assert retry["prompt"].get("retry") is True and len(q["items"]) == 5
    assert retry["type"] != second["type"] or retry["type"] == "dictation"

    with world["db"].connect() as c:
        logs = c.execute(text("SELECT rating, source FROM lecture.review_log WHERE source = 'quiz' ORDER BY id")).all()
    assert [r.rating for r in logs] == [3, 1]  # Good, Again

    g.post(f"/api/quiz/items/{retry['id']}/answer", json={"response": expected(world, retry["id"]), "response_ms": 3000})
    with world["db"].connect() as c:
        assert c.execute(text("SELECT count(*) FROM lecture.review_log WHERE source = 'quiz'")).scalar() == 2  # retry: log only

    for it in q["items"]:
        if not it["answered"] and it["id"] != retry["id"]:
            g.post(f"/api/quiz/items/{it['id']}/answer", json={"response": expected(world, it["id"]), "response_ms": 3000})
    done = g.get("/api/quiz/current").json()["quiz"]
    assert done["status"] == "done"
    assert done["summary"]["total"] == 4 and done["summary"]["correct"] == 3 and len(done["summary"]["practice"]) == 1


def test_students_cannot_touch_each_others_defi(world):
    g, l = login(world, "grace"), login(world, "leo")
    for tok in tokens(world, 3):
        tap(g, tok.id)
    item = g.get("/api/quiz/current").json()["quiz"]["items"][0]
    assert l.post(f"/api/quiz/items/{item['id']}/answer", json={"response": "x"}).status_code == 404
    assert l.get("/api/quiz/current").json()["quiz"] is None  # Leo has no words yet
    assert l.get("/api/words").json() == []


def test_word_bag_groups(world):
    g = login(world, "grace")
    t = tokens(world, 3)
    tap(g, t[0].id)
    tap(g, t[1].id, "known")
    tap(g, t[2].id)
    with world["db"].begin() as c:
        c.execute(text("UPDATE lecture.user_word SET familiarity = 5 WHERE lemma_id = :l"), {"l": t[2].lemma_id})
    bag = {w["lemma_id"]: w for w in g.get("/api/words").json()}
    assert bag[t[0].lemma_id]["group"] == "new" and bag[t[0].lemma_id]["sentence"]
    assert bag[t[1].lemma_id]["group"] == "known"
    assert bag[t[2].lemma_id]["group"] == "mastered"
    assert [w["lemma_id"] for w in g.get("/api/words?group=mastered").json()] == [t[2].lemma_id]


def test_check_dictation_accents():
    assert review.check("dictation", {"answer": "énigmatique"}, " Énigmatique ") == (True, None)
    ok, hint = review.check("dictation", {"answer": "énigmatique"}, "enigmatique")
    assert ok is False and "accents" in hint
    assert review.check("cloze", {"answer": "l’école"}, "l'école") == (True, None)


def test_familiarity_thresholds():
    assert [review.familiarity(s) for s in (None, 0.2, 3, 10, 20, 45)] == [0, 1, 2, 3, 4, 5]
