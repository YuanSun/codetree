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
         "rubric": {"skill": "Vocabulaire en contexte", "points": 2, "must_answer": "mystérieux", "avoid": "deviner",
                    # typographic apostrophe and spacing differ from the text on purpose: the match ignores them
                    "evidence": [{"chapter": 1, "quote": "personnage énigmatique,  dont on ne savait rien"}]}},
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
    assert r.json()["key"] == {"model_answer": "Mystérieux.", "must_answer": "mystérieux", "avoid": "deviner",
                               "evidence": [{"chapter": 1, "quote": "personnage énigmatique,  dont on ne savait rien"}]}
    assert g.post(f"/api/questions/{qs[1]['id']}/answer", json={"body": "Mystérieux, secret."}).status_code == 200
    assert g.post(f"/api/questions/{qs[1]['id']}/answer", json={"body": "   "}).status_code == 422
    qs = g.get(f"/api/articles/{aid}/questions").json()["questions"]
    assert qs[1]["answer"]["body"] == "Mystérieux, secret." and qs[1]["key"]["model_answer"] == "Mystérieux."
    assert qs[0]["key"] is None
    assert g.get("/api/articles").json()[0]["questions"] == {"total": 3, "answered": 1}

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


def test_grading_export_and_import(world):
    aid = world["aid"]
    with world["db"].begin() as c:
        set_status(c, PACK["slug"], "published")
    g = login(world, "grace")
    qs = g.get(f"/api/articles/{aid}/questions").json()["questions"]
    g.post(f"/api/questions/{qs[0]['id']}/answer", json={"body": "Il est mystérieux."})
    g.post(f"/api/questions/{qs[1]['id']}/answer", json={"body": "Ça veut dire mystérieux."})
    papa = login(world, "ryan")
    kid = kid_id(world, "grace")

    assert g.get(f"/api/parent/children/{kid}/grading-export").status_code == 403
    exp = papa.get(f"/api/parent/children/{kid}/grading-export").json()
    assert exp["format"] == "lecture-magique-grading/1" and "grace" in exp["instructions"]
    items = {x["question"]: x for x in exp["answers"]}
    assert len(items) == 2
    chap, vocab = items[qs[0]["prompt"]], items[qs[1]["prompt"]]
    assert chap["points"] == 2 and chap["chapter"] == 1  # chapter questions default to 2 points
    assert vocab["points"] == 2 and vocab["must_answer"] == "mystérieux" and vocab["answer"] == "Ça veut dire mystérieux."
    assert vocab["evidence"][0]["chapter"] == 1 and chap["evidence"] == []
    assert '"evidence"' in exp["instructions"]

    # bad batches change nothing
    for bad in ([{"answer_id": vocab["answer_id"], "score": 2.5, "feedback": "x"}],
                [{"answer_id": vocab["answer_id"], "score": 1.25, "feedback": "x"}],
                [{"answer_id": 999999, "score": 1, "feedback": "x"}],
                [{"answer_id": vocab["answer_id"], "score": 1}, {"answer_id": vocab["answer_id"], "score": 1}]):
        assert papa.post("/api/parent/grades", json={"grades": bad}).status_code == 422
    assert g.post("/api/parent/grades", json={"grades": [{"answer_id": vocab["answer_id"], "score": 1}]}).status_code == 403

    r = papa.post("/api/parent/grades", json={"grades": [
        {"answer_id": vocab["answer_id"], "score": 2, "feedback": "Bravo, c’est le bon sens."},
        {"answer_id": chap["answer_id"], "score": 0.5, "feedback": "Explique pourquoi."}]})
    assert r.json() == {"graded": 2}

    # the child sees her grade; a new version keeps showing the old grade, marked as not for this version
    qs = g.get(f"/api/articles/{aid}/questions").json()["questions"]
    assert qs[1]["grade"] == {"score": 2.0, "points": 2.0, "feedback": "Bravo, c’est le bon sens.", "for_latest": True}
    g.post(f"/api/questions/{qs[0]['id']}/answer", json={"body": "On ne sait rien de lui : il est mystérieux."})
    qs = g.get(f"/api/articles/{aid}/questions").json()["questions"]
    assert qs[0]["grade"]["score"] == 0.5 and qs[0]["grade"]["for_latest"] is False

    # the next export has only the new, ungraded version; regrade=true has every latest answer
    exp = papa.get(f"/api/parent/children/{kid}/grading-export").json()["answers"]
    assert [x["answer"] for x in exp] == ["On ne sait rien de lui : il est mystérieux."]
    assert len(papa.get(f"/api/parent/children/{kid}/grading-export?regrade=true").json()["answers"]) == 2
    rows = {r["prompt"]: r for r in papa.get(f"/api/parent/children/{kid}/answers").json()}
    assert rows[qs[1]["prompt"]]["grade"] == {"score": 2.0, "points": 2.0, "feedback": "Bravo, c’est le bon sens.", "by": "claude"}
    assert rows[qs[0]["prompt"]]["grade"] is None


