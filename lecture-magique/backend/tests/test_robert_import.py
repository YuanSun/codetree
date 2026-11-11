"""Dictionary import with hand-written fake entries (no Petit Robert content in tests)."""
from sqlalchemy import text

from importer.headword import apply_suffix, map_pos, normalize_headword
from importer.robert import import_entries


def fake(headword, pos, senses, homograph=None, kind="word", ipa=None):
    return {"headword": headword, "homograph": homograph, "pos": pos, "ipa": ipa, "kind": kind,
            "senses": [{"key": k, "definition": d, "examples": ex} for k, d, ex in senses]}


ENTRIES = [
    fake("entamer", "verbe transitif", [
        ("I", "Sens général inventé.", []),
        ("I.1", "Faire une petite coupure (définition de test).", ["Ex un.", "Ex deux."]),
        ("I.2", "Commencer à manger quelque chose d'intact (définition de test).", ["Le gâteau entamé."]),
        ("I.3", "Troisième sens de test.", []),
        ("II.1", "Commencer une action (test).", ["Entamer une discussion."]),
        ("II.2", "Sixième sens de test.", ["a", "b", "c", "d", "e", "f", "g", "h"]),
    ], ipa="ɑ̃tame"),
    fake("tubéreux, euse", "adjectif", [("", "Qui a des renflements (test).", [])]),
    fake("livre", "nom masculin", [("1", "Objet pour lire (test).", [])], homograph=1),
    fake("livre", "nom féminin", [("1", "Unité de poids (test).", [])], homograph=2),
    fake("V. Hugo ", None, [("", "Auteur.", [])], kind="author"),
]


def counts(c):
    return c.execute(text(
        "SELECT (SELECT count(*) FROM lecture.lemma), (SELECT count(*) FROM lecture.sense),"
        " (SELECT count(*) FROM lecture.word_form)")).one()


def test_import_senses_forms_homographs_and_rerun_is_idempotent(db):
    with db.begin() as c:
        stats = import_entries(c, ENTRIES)
        assert stats["authors"] == 1
        first = counts(c)
        rows = c.execute(text("""SELECT s.sense_key, s.definition_fr, jsonb_array_length(s.raw->'examples')
            FROM lecture.sense s JOIN lecture.lemma l ON l.id = s.lemma_id
            WHERE l.lemma = 'entamer' ORDER BY s.seq""")).all()
        assert len(rows) == 6
        assert [r[0] for r in rows] == ["I", "I.1", "I.2", "I.3", "II.1", "II.2"]
        assert rows[2][1].startswith("Commencer à manger")
        assert rows[5][2] == 6  # at most 6 examples
        lem = c.execute(text("SELECT lemma, pos, ipa FROM lecture.lemma WHERE lemma='entamer'")).one()
        assert (lem.pos, lem.ipa) == ("VERB", "ɑ̃tame")
        fem = c.execute(text("""SELECT l.lemma, l.pos FROM lecture.word_form f JOIN lecture.lemma l
            ON l.id = f.lemma_id WHERE f.form = 'tubéreuse'""")).one()
        assert tuple(fem) == ("tubéreux", "ADJ")
        livres = c.execute(text(
            "SELECT homograph, gender FROM lecture.lemma WHERE lemma='livre' ORDER BY homograph")).all()
        assert [tuple(r) for r in livres] == [(1, "m"), (2, "f")]
        assert c.execute(text("SELECT count(*) FROM lecture.lemma WHERE lemma LIKE '%Hugo%'")).scalar() == 0

    with db.begin() as c:  # second run: same counts, updated text
        ENTRIES[0]["senses"][2]["definition"] = "Commencer à manger (version 2)."
        import_entries(c, ENTRIES)
        assert counts(c) == first
        d = c.execute(text("""SELECT s.definition_fr FROM lecture.sense s JOIN lecture.lemma l ON l.id=s.lemma_id
            WHERE l.lemma='entamer' AND s.sense_key='I.2'""")).scalar_one()
        assert d == "Commencer à manger (version 2)."

    with db.begin() as c:  # entry shrank: extra senses removed
        short = [fake("entamer", "verbe transitif", [("I.1", "Seul sens.", [])])]
        import_entries(c, short)
        n = c.execute(text("""SELECT count(*) FROM lecture.sense s JOIN lecture.lemma l ON l.id=s.lemma_id
            WHERE l.lemma='entamer'""")).scalar()
        assert n == 1


def test_apply_suffix():
    assert apply_suffix("tubéreux", "euse") == "tubéreuse"
    assert apply_suffix("actif", "ive") == "active"
    assert apply_suffix("cheval", "aux") == "chevaux"
    assert apply_suffix("léger", "ère") == "légère"
    assert apply_suffix("gentil", "ille") == "gentille"
    assert apply_suffix("bas", "basse") == "basse"
    assert apply_suffix("sec", "sèche") == "sèche"
    assert apply_suffix("chanteur", "euse") == "chanteuse"


def test_normalize_headword_variants():
    hw = normalize_headword("beau ou bel, belle")
    assert hw.lemma == "beau"
    assert ("bel", "variant") in hw.forms and ("belle", "inflection") in hw.forms
    assert normalize_headword("2. livre").lemma == "livre"
    assert normalize_headword("peut-être").lemma == "peut-être"


def test_map_pos():
    assert map_pos("verbe transitif") == ("VERB", None)
    assert map_pos("nom féminin") == ("NOUN", "f")
    assert map_pos("nom masculin") == ("NOUN", "m")
    assert map_pos("n. m.") == ("NOUN", "m")
    assert map_pos("nom masculin et féminin") == ("NOUN", None)
    assert map_pos("adjectif") == ("ADJ", None)
    assert map_pos("adverbe") == ("ADV", None)
    assert map_pos("préposition") == ("ADP", None)
    assert map_pos("conjonction de subordination") == ("SCONJ", None)
    assert map_pos("conjonction") == ("CCONJ", None)
    assert map_pos("pronom personnel") == ("PRON", None)
    assert map_pos("interjection") == ("INTJ", None)
    assert map_pos("article défini") == ("DET", None)
    assert map_pos("adjectif numéral cardinal") == ("NUM", None)
    assert map_pos(None) == ("X", None)
