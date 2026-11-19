"""Import the English dictionary from English Wiktionary (wiktextract JSONL published by kaikki.org).

    uv run python -m importer.wiktionary_en                          # streams the .gz from kaikki.org (~530 MB)
    uv run python -m importer.wiktionary_en ~/Downloads/kaikki.org-dictionary-English.jsonl.gz

Writes lemma rows with lang='en', and per lemma up to 6 senses with source='wiktionary_en'
(gloss_en = the English definition, raw.examples = up to 2 short examples), plus word_form rows
for inflected forms ("ran" -> run: past; "children" -> child: pl; "thinner" -> thin: cmp).

Kept: nouns, verbs, adjectives, adverbs and the small closed classes (pronouns, prepositions...).
Left out: proper names, phrases with spaces, and senses tagged obsolete / archaic / rare / vulgar /
offensive / derogatory (a lemma with only such senses is skipped).

Spelling variants ("colour": "Commonwealth … spelling of color"; "brand-new": "Alternative form of brand
new") get the definitions of the main entry, including two-word entries such as "brand new".

Re-runnable: lemmas are upserted on (lang, lemma, pos, homograph), senses on (lemma_id, source, seq),
extra senses from an earlier import are removed. Several Wiktionary entries for the same word and part
of speech (different etymologies: "bank") are merged into one lemma.

Wiktionary is CC BY-SA (Wiktionary contributors); the card credits it.
"""
import argparse
import json
import re
import sys
import time
from collections.abc import Iterable

from sqlalchemy import Column, Connection, Integer, MetaData, SmallInteger, Table, Text, text
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.config import settings
from app.db import get_engine

from .wiktionary import iter_entries

URL = "https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl.gz"
LANG = "en"
SOURCE = "wiktionary_en"
MAX_SENSES = 6
MAX_EXAMPLES = 2
MAX_EXAMPLE_LEN = 160
FLUSH_EVERY = 5000
BATCH = 1000

POS = {"noun": "NOUN", "verb": "VERB", "adj": "ADJ", "adv": "ADV", "pron": "PRON", "prep": "ADP",
       "conj": "CCONJ", "intj": "INTJ", "num": "NUM", "det": "DET", "article": "DET", "particle": "PART",
       "contraction": "X"}
BAD_SENSE = {"obsolete", "archaic", "rare", "vulgar", "offensive", "derogatory", "ethnic", "slur",
             "misspelling", "nonstandard", "dialectal", "pronunciation-spelling"}
BAD_FORM = BAD_SENSE | {"alternative", "colloquial", "table-tags", "inflection-template", "romanization"}

LEMMA = Table("lemma", MetaData(schema="lecture"),
              Column("id", Integer, primary_key=True), Column("lemma", Text), Column("pos", Text),
              Column("homograph", SmallInteger), Column("ipa", Text), Column("lang", Text))


def form_code(tags: Iterable[str]) -> str | None:
    """wiktextract tags of an inflected form -> compact code (also used on the card)."""
    t = set(tags)
    if t & BAD_FORM:
        return None
    if "participle" in t:
        return "pp" if "past" in t else "ing" if "present" in t else None
    if "past" in t:
        return "past"
    if "third-person" in t and "singular" in t and "present" in t:
        return "3s"
    if "plural" in t:
        return "pl"
    if "comparative" in t:
        return "cmp"
    if "superlative" in t:
        return "sup"
    return None


def usable(word: str) -> bool:
    return bool(word) and " " not in word and len(word) <= 40 and not word.startswith(("-", "'"))


def clean_example(s: str) -> str | None:
    s = re.sub(r"\s+", " ", s or "").strip()
    if not s or len(s) > MAX_EXAMPLE_LEN or "[…]" in s or "ſ" in s:
        return None
    return s


ALT_RE = re.compile(r"^(?:[\w ,'()-]+ )?(?:spelling|form) of ([\w' -]+?)\.?$")
MULTI_POS = {"NOUN", "VERB", "ADJ", "ADV"}


def alt_target(e: dict) -> str | None:
    """'brand new' for brand-new, 'color' for colour: when every sense only points to another spelling."""
    targets = set()
    for s in e.get("senses") or []:
        tags = set(s.get("tags") or [])
        if s.get("form_of") or "form-of" in tags or tags & BAD_SENSE:
            continue
        alt = [a.get("word") for a in s.get("alt_of") or [] if a.get("word")]
        g = (s.get("glosses") or [""])[-1].strip()
        m = ALT_RE.match(g) if "spelling of" in g or g.lower().startswith("alternative form of") else None
        if alt:
            targets.add(alt[0].strip())
        elif m:
            targets.add(m.group(1).strip())
        else:
            return None  # has a real definition of its own
    return targets.pop() if len(targets) == 1 else None