def test_closed_questions_are_marked_at_once(world):
    pack = world["pack"]
    pack["questions"] = [
        {"kind": "choice", "prompt": "Vrai ou faux ? Phileas Fogg est bavard.", "model_answer": "Faux : il parle peu.",
         "rubric": {"skill": "Vrai ou faux", "points": 1, "choices": ["Vrai", "Faux"], "correct": 1}},
        {"kind": "choice", "prompt": "Où habite-t-il ?", "model_answer": "Saville-row.",
         "rubric": {"points": 1, "choices": ["Londres, Saville-row", "Paris", "Bombay"], "correct": 0}},
    ] + pack["questions"]
    for bad in ({"choices": ["Vrai"], "correct": 0}, {"choices": ["Vrai", "Faux"], "correct": 2},
                {"choices": ["Vrai", "Vrai"], "correct": 0}, {"choices": ["A", "B"]}):
        broken = copy.deepcopy(pack)
        broken["questions"][0]["rubric"] = bad
        with pytest.raises(ImportRefused, match="choice"), world["db"].begin() as c:
            replace_questions(c, broken)
    with world["db"].begin() as c:
        replace_questions(c, pack)
        set_status(c, PACK["slug"], "published")
    g = login(world, "grace")
    aid = world["aid"]
    qs = [q for q in g.get(f"/api/articles/{aid}/questions").json()["questions"] if q["kind"] == "choice"]
    tf, where = qs
    assert tf["choices"] == ["Vrai", "Faux"] and tf["key"] is None  # options yes, the right one not yet

    assert g.post(f"/api/questions/{tf['id']}/answer", json={"body": "Peut-être"}).status_code == 422
    r = g.post(f"/api/questions/{tf['id']}/answer", json={"body": "Vrai"}).json()
    assert r["grade"]["score"] == 0 and r["key"]["correct"] == "Faux" and r["key"]["model_answer"] == "Faux : il parle peu."
    assert g.post(f"/api/questions/{tf['id']}/answer", json={"body": "Faux"}).status_code == 409  # one try
    assert g.post(f"/api/questions/{where['id']}/answer", json={"body": "Londres, Saville-row"}).json()["grade"]["score"] == 1

    qs = {q["id"]: q for q in g.get(f"/api/articles/{aid}/questions").json()["questions"]}
    assert qs[tf["id"]]["grade"]["score"] == 0 and qs[where["id"]]["grade"] == \
        {"score": 1.0, "points": 1.0, "feedback": None, "for_latest": True}
    papa = login(world, "ryan")
    kid = kid_id(world, "grace")
    assert papa.get(f"/api/parent/children/{kid}/grading-export?regrade=true").json()["answers"] == []  # never sent to Claude
    rows = {r["prompt"]: r for r in papa.get(f"/api/parent/children/{kid}/answers").json()}
    assert rows[tf["prompt"]]["grade"]["by"] == "auto" and rows[tf["prompt"]]["choices"] == ["Vrai", "Faux"]


def test_evidence_must_be_in_the_text(db):
    """A quote must be found, within one paragraph, in the chapter it names (apostrophes, spaces, case ignored)."""
    from importer.article import check_questions
    ok = pack_with_end_questions()
    ok["questions"][0]["rubric"]["evidence"].append({"chapter": 2, "quote": "N'EN DÉPLAISE À MONSIEUR"})
    check_questions(ok)
    for bad in ({"chapter": 2, "quote": "personnage énigmatique"},      # wrong chapter
                {"chapter": 1, "quote": "attirer l'attention. À l'un"},  # spans two paragraphs
                {"chapter": 1, "quote": "personnage […] rien"},          # not verbatim
                {"chapter": 9, "quote": "Fogg"},                         # no such chapter
                {"chapter": 1, "quote": "  "}):
        pack = pack_with_end_questions()
        pack["questions"][0]["rubric"]["evidence"] = [bad]
        with pytest.raises(ImportRefused):
            check_questions(pack)
