"""English reading: dictionary import (wiktionary_en_sample.jsonl, CC BY-SA), English packs, and the
language split of défi / word bag / report. Text: Lewis Carroll, Alice's Adventures in Wonderland (1865),
public domain."""
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.auth import hash_password, lockout
from importer.article import import_pack, set_status
from importer.robert import import_entries as import_robert
from importer.tokenize import tokenize
from importer.wiktionary import iter_entries
from importer.wiktionary_en import entry_senses, form_code, import_entries
from tests.test_article_import import PACK as FR_PACK, dictionary as fr_dictionary

SAMPLE = str(Path(__file__).parent / "fixtures" / "wiktionary_en_sample.jsonl")
PW = "secret123"

ALICE = {
    "slug": "test-alice", "title": "Down the Rabbit-Hole", "week_of": "2026-11-16", "lang": "en",
    "chapters": [{"seq": 1, "title": "Down the Rabbit-Hole", "paragraphs": [
        "Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: "
        "once or twice she had peeped into the book her sister was reading, but it had no pictures or "
        "conversations in it, “and what is the use of a book,” thought Alice “without pictures or conversations?”",
        "So she was considering in her own mind, whether the pleasure of making a daisy-chain would be worth the "
        "trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by "
        "her. The Rabbit’s watch didn’t stop.",
    ]}],
}


def forms_of(c, form):
    return {(r.lemma, r.pos): set(r.tags) for r in c.execute(text("""
        SELECT l.lemma, l.pos, f.tags FROM lecture.word_form f JOIN lecture.lemma l ON l.id = f.lemma_id
        WHERE f.form = :f AND l.lang = 'en'"""), {"f": form})}


def test_codes_and_senses():
    assert form_code(["past"]) == "past"
    assert form_code(["participle", "past"]) == "pp"
    assert form_code(["participle", "present"]) == "ing"
    assert form_code(["present", "singular", "third-person"]) == "3s"
    assert form_code(["plural"]) == "pl"
    assert form_code(["comparative"]) == "cmp"
    assert form_code(["colloquial", "nonstandard", "participle", "past"]) is None
    e = {"senses": [{"glosses": ["To move swiftly.", "To go at a fast pace."], "examples": [{"text": "Run!"}]},
                    {"glosses": ["An old meaning."], "tags": ["obsolete"]},
                    {"glosses": ["simple past of run"], "form_of": [{"word": "run"}]}]}
    assert entry_senses(e) == [{"gloss": "To go at a fast pace.", "examples": ["Run!"]}]


def test_tokenize_english_keeps_contractions():
    toks = [t.surface for t in tokenize("The Rabbit’s watch didn’t stop; the players’ arms.", "en") if t.is_word]
    assert toks == ["The", "Rabbit’s", "watch", "didn’t", "stop", "the", "players", "arms"]


def test_import_english_dictionary_and_rerun(db):
    with db.begin() as c:
        import_robert(c, fr_dictionary())
        n_fr = c.execute(text("SELECT count(*) FROM lecture.lemma")).scalar()
        stats = import_entries(c, iter_entries(SAMPLE))
        assert stats["lemmas"] > 50
        assert ("run", "VERB") in forms_of(c, "ran") and "past" in forms_of(c, "ran")[("run", "VERB")]
        assert "pl" in forms_of(c, "children")[("child", "NOUN")]
        assert "ing" in forms_of(c, "sitting")[("sit", "VERB")]
        book = c.execute(text("""SELECT count(*), bool_and(gloss_en IS NOT NULL) FROM lecture.sense s
            JOIN lecture.lemma l ON l.id = s.lemma_id WHERE l.lang = 'en' AND l.lemma = 'book' AND l.pos = 'NOUN'""")).one()
        assert 1 <= book[0] <= 6 and book[1]
        # French entries untouched; English rows are lang 'en'
        assert c.execute(text("SELECT count(*) FROM lecture.lemma WHERE lang = 'fr'")).scalar() == n_fr
        counts = c.execute(text("SELECT (SELECT count(*) FROM lecture.lemma), (SELECT count(*) FROM lecture.sense), "
                                "(SELECT count(*) FROM lecture.word_form)")).one()
        import_entries(c, iter_entries(SAMPLE))  # re-run: no duplicates
        assert c.execute(text("SELECT (SELECT count(*) FROM lecture.lemma), (SELECT count(*) FROM lecture.sense), "
                              "(SELECT count(*) FROM lecture.word_form)")).one() == counts


def test_same_spelling_in_both_languages(db):
    with db.begin() as c:
        import_robert(c, [{"headword": "sister", "homograph": None, "pos": "nom féminin", "ipa": None, "kind": "word",
                           "senses": [{"key": "1", "definition": "Mot de test.", "examples": []}]}])
        import_entries(c, iter_entries(SAMPLE))
        assert sorted(c.execute(text("SELECT lang FROM lecture.lemma WHERE lemma = 'sister' AND pos = 'NOUN'"))
                      .scalars()) == ["en", "fr"]