def entry_senses(e: dict) -> list[dict]:
    out, seen = [], set()
    for s in e.get("senses") or []:
        tags = set(s.get("tags") or [])
        if s.get("form_of") or "form-of" in tags or tags & BAD_SENSE:
            continue
        g = [x.strip() for x in (s.get("glosses") or []) if x.strip()]
        if not g:
            continue
        gloss = g[-1]  # most specific: "To move forward quickly upon two feet…" rather than "To move swiftly."
        if gloss in seen:
            continue
        seen.add(gloss)
        ex = [c for c in (clean_example(x.get("text")) for x in s.get("examples") or []) if c][:MAX_EXAMPLES]
        out.append({"gloss": gloss, "examples": ex})
        if len(out) == MAX_SENSES:
            break
    return out


def entry_ipa(e: dict) -> str | None:
    ipas = [s["ipa"] for s in e.get("sounds") or [] if s.get("ipa")]
    us = [s["ipa"] for s in e.get("sounds") or [] if s.get("ipa") and "US" in (s.get("tags") or [])]
    ipa = (us or ipas or [None])[0]
    return ipa.strip("/[]") if ipa else None


class Importer:
    def __init__(self, conn: Connection):
        self.conn = conn
        self.ids: dict[tuple[str, str], int] = {}          # (word, upos) -> lemma id (written)
        self.n_senses: dict[int, int] = {}                  # lemma id -> senses written
        self.pending: dict[tuple[str, str], dict] = {}      # waiting to be written
        self.forms: dict[tuple[str, str, str], set[str]] = {}  # (form, word, upos) -> codes
        self.alts: dict[tuple[str, str], str] = {}           # (word, upos) -> main spelling
        self.multi: dict[tuple[str, str], list[dict]] = {}   # senses of "brand new"-like entries (not lemmas)
        self.stats = {"entries": 0, "lemmas": 0, "senses": 0, "forms": 0, "form_of": 0, "variants": 0}

    def add(self, e: dict) -> None:
        self.stats["entries"] += 1
        if e.get("lang_code", LANG) != LANG:
            return
        upos = POS.get(e.get("pos") or "")
        word = (e.get("word") or "").strip()
        if upos in MULTI_POS and " " in word and len(word) <= 40:  # possible target of a spelling variant
            senses = entry_senses(e)[:3]
            if senses:
                self.multi.setdefault((word, upos), senses)
            return
        if not upos or not usable(word):
            return
        # inflected-form entries: "ran" (verb) = simple past of run
        for s in e.get("senses") or []:
            for fo in s.get("form_of") or []:
                target = (fo.get("word") or "").strip()
                code = form_code(s.get("tags") or [])
                if code and usable(target):
                    self.forms.setdefault((word.lower(), target, upos), set()).add(code)
                    self.stats["form_of"] += 1
        senses = entry_senses(e)
        if not senses:
            return
        key = (word, upos)
        target = alt_target(e)
        if target and target.lower() != word.lower():
            self.alts.setdefault(key, target)
        item = self.pending.get(key)
        if item is None:
            item = self.pending[key] = {"ipa": entry_ipa(e), "senses": []}
        for s in senses:
            if len(item["senses"]) < MAX_SENSES and s["gloss"] not in {x["gloss"] for x in item["senses"]}:
                item["senses"].append(s)
        for f in e.get("forms") or []:
            form = (f.get("form") or "").strip()
            code = form_code(f.get("tags") or [])
            if code and usable(form) and form.lower() != word.lower():
                self.forms.setdefault((form.lower(), word, upos), set()).add(code)
        if len(self.pending) >= FLUSH_EVERY:
            self.flush()

    def flush(self) -> None:
        keys = list(self.pending)
        for i in range(0, len(keys), BATCH):
            chunk = keys[i:i + BATCH]
            rows = [{"lang": LANG, "lemma": w, "pos": p, "homograph": 0, "ipa": self.pending[(w, p)]["ipa"]}
                    for w, p in chunk]
            stmt = pg_insert(LEMMA).values(rows)
            stmt = stmt.on_conflict_do_update(
                index_elements=[LEMMA.c.lang, LEMMA.c.lemma, LEMMA.c.pos, LEMMA.c.homograph],
                set_={"ipa": stmt.excluded.ipa},
            ).returning(LEMMA.c.id, LEMMA.c.lemma, LEMMA.c.pos)
            new_ids = {(r.lemma, r.pos): r.id for r in self.conn.execute(stmt)}
            srows = []
            for k in chunk:
                lid = new_ids[k]
                start = self.n_senses.get(lid, 0)  # same word met again after a flush: append
                if k not in self.ids:
                    self.stats["lemmas"] += 1
                self.ids[k] = lid
                for seq, s in enumerate(self.pending[k]["senses"][: MAX_SENSES - start], start=start):
                    srows.append({"lid": lid, "seq": seq, "g": s["gloss"],
                                  "raw": json.dumps({"examples": s["examples"]}, ensure_ascii=False)})
                self.n_senses[lid] = start + len(self.pending[k]["senses"][: MAX_SENSES - start])
            if srows:
                self.conn.execute(text("""
                    INSERT INTO lecture.sense (lemma_id, source, seq, gloss_en, raw)
                    VALUES (:lid, 'wiktionary_en', :seq, :g, CAST(:raw AS jsonb))
                    ON CONFLICT (lemma_id, source, seq) DO UPDATE SET gloss_en = EXCLUDED.gloss_en, raw = EXCLUDED.raw"""),
                    srows)
                self.stats["senses"] += len(srows)
        self.pending.clear()

    def _resolve_variants(self) -> None:
        """Replace "Alternative form of X" with X's definitions (X from the database or from self.multi)."""
        rows = []
        for (word, upos), target in self.alts.items():
            lid = self.ids.get((word, upos))
            if lid is None:
                continue
            tid = self.ids.get((target, upos)) or self.ids.get((target.lower(), upos))
            if tid:
                n = self.conn.execute(text("""
                    INSERT INTO lecture.sense (lemma_id, source, seq, gloss_en, raw)
                    SELECT :lid, source, seq, gloss_en, raw FROM lecture.sense
                    WHERE lemma_id = :tid AND source = 'wiktionary_en'
                    ON CONFLICT (lemma_id, source, seq) DO UPDATE SET gloss_en = EXCLUDED.gloss_en, raw = EXCLUDED.raw"""),
                    {"lid": lid, "tid": tid}).rowcount
                if n:
                    self.n_senses[lid] = n
                    self.stats["variants"] += 1
            elif (target, upos) in self.multi:
                senses = self.multi[(target, upos)]
                rows += [{"lid": lid, "seq": i, "g": s["gloss"], "raw": json.dumps({"examples": s["examples"]},
                                                                                     ensure_ascii=False)}
                         for i, s in enumerate(senses)]
                self.n_senses[lid] = len(senses)
                self.stats["variants"] += 1
        for i in range(0, len(rows), BATCH):
            self.conn.execute(text("""
                INSERT INTO lecture.sense (lemma_id, source, seq, gloss_en, raw)
                VALUES (:lid, 'wiktionary_en', :seq, :g, CAST(:raw AS jsonb))
                ON CONFLICT (lemma_id, source, seq) DO UPDATE SET gloss_en = EXCLUDED.gloss_en, raw = EXCLUDED.raw"""),
                rows[i:i + BATCH])

    def finish(self) -> dict:
        self.flush()
        self._resolve_variants()
        # Senses left over from an earlier, longer import: unlink tokens, then delete.
        keep = [{"lid": lid, "n": n} for lid, n in self.n_senses.items()]
        for i in range(0, len(keep), BATCH * 5):
            part = keep[i:i + BATCH * 5]
            self.conn.execute(text("""UPDATE lecture.token t SET sense_id = NULL FROM lecture.sense s
                WHERE t.sense_id = s.id AND s.lemma_id = :lid AND s.source = 'wiktionary_en' AND s.seq >= :n"""), part)
            self.conn.execute(text("""DELETE FROM lecture.sense
                WHERE lemma_id = :lid AND source = 'wiktionary_en' AND seq >= :n"""), part)
        # Inflected forms -> lemma (only to lemmas we have, same part of speech; plural of a noun etc.).
        rows = []
        for (form, word, upos), codes in self.forms.items():
            lid = self.ids.get((word, upos)) or self.ids.get((word.lower(), upos))
            if lid:
                rows.append({"form": form, "lid": lid, "tags": sorted(codes)})
        for i in range(0, len(rows), BATCH * 2):
            self.conn.execute(text("""
                INSERT INTO lecture.word_form (form, lemma_id, tags) VALUES (:form, :lid, :tags)
                ON CONFLICT (form, lemma_id) DO UPDATE SET tags = ARRAY(
                    SELECT DISTINCT x FROM unnest(lecture.word_form.tags || EXCLUDED.tags) AS x ORDER BY x)"""),
                rows[i:i + BATCH * 2])
        self.stats["forms"] = len(rows)
        return self.stats


def import_entries(conn: Connection, entries: Iterable[dict]) -> dict:
    imp = Importer(conn)
    for e in entries:
        imp.add(e)
    return imp.finish()


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("source", nargs="?", default=URL, help="JSONL(.gz) path or URL (default: kaikki.org)")
    a = ap.parse_args(argv)
    t = time.time()
    print(f"reading {a.source} … (several minutes: ~1.5 million entries)", file=sys.stderr)
    with get_engine(settings.admin_url or None).begin() as conn:
        stats = import_entries(conn, iter_entries(a.source))
    stats["seconds"] = round(time.time() - t, 1)
    print(json.dumps(stats, ensure_ascii=False))


if __name__ == "__main__":
    main()
