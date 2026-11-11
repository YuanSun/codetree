"""Article import on a public-domain text (Jules Verne, 1872) with an invented mini dictionary."""
import json
import re
from pathlib import Path

import pytest
from sqlalchemy import text

from importer.article import ImportRefused, guess_lemmas, import_pack, set_status
from importer.robert import import_entries

PACK = json.loads((Path(__file__).parent / "fixtures" / "verne_pack.json").read_text(encoding="utf-8"))

# (headword as Robert writes it, POS label). Definitions are invented placeholders.
WORDS = """en:préposition le:article défini année:nom féminin maison:nom féminin porter:verbe transitif
numéro:nom masculin de:préposition dans:préposition lequel, laquelle:pronom relatif mourir:verbe intransitif
être:verbe intransitif habiter:verbe transitif par:préposition un, une:article indéfini membre:nom masculin
plus:adverbe singulier, ière:adjectif et:conjonction remarquer:verbe transitif club:nom masculin
bien:adverbe que:conjonction il:pronom personnel sembler:verbe intransitif prendre:verbe transitif à:préposition
tâche:nom féminin ne:adverbe rien:pronom indéfini faire:verbe transitif qui:pronom relatif pouvoir:verbe transitif
attirer:verbe transitif attention:nom féminin grand, grande:adjectif orateur, trice:nom honorer:verbe transitif
succéder:verbe transitif donc:conjonction ce:pronom démonstratif personnage:nom masculin énigmatique:adjectif
dont:pronom relatif on:pronom personnel savoir:verbe transitif sinon:conjonction fort, forte:adjectif
galant, ante:adjectif homme:nom masculin beau ou bel, belle:adjectif gentleman:nom masculin haut, haute:adjectif
société:nom féminin anglais, aise:adjectif vous:pronom personnel français, aise:adjectif nommer:verbe transitif
lui:pronom personnel demander:verbe transitif déplaire:verbe transitif monsieur:nom masculin
répondre:verbe transitif nouveau ou nouvel, nouvelle:adjectif venir:verbe intransitif surnom:nom masculin
me:pronom personnel rester:verbe intransitif justifier:verbe transitif mon:adjectif possessif aptitude:nom féminin
naturel, elle:adjectif se:pronom personnel tirer:verbe transitif affaire:nom féminin peut-être:adverbe"""


POS_WORDS = r"(?: (?:défini|indéfini|transitif|intransitif|féminin|masculin|relatif|personnel|démonstratif|possessif))*"


def dictionary():
    """Parse WORDS ("headword:pos label" pairs) into robert_extract-shaped entries."""
    entries = []
    for hw, pos in re.findall(r"([^:]+?):(\S+" + POS_WORDS + r")\s*", WORDS.replace("\n", " ")):
        hw = hw.strip()
        entries.append({"headword": hw, "homograph": None, "pos": pos, "ipa": None, "kind": "word",
                        "senses": [{"key": "1", "definition": f"Définition de test pour {hw}.", "examples": []},
                                   {"key": "2", "definition": "Deuxième sens de test.", "examples": []}]})
    return entries


@pytest.fixture
def loaded(db):
    with db.begin() as c:
        import_entries(c, dictionary())
    return db


def rebuild(paragraph_text, toks):
    out, pos = "", 0
    for t in toks:
        assert paragraph_text[t.char_start:t.char_end] == t.surface
        out += paragraph_text[pos:t.char_start] + t.surface
        pos = t.char_end
    return out + paragraph_text[pos:]


def test_import_draft_tokens_offsets_and_coverage(loaded):
    with loaded.begin() as c:
        rep = import_pack(c, PACK)
    assert rep["status"] == "draft"
    assert rep["coverage_without_proper_nouns"] >= 0.95, rep["unmatched"]
    proper = {u["surface"] for u in rep["unmatched"]}
    assert {"Phileas", "Fogg"} <= proper
    with loaded.connect() as c:
        paras = c.execute(text("SELECT id, text FROM lecture.paragraph ORDER BY id")).all()
        for pid, ptext in paras:
            toks = c.execute(text("SELECT surface, char_start, char_end FROM lecture.token "
                                  "WHERE paragraph_id=:p ORDER BY seq"), {"p": pid}).all()
            assert rebuild(ptext, toks) == ptext
        row = lambda s: c.execute(text("""SELECT l.lemma, t.sense_id IS NOT NULL AS has_sense, t.needs_review,
            s.seq FROM lecture.token t LEFT JOIN lecture.lemma l ON l.id=t.lemma_id
            LEFT JOIN lecture.sense s ON s.id=t.sense_id WHERE t.surface=:s LIMIT 1"""), {"s": s}).one()
        assert row("l'")[:2] == ("le", True)
        assert row("l'").seq == 0  # first sense
        assert row("était")[0] == "être"
        assert row("beaux")[0] == "beau"
        assert row("n’")[0] == "ne"
        assert row("Peut-être")[0] == "peut-être"
        assert row("Phileas")[2] is True
        assert c.execute(text("SELECT count(*) FROM lecture.token WHERE surface=',' AND is_word")).scalar() == 0
        assert c.execute(text("SELECT count(*) FROM lecture.question")).scalar() == 2
        assert c.execute(text("SELECT status FROM lecture.article")).scalar() == "draft"


def test_reimport_replaces_then_refuses_once_lookups_exist(loaded):
    with loaded.begin() as c:
        import_pack(c, PACK)
        import_pack(c, PACK)
        assert c.execute(text("SELECT count(*) FROM lecture.article")).scalar() == 1
        assert c.execute(text("SELECT count(*) FROM lecture.chapter")).scalar() == 2
        set_status(c, PACK["slug"], "published")
        uid = c.execute(text("INSERT INTO lecture.app_user (username, display_name, password_hash, role) "
                             "VALUES ('u','u','x','student') RETURNING id")).scalar()
        tid = c.execute(text("SELECT min(id) FROM lecture.token WHERE is_word")).scalar()
        c.execute(text("INSERT INTO lecture.lookup_event (user_id, token_id) VALUES (:u, :t)"), {"u": uid, "t": tid})
        with pytest.raises(ImportRefused):
            import_pack(c, PACK)


def test_guess_lemmas():
    assert "beau" in guess_lemmas("beaux")
    assert "remarquer" in guess_lemmas("remarqués")
    assert "naturel" in guess_lemmas("naturelle")
