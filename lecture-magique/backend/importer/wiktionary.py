"""Import French data from English Wiktionary (wiktextract JSONL published by kaikki.org).

    uv run python -m importer.wiktionary                         # streams the file from kaikki.org (~590 MB)
    uv run python -m importer.wiktionary ~/Downloads/kaikki.org-dictionary-French.jsonl

What it adds (re-runnable: rows are upserted, never duplicated):
- word_form: every conjugated verb form with compact codes ("demande" -> demander: ind.pres.1s,
  ind.pres.3s, subj.pres.1s, ...), and noun/adjective forms ("beaux" -> beau: m.pl). The article
  importer uses these to find the verb behind a conjugated word, and the word card's conjugation
  table is built from them.
- sense rows with source='wiktionary_en': short English glosses (used by the weekly review and as
  a fallback on the card when Petit Robert has no entry).
- lemma rows for verbs/nouns/adjectives/adverbs that Petit Robert does not have.

Wiktionary is CC BY-SA (Wiktionary contributors); the card credits it next to the table.
"""
import argparse
import gzip
import io
import json
import sys
import time
import urllib.request
from collections.abc import Iterable, Iterator

from sqlalchemy import Connection, text

from app.config import settings
from app.db import get_engine

URL = "https://kaikki.org/dictionary/French/kaikki.org-dictionary-French.jsonl"
SOURCE = "wiktionary_en"
MAX_GLOSSES = 8
BATCH = 2000

POS = {"verb": "VERB", "noun": "NOUN", "adj": "ADJ", "adv": "ADV", "pron": "PRON", "prep": "ADP",
       "conj": "CCONJ", "intj": "INTJ", "num": "NUM", "det": "DET", "article": "DET"}
CREATE_POS = {"VERB", "NOUN", "ADJ", "ADV"}  # lemmas we add when Petit Robert lacks them

PERSON = {"first-person": "1", "second-person": "2", "third-person": "3"}
NUMBER = {"singular": "s", "plural": "p"}
SKIP_TAGS = {"multiword-construction", "reflexive", "table-tags", "inflection-template", "alternative",
             "romanization", "obsolete", "archaic"}

# Conjugation table order and French labels (also used by the API).
TENSES = [
    ("ind.pres", "Présent"), ("ind.impf", "Imparfait"), ("ind.ps", "Passé simple"), ("ind.fut", "Futur simple"),
    ("cond.pres", "Conditionnel présent"), ("subj.pres", "Subjonctif présent"),
    ("subj.impf", "Subjonctif imparfait"), ("imp.pres", "Impératif"),
]
PERSONS = ["1s", "2s", "3s", "1p", "2p", "3p"]


def verb_code(tags: list[str]) -> str | None:
    """wiktextract tags -> 'ind.pres.3s', 'part.past', 'inf' ...; None for rows we do not keep."""
    t = set(tags)
    if t & SKIP_TAGS:
        return None
    if "infinitive" in t:
        return "inf"
    if "participle" in t:
        return "part.pres" if "present" in t else "part.past" if "past" in t else None
    if "indicative" in t:
        mood = "ind"
        tense = ("pres" if "present" in t else "impf" if "imperfect" in t else
                 "ps" if "historic" in t else "fut" if "future" in t else None)
    elif "subjunctive" in t:
        mood, tense = "subj", ("pres" if "present" in t else "impf" if "imperfect" in t else None)
    elif "conditional" in t:
        mood, tense = "cond", "pres"
    elif "imperative" in t:
        mood, tense = "imp", "pres"
    else:
        return None
    person = next((PERSON[x] for x in t if x in PERSON), None)
    number = next((NUMBER[x] for x in t if x in NUMBER), None)
    if not tense or not person or not number:
        return None
    return f"{mood}.{tense}.{person}{number}"


def nominal_code(tags: list[str]) -> str | None:
    t = set(tags)
    if t & SKIP_TAGS:
        return None
    g = "f" if "feminine" in t else "m" if "masculine" in t else ""
    n = "pl" if "plural" in t else ""
    code = ".".join(x for x in (g, n) if x)
    return code or None


def usable_form(form: str, upos: str) -> bool:
    if not form or form in {"-", "—", "–"} or form.startswith("/") or " " in form:
        return False
    if upos == "VERB" and ("'" in form or "’" in form):  # pronominal duplicates: m'assois, s'en est
        return False
    return True


def entry_forms(e: dict, upos: str) -> dict[str, set[str]]:
    """form (lowercase) -> codes, for one entry."""
    out: dict[str, set[str]] = {}
    for f in e.get("forms") or []:
        form = (f.get("form") or "").strip()
        if not usable_form(form, upos):
            continue
        tags = f.get("tags") or []
        code = verb_code(tags) if upos == "VERB" and f.get("source") == "conjugation" else (
            nominal_code(tags) if upos in ("NOUN", "ADJ") else None)
        if code:
            out.setdefault(form.lower(), set()).add(code)
    return out


def entry_glosses(e: dict) -> list[str]:
    out = []
    for s in e.get("senses") or []:
        if s.get("form_of") or "form-of" in (s.get("tags") or []):
            continue
        g = s.get("glosses") or []
        if g:
            gl = " : ".join(x.strip().rstrip(":") for x in g if x.strip())
            if gl and gl not in out:
                out.append(gl)
    return out[:MAX_GLOSSES]


def entry_gender(e: dict) -> str | None:
    tags = {t for s in e.get("senses") or [] for t in (s.get("tags") or [])}
    if "feminine" in tags and "masculine" not in tags:
        return "f"
    if "masculine" in tags and "feminine" not in tags:
        return "m"
    return None


