"""Wiktionary import on real wiktextract entries (tests/fixtures/wiktionary_sample.jsonl, CC BY-SA)."""
from pathlib import Path

from sqlalchemy import text

from importer.robert import import_entries as import_robert
from importer.wiktionary import import_entries, iter_entries, nominal_code, verb_code

SAMPLE = str(Path(__file__).parent / "fixtures" / "wiktionary_sample.jsonl")


def robert(headword, pos, homograph=None):
    return {"headword": headword, "homograph": homograph, "pos": pos, "ipa": None, "kind": "word",
            "senses": [{"key": "1", "definition": f"Définition de test ({headword}).", "examples": []}]}


ROBERT = [robert("demander", "verbe transitif"), robert("demande", "nom féminin"),
          robert("livre", "nom masculin", 1), robert("livre", "nom féminin", 2), robert("beau ou bel, belle", "adjectif")]


def forms_of(c, form):
    return {(r.lemma, r.pos): set(r.tags) for r in c.execute(text("""
        SELECT l.lemma, l.pos, f.tags FROM lecture.word_form f JOIN lecture.lemma l ON l.id = f.lemma_id
        WHERE f.form = :f"""), {"f": form})}


def test_codes():
    assert verb_code(["first-person", "indicative", "present", "singular"]) == "ind.pres.1s"
    assert verb_code(["historic", "indicative", "past", "plural", "third-person"]) == "ind.ps.3p"
    assert verb_code(["conditional", "plural", "second-person"]) == "cond.pres.2p"
    assert verb_code(["imperfect", "singular", "subjunctive", "third-person"]) == "subj.impf.3s"
    assert verb_code(["gerund", "participle", "present"]) == "part.pres"
    assert verb_code(["participle", "past"]) == "part.past"
    assert verb_code(["indicative", "multiword-construction", "perfect", "present"]) is None
    assert verb_code(["first-person", "indicative", "present", "reflexive", "singular"]) is None
    assert nominal_code(["masculine", "plural"]) == "m.pl"
    assert nominal_code(["feminine"]) == "f"


def test_import_forms_glosses_and_rerun(db):
    with db.begin() as c:
        import_robert(c, ROBERT)
        stats = import_entries(c, iter_entries(SAMPLE))
        assert stats["lemmas_created"] >= 1  # être, asseoir, falloir … are not in the fake Robert list

        # the case that motivated this: "demande" is both the noun and a form of the verb
        d = forms_of(c, "demande")
        assert {"ind.pres.1s", "ind.pres.3s", "subj.pres.3s", "imp.pres.2s"} <= d[("demander", "VERB")]
        assert ("demande", "NOUN") in d
        # irregular verbs, both conjugations of asseoir, no pronunciations or reflexive duplicates
        assert "ind.pres.3s" in forms_of(c, "est")[("être", "VERB")]
        assert "ind.pres.1s" in forms_of(c, "assieds")[("asseoir", "VERB")]
        assert "ind.pres.1s" in forms_of(c, "assois")[("asseoir", "VERB")]
        assert "ind.pres.3s" in forms_of(c, "faut")[("falloir", "VERB")]
        bad = c.execute(text("""SELECT count(*) FROM lecture.word_form
            WHERE form LIKE '/%' OR form IN ('-', '—') OR form LIKE '% %' OR form LIKE 'm''%'""")).scalar()
        assert bad == 0
        # adjective forms (also fixes spaCy's "beaux" -> "beal")
        assert "m.pl" in forms_of(c, "beaux")[("beau", "ADJ")]
        # English glosses go to the right homograph by gender
        g = dict(c.execute(text("""SELECT l.gender, s.gloss_en FROM lecture.sense s JOIN lecture.lemma l ON l.id = s.lemma_id
            WHERE l.lemma = 'livre' AND s.source = 'wiktionary_en' AND s.seq = 0""")).all())
        assert g["m"] == "book" and g["f"].startswith("pound")
        assert c.execute(text("""SELECT s.gloss_en FROM lecture.sense s JOIN lecture.lemma l ON l.id = s.lemma_id
            WHERE l.lemma = 'demander' AND s.source = 'wiktionary_en' ORDER BY s.seq LIMIT 1""")).scalar()
        # Robert senses untouched
        assert c.execute(text("SELECT count(*) FROM lecture.sense WHERE source = 'petit_robert'")).scalar() == 5
        before = c.execute(text("SELECT (SELECT count(*) FROM lecture.word_form), (SELECT count(*) FROM lecture.sense),"
                                " (SELECT count(*) FROM lecture.lemma)")).one()

    with db.begin() as c:  # re-run: nothing duplicated
        import_entries(c, iter_entries(SAMPLE))
        after = c.execute(text("SELECT (SELECT count(*) FROM lecture.word_form), (SELECT count(*) FROM lecture.sense),"
                               " (SELECT count(*) FROM lecture.lemma)")).one()
        assert tuple(after) == tuple(before)