@pytest.fixture
def both(db):
    lockout.fails.clear()
    lockout.until.clear()
    with db.begin() as c:
        import_robert(c, fr_dictionary())
        import_entries(c, iter_entries(SAMPLE))
        fr = import_pack(c, FR_PACK)
        en = import_pack(c, ALICE)
        for slug in (FR_PACK["slug"], ALICE["slug"]):
            set_status(c, slug, "published")
        for name in ("grace", "leo"):
            c.execute(text("INSERT INTO lecture.app_user (username, display_name, password_hash, role) "
                           "VALUES (:u, :u, :h, 'student')"), {"u": name, "h": hash_password(PW)})
        c.execute(text("INSERT INTO lecture.app_user (username, display_name, password_hash, role) "
                       "VALUES ('ryan', 'Papa', :h, 'parent')"), {"h": hash_password(PW)})
    from app.main import app
    return {"app": app, "db": db, "fr": fr, "en": en}


def login(world, name):
    c = TestClient(world["app"])
    assert c.post("/api/auth/login", json={"username": name, "password": PW}).status_code == 200
    return c


def test_english_pack_matching(both):
    rep = both["en"]
    assert rep["lang"] == "en"
    assert rep["coverage_without_proper_nouns"] >= 0.9, rep["unmatched"]
    with both["db"].connect() as c:
        def lemma_of(surface):
            return c.execute(text("""SELECT l.lemma, l.lang FROM lecture.token t JOIN lecture.lemma l ON l.id = t.lemma_id
                JOIN lecture.paragraph p ON p.id = t.paragraph_id JOIN lecture.chapter ch ON ch.id = p.chapter_id
                JOIN lecture.article a ON a.id = ch.article_id
                WHERE a.slug = 'test-alice' AND t.surface = :s LIMIT 1"""), {"s": surface}).first()
        assert lemma_of("ran") == ("run", "en")
        assert lemma_of("daisies") == ("daisy", "en")
        assert lemma_of("thought").lang == "en"
        assert lemma_of("Rabbit") == ("rabbit", "en")  # "Rabbit’s" -> Rabbit + ’s
        # the French article only ever points at French entries
        assert c.execute(text("""SELECT count(*) FROM lecture.token t JOIN lecture.lemma l ON l.id = t.lemma_id
            JOIN lecture.paragraph p ON p.id = t.paragraph_id JOIN lecture.chapter ch ON ch.id = p.chapter_id
            JOIN lecture.article a ON a.id = ch.article_id WHERE a.lang <> l.lang""")).scalar() == 0


def test_english_chapter_api(both):
    g = login(both, "grace")
    shelf = {a["slug"]: a["lang"] for a in g.get("/api/articles").json()}
    assert shelf == {"test-alice": "en", FR_PACK["slug"]: "fr"}
    d = g.get(f"/api/articles/{both['en']['article_id']}/chapters/1").json()
    assert d["article"]["lang"] == "en"
    run = next(l for l in d["lemmas"].values() if l["lemma"] == "run")
    assert run["forms"]["past"] == "ran" and run["senses"]
    s = d["senses"][str(run["senses"][0])]
    assert s["def"] and s["key"] is None


def tap_all(client, world, slug, n):
    with world["db"].connect() as c:
        ids = c.execute(text("""SELECT DISTINCT ON (t.lemma_id) t.id FROM lecture.token t
            JOIN lecture.paragraph p ON p.id = t.paragraph_id JOIN lecture.chapter ch ON ch.id = p.chapter_id
            JOIN lecture.article a ON a.id = ch.article_id
            WHERE a.slug = :s AND t.lemma_id IS NOT NULL ORDER BY t.lemma_id, t.id LIMIT :n"""),
                        {"s": slug, "n": n}).scalars().all()
    evs = [{"id": str(uuid.uuid4()), "token_id": i, "self_rating": "unknown", "dwell_ms": 500} for i in ids]
    assert client.post("/api/lookups", json={"events": evs}).status_code == 200


def test_defi_bag_and_report_per_language(both):
    g = login(both, "grace")
    tap_all(g, both, "test-alice", 8)
    tap_all(g, both, FR_PACK["slug"], 6)

    en = g.get("/api/quiz/current?lang=en").json()["quiz"]
    fr = g.get("/api/quiz/current?lang=fr").json()["quiz"]
    assert en["lang"] == "en" and fr["lang"] == "fr" and en["id"] != fr["id"] and en["week_of"] == fr["week_of"]
    with both["db"].connect() as c:
        langs = dict(c.execute(text("""SELECT q.lang, array_agg(DISTINCT l.lang) FROM lecture.quiz q
            JOIN lecture.quiz_item i ON i.quiz_id = q.id JOIN lecture.lemma l ON l.id = i.lemma_id GROUP BY q.lang""")).all())
    assert langs == {"en": ["en"], "fr": ["fr"]}
    assert g.get("/api/quiz/current?lang=en").json()["quiz"]["id"] == en["id"]  # same défi on the next visit
    assert len(en["items"]) == 8

    bag = g.get("/api/words?lang=en").json()
    assert len(bag) == 8 and {w["lang"] for w in bag} == {"en"}
    assert len(g.get("/api/words").json()) == 14

    rep = g.get("/api/me/report?lang=en").json()
    assert rep["lang"] == "en" and [b["title"] for b in rep["books"]] == [] and rep["weeks"][-1]["words"] == 8
    rep_fr = login(both, "ryan").get(f"/api/parent/children/{rep['child']['id']}/report?lang=fr").json()
    assert rep_fr["weeks"][-1]["words"] == 6
    assert g.get("/api/quiz/current?lang=de").status_code == 422
    # leo has tapped nothing
    assert login(both, "leo").get("/api/quiz/current?lang=en").json()["quiz"] is None
