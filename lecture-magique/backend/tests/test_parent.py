"""Parent progress report: parents only, numbers match the child's activity."""
from sqlalchemy import text

from app.auth import hash_password
from tests.test_review import PW, expected, login, tap, tokens, world  # noqa: F401  (fixture)


def add_parent(world):
    with world["db"].begin() as c:
        c.execute(text("INSERT INTO lecture.app_user (username, display_name, password_hash, role) "
                       "VALUES ('ryan', 'Ryan', :h, 'parent')"), {"h": hash_password(PW)})


def test_only_parents_can_read_reports(world):
    g = login(world, "grace")
    assert g.get("/api/parent/children").status_code == 403
    with world["db"].connect() as c:
        gid = c.execute(text("SELECT id FROM lecture.app_user WHERE username='grace'")).scalar()
    assert g.get(f"/api/parent/children/{gid}/report").status_code == 403


def test_report_reflects_activity(world):
    add_parent(world)
    g = login(world, "grace")
    t = tokens(world, 5)
    for tok in t:
        tap(g, tok.id)
    tap(g, t[0].id)  # looked up twice -> "hard"
    with world["db"].connect() as c:
        aid = c.execute(text("SELECT id FROM lecture.article")).scalar()
    g.put(f"/api/progress/{aid}", json={"chapter": 1, "paragraph": 1, "seconds": 300})
    g.put(f"/api/progress/{aid}", json={"chapter": 1, "paragraph": 2, "seconds": 150})
    q = g.get("/api/quiz/current").json()["quiz"]
    first = q["items"][0]
    g.post(f"/api/quiz/items/{first['id']}/answer", json={"response": "faux", "response_ms": 3000})
    for it in q["items"][1:]:
        g.post(f"/api/quiz/items/{it['id']}/answer", json={"response": expected(world, it["id"]), "response_ms": 3000})

    r = login(world, "ryan")
    kids = r.get("/api/parent/children").json()
    assert [k["username"] for k in kids] == ["grace", "leo"]
    rep = r.get(f"/api/parent/children/{kids[0]['id']}/report?weeks=4").json()
    assert len(rep["weeks"]) == 4
    this = rep["weeks"][-1]
    assert this["taps"] == 6 and this["words"] == 5 and this["active_days"] == 1
    assert this["minutes"] == 8  # 450 s read today
    assert this["defi"]["questions"] == 5 and this["defi"]["correct"] == 4
    assert all(w["taps"] == 0 and w["minutes"] == 0 and w["defi"] is None for w in rep["weeks"][:-1])
    assert rep["bag"]["new"] + rep["bag"]["learning"] + rep["bag"]["mastered"] == 5
    hard = {h["lemma"]: h for h in rep["hard_words"]}
    with world["db"].connect() as c:
        wrong = c.execute(text("SELECT l.lemma FROM lecture.lemma l JOIN lecture.quiz_item i ON i.lemma_id = l.id "
                               "WHERE i.id = :i"), {"i": first["id"]}).scalar()
    assert rep["hard_words"][0]["lemma"] == wrong and hard[wrong]["errors"] == 1
    assert hard[wrong]["sentence"]
    assert rep["books"][0]["minutes"] == 8 and rep["books"][0]["chapters"] == 2
    assert r.get("/api/parent/children/999999/report").status_code == 404
