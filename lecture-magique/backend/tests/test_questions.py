"""Reading comprehension: questions page, answers (model answer only after answering), parents' view,
access rules, and replacing the questions of an article that already has answers."""
import copy

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.auth import hash_password, lockout
from importer.article import ImportRefused, import_pack, replace_questions, set_status
from importer.robert import import_entries as import_robert
from tests.test_article_import import PACK, dictionary

PW = "secret123"


def pack_with_end_questions() -> dict:
    pack = copy.deepcopy(PACK)
    pack["chapters"][0]["question"]["model_answer"] = "On ne sait rien de lui."
    pack["questions"] = [
        {"kind": "open", "prompt": "Que veut dire « énigmatique » ?", "model_answer": "Mystérieux.",
         "rubric": {"skill": "Vocabulaire en contexte", "points": 2, "must_answer": "mystérieux", "avoid": "deviner"}},
        {"kind": "writing", "prompt": "Décris un personnage mystérieux que tu connais."},
    ]
    return pack


@pytest.fixture
def world(db):
    lockout.fails.clear()
    lockout.until.clear()
    pack = pack_with_end_questions()
    with db.begin() as c:
        import_robert(c, dictionary())
        rep = import_pack(c, pack)
        for name, role in (("grace", "student"), ("lea", "student"), ("ryan", "parent")):
            c.execute(text("INSERT INTO lecture.app_user (username, display_name, password_hash, role) "
                           "VALUES (:u, :u, :h, :r)"), {"u": name, "h": hash_password(PW), "r": role})
    from app.main import app
    return {"app": app, "db": db, "aid": rep["article_id"], "pack": pack}


def login(world, name):
    c = TestClient(world["app"])
    assert c.post("/api/auth/login", json={"username": name, "password": PW}).status_code == 200
    return c


def kid_id(world, name):
    with world["db"].connect() as c:
        return c.execute(text("SELECT id FROM lecture.app_user WHERE username = :u"), {"u": name}).scalar()


def test_questions_answers_and_key(world):
    aid = world["aid"]
    g = login(world, "grace")
    assert g.get(f"/api/articles/{aid}/questions").status_code == 404  # draft: not for children
    with world["db"].begin() as c:
        set_status(c, PACK["slug"], "published")
    qs = g.get(f"/api/articles/{aid}/questions").json()["questions"]
    # chapter questions first, then the end-of-reading set, in pack order
    assert [(q["chapter"] and q["chapter"]["seq"], q["kind"]) for q in qs] == [(1, "open"), (None, "open"), (None, "writing")]
    assert qs[1]["skill"] == "Vocabulaire en contexte" and qs[1]["points"] == 2
    assert all(q["answer"] is None and q["key"] is None for q in qs)  # no model answer before answering

    r = g.post(f"/api/questions/{qs[1]['id']}/answer", json={"body": "  Ça veut dire mystérieux.  "})
    assert r.status_code == 200
    assert r.json()["key"] == {"model_answer": "Mystérieux.", "must_answer": "mystérieux", "avoid": "deviner"}
    assert g.post(f"/api/questions/{qs[1]['id']}/answer", json={"body": "Mystérieux, secret."}).status_code == 200
    assert g.post(f"/api/questions/{qs[1]['id']}/answer", json={"body": "   "}).status_code == 422
    qs = g.get(f"/api/articles/{aid}/questions").json()["questions"]
    assert qs[1]["answer"]["body"] == "Mystérieux, secret." and qs[1]["key"]["model_answer"] == "Mystérieux."
    assert qs[0]["key"] is None

    # another child sees none of Grace's answers
    lea = login(world, "lea")
    assert all(q["answer"] is None for q in lea.get(f"/api/articles/{aid}/questions").json()["questions"])

    # parents: latest answer per question, with the number of versions; children can't use it
    papa = login(world, "ryan")
    rows = papa.get(f"/api/parent/children/{kid_id(world, 'grace')}/answers").json()
    assert len(rows) == 1
    assert rows[0]["body"] == "Mystérieux, secret." and rows[0]["versions"] == 2
    assert rows[0]["model_answer"] == "Mystérieux." and rows[0]["article"]["title"] == PACK["title"]
    assert g.get(f"/api/parent/children/{kid_id(world, 'grace')}/answers").status_code == 403
    assert papa.get(f"/api/parent/children/{kid_id(world, 'lea')}/answers").json() == []


def test_replace_questions_keeps_answers(world):
    aid = world["aid"]
    with world["db"].begin() as c:
        set_status(c, PACK["slug"], "published")
    g = login(world, "grace")
    qs = g.get(f"/api/articles/{aid}/questions").json()["questions"]
    g.post(f"/api/questions/{qs[0]['id']}/answer", json={"body": "On ne sait rien de lui."})
    g.post(f"/api/questions/{qs[1]['id']}/answer", json={"body": "Mystérieux."})

    pack = world["pack"]
    with pytest.raises(ImportRefused, match="answers"), world["db"].begin() as c:  # full re-import refused
        import_pack(c, pack)

    pack["chapters"][0]["question"]["model_answer"] = "Personne ne le connaît vraiment."  # same prompt: updated
    pack["questions"] = [  # the answered vocabulary question is replaced, the writing one dropped, one added
        {"kind": "open", "prompt": "Où habite Phileas Fogg ?", "model_answer": "Saville-row."},
    ]
    with world["db"].begin() as c:
        rep = replace_questions(c, pack)
    assert rep == {"questions": 2, "updated": 1, "added": 1, "retired": 1, "deleted": 1}

    qs2 = g.get(f"/api/articles/{aid}/questions").json()["questions"]
    assert [q["prompt"] for q in qs2] == [qs[0]["prompt"], "Où habite Phileas Fogg ?"]
    assert qs2[0]["id"] == qs[0]["id"] and qs2[0]["answer"]["body"] == "On ne sait rien de lui."
    assert qs2[0]["key"]["model_answer"] == "Personne ne le connaît vraiment."
    # the retired question can't be answered any more, but its answer is still in the parents' list
    assert g.post(f"/api/questions/{qs[1]['id']}/answer", json={"body": "x"}).status_code == 404
    papa = login(world, "ryan")
    bodies = {r["body"] for r in papa.get(f"/api/parent/children/{kid_id(world, 'grace')}/answers").json()}
    assert bodies == {"On ne sait rien de lui.", "Mystérieux."}