def iter_entries(src: str) -> Iterator[dict]:
    if src.startswith(("http://", "https://")):
        raw = urllib.request.urlopen(src)  # noqa: S310 - fixed public data source
        stream = io.TextIOWrapper(gzip.GzipFile(fileobj=raw) if src.endswith(".gz") else raw, encoding="utf-8")
    else:
        stream = (gzip.open(src, "rt", encoding="utf-8") if src.endswith(".gz") else open(src, encoding="utf-8"))
    with stream:
        for line in stream:
            if line.strip():
                try:
                    yield json.loads(line)
                except json.JSONDecodeError:
                    continue


class LemmaIndex:
    def __init__(self, conn: Connection):
        self.rows: dict[tuple[str, str], list[tuple[int, int, str | None]]] = {}
        for lid, lemma, pos, hom, gender in conn.execute(
                text("SELECT id, lemma, pos, homograph, gender FROM lecture.lemma")):
            self.rows.setdefault((lemma.lower(), pos), []).append((lid, hom, gender))

    def find_or_create(self, conn: Connection, word: str, upos: str, e: dict, stats: dict) -> list[int]:
        key = (word.lower(), upos)
        if key not in self.rows:
            if upos not in CREATE_POS:
                return []
            ipa = next((s["ipa"].strip("/[]") for s in e.get("sounds") or [] if s.get("ipa")), None)
            lid = conn.execute(text("""
                INSERT INTO lecture.lemma (lemma, pos, homograph, gender, ipa) VALUES (:l, :p, 0, :g, :i)
                ON CONFLICT (lemma, pos, homograph) DO UPDATE SET lemma = EXCLUDED.lemma RETURNING id"""),
                {"l": word, "p": upos, "g": entry_gender(e) if upos == "NOUN" else None, "i": ipa}).scalar_one()
            self.rows[key] = [(lid, 0, None)]
            stats["lemmas_created"] += 1
        return [r[0] for r in self.rows[key]]

    def gloss_target(self, word: str, upos: str, e: dict) -> int | None:
        """Homographs (livre m. / livre f.): attach glosses to the one with the matching gender."""
        rows = self.rows.get((word.lower(), upos)) or []
        if not rows:
            return None
        g = entry_gender(e)
        return next((lid for lid, _, gender in rows if g and gender == g), rows[0][0])


def import_entries(conn: Connection, entries: Iterable[dict]) -> dict:
    idx = LemmaIndex(conn)
    stats = {"entries": 0, "used": 0, "lemmas_created": 0, "forms": 0, "glossed_lemmas": 0}
    forms: dict[tuple[str, int], set[str]] = {}
    glosses: dict[int, list[str]] = {}
    for e in entries:
        stats["entries"] += 1
        if e.get("lang_code", "fr") != "fr":
            continue
        upos = POS.get(e.get("pos") or "")
        word = (e.get("word") or "").strip()
        if not upos or not word:
            continue
        gl = entry_glosses(e)
        if not gl:  # inflection-only entries ("demande", verb: "inflection of demander") add nothing new
            continue
        lemma_ids = idx.find_or_create(conn, word, upos, e, stats)
        if not lemma_ids:
            continue
        stats["used"] += 1
        for form, codes in entry_forms(e, upos).items():
            for lid in lemma_ids:
                forms.setdefault((form, lid), set()).update(codes)
        target = idx.gloss_target(word, upos, e)
        if target is not None:
            for g in gl:
                if g not in glosses.setdefault(target, []) and len(glosses[target]) < MAX_GLOSSES:
                    glosses[target].append(g)

    rows = [{"form": f, "lid": lid, "tags": sorted(codes)} for (f, lid), codes in forms.items()]
    for i in range(0, len(rows), BATCH):
        conn.execute(text("""
            INSERT INTO lecture.word_form (form, lemma_id, tags) VALUES (:form, :lid, :tags)
            ON CONFLICT (form, lemma_id) DO UPDATE SET tags = ARRAY(
                SELECT DISTINCT x FROM unnest(lecture.word_form.tags || EXCLUDED.tags) AS x ORDER BY x)"""),
            rows[i:i + BATCH])
    stats["forms"] = len(rows)

    srows, keep = [], []
    for lid, gl in glosses.items():
        keep.append({"lid": lid, "n": len(gl)})
        for seq, g in enumerate(gl):
            srows.append({"lid": lid, "seq": seq, "g": g})
    for i in range(0, len(srows), BATCH):
        conn.execute(text("""
            INSERT INTO lecture.sense (lemma_id, source, seq, gloss_en) VALUES (:lid, 'wiktionary_en', :seq, :g)
            ON CONFLICT (lemma_id, source, seq) DO UPDATE SET gloss_en = EXCLUDED.gloss_en"""), srows[i:i + BATCH])
    for i in range(0, len(keep), BATCH):
        conn.execute(text("""
            UPDATE lecture.token t SET sense_id = NULL FROM lecture.sense s
            WHERE t.sense_id = s.id AND s.lemma_id = :lid AND s.source = 'wiktionary_en' AND s.seq >= :n"""),
            keep[i:i + BATCH])
        conn.execute(text("""DELETE FROM lecture.sense
            WHERE lemma_id = :lid AND source = 'wiktionary_en' AND seq >= :n"""), keep[i:i + BATCH])
    stats["glossed_lemmas"] = len(glosses)
    return stats


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("source", nargs="?", default=URL, help="JSONL(.gz) path or URL (default: kaikki.org)")
    a = ap.parse_args(argv)
    t = time.time()
    print(f"reading {a.source} …", file=sys.stderr)
    with get_engine(settings.admin_url or None).begin() as conn:
        stats = import_entries(conn, iter_entries(a.source))
    stats["seconds"] = round(time.time() - t, 1)
    print(json.dumps(stats, ensure_ascii=False))


if __name__ == "__main__":
    main()
