"""Verb forms: matching a conjugated verb to its infinitive, tense on tokens, conjugation API, rematch."""
import uuid
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import text

from app.auth import hash_password, lockout
from importer.article import import_pack, rematch, set_status
from importer.robert import import_entries as import_robert
from importer.wiktionary import import_entries as import_wikt, iter_entries

SAMPLE = str(Path(__file__).parent / "fixtures" / "wiktionary_sample.jsonl")


def robert(headword, pos):
    return {"headword": headword, "homograph": None, "pos": pos, "ipa": None, "kind": "word",
            "senses": [{"key": "1", "definition": f"Définition de test ({headword}).", "examples": []}]}


# Like the real Petit Robert: "demande" is only a noun; the verb is "demander".
ROBERT = [robert(w, p) for w, p in [
    ("demander", "verbe transitif"), ("demande", "nom féminin"), ("elle", "pronom personnel"),
    ("me", "pronom personnel"), ("pourquoi", "adverbe"), ("il", "pronom personnel"), ("falloir", "verbe impersonnel"),
    ("partir", "verbe intransitif"), ("le", "article défini"), ("bus", "nom masculin"), ("être", "verbe intransitif"),
    ("là", "adverbe"), ("donner", "verbe transitif"), ("un", "article indéfini"), ("gâteau", "nom masculin")]]

PACK = {"slug": "test-verbes", "title": "Verbes", "week_of": "2026-11-16", "chapters": [{
    "seq": 1, "title": "Un", "paragraphs": [
        "Elle me demande pourquoi.",
        "Il faut partir, le bus est là.",
        "Elle me donne un gâteau."]}]}


def setup(c):
    import_robert(c, ROBERT)
    import_wikt(c, iter_entries(SAMPLE))


def token(c, surface):
    return c.execute(text("""SELECT t.id, l.lemma, l.pos, t.morph FROM lecture.token t
        LEFT JOIN lecture.lemma l ON l.id = t.lemma_id WHERE t.surface = :s ORDER BY t.id LIMIT 1"""),
                     {"s": surface}).one()


def test_conjugated_verbs_match_infinitive_and_keep_tense(db):
    with db.begin() as c:
        setup(c)
        import_pack(c, PACK)
        d = token(c, "demande")
        assert (d.lemma, d.pos) == ("demander", "VERB")  # not the noun "la demande"
        assert "Tense=Pres" in d.morph and "VerbForm=Fin" in d.morph
        assert token(c, "faut").lemma == "falloir"
        assert token(c, "donne").lemma == "donner"
        assert token(c, "est").lemma == "être"


def test_rematch_keeps_token_ids_and_lookups(db):
    with db.begin() as c:
        import_robert(c, ROBERT)  # no Wiktionary yet: "demande" lands on the noun
        import_pack(c, PACK)
        before = token(c, "demande")
        assert before.lemma == "demande"
        uid = c.execute(text("INSERT INTO lecture.app_user (username, display_name, password_hash, role) "
                             "VALUES ('g','g','x','student') RETURNING id")).scalar()
        c.execute(text("INSERT INTO lecture.lookup_event (user_id, token_id) VALUES (:u, :t)"),
                  {"u": uid, "t": before.id})
        ids = list(c.execute(text("SELECT id FROM lecture.token ORDER BY id")).scalars())

        import_wikt(c, iter_entries(SAMPLE))
        rep = rematch(c, "test-verbes")
        after = token(c, "demande")
        assert after.id == before.id and after.lemma == "demander"
        assert rep["lemma_changed"] >= 1
        assert list(c.execute(text("SELECT id FROM lecture.token ORDER BY id")).scalars()) == ids
        assert c.execute(text("SELECT count(*) FROM lecture.lookup_event")).scalar() == 1


def test_chapter_payload_and_conjugation_table(db):
    lockout.fails.clear(); lockout.until.clear()
    with db.begin() as c:
        setup(c)
        import_pack(c, PACK)
        set_status(c, "test-verbes", "published")
        c.execute(text("INSERT INTO lecture.app_user (username, display_name, password_hash, role) "
                       "VALUES ('grace','Grace',:h,'student')"), {"h": hash_password("pw123456")})
        aid = c.execute(text("SELECT id FROM lecture.article")).scalar()
    from app.main import app
    cl = TestClient(app)
    cl.post("/api/auth/login", json={"username": "grace", "password": "pw123456"})
    d = cl.get(f"/api/articles/{aid}/chapters/1").json()
    tok = next(t for p in d["paragraphs"] for t in p["tokens"] if p["text"][t[1]:t[2]] == "demande")
    assert "Tense=Pres" in tok[5]
    lem = d["lemmas"][str(tok[3])]
    assert lem["lemma"] == "demander" and lem["en"]  # English gloss available
    noun = next(t for p in d["paragraphs"] for t in p["tokens"] if p["text"][t[1]:t[2]] == "gâteau")
    assert noun[5] is None  # grammar only sent for verb forms

    conj = cl.get(f"/api/lemmas/{tok[3]}/conjugation").json()
    pres = next(t for t in conj["tenses"] if t["key"] == "ind.pres")
    assert pres["label"] == "Présent"
    assert pres["forms"]["1s"] == ["demande"] and pres["forms"]["1p"] == ["demandons"]
    assert [t["key"] for t in conj["tenses"]][:4] == ["ind.pres", "ind.impf", "ind.ps", "ind.fut"]
    assert conj["participle_past"] == ["demandé"]
    assert "Wiktionary" in conj["source"]
    assert cl.get(f"/api/lemmas/{noun[3]}/conjugation").status_code == 404  # not a verb
