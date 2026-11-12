"""Import an "article pack" JSON (docs/DESIGN.md, 内容管线) as a draft, then publish it.

    uv run python -m importer.article import path/to/pack.json   # -> status draft + coverage report
    uv run python -m importer.article publish <slug>
    uv run python -m importer.article unpublish <slug>
    uv run python -m importer.article rematch [<slug>]    # after importing Wiktionary: re-match in place
    uv run python -m importer.article list

Pipeline per paragraph: tokenize (exact offsets) -> spaCy fr_core_news_sm lemma + POS ->
match lecture.lemma (lemma+POS, then word_form, then lemma alone) -> token rows, with
sense_id = first Petit Robert sense of the lemma (phase 2 picks the sense with a model).
Unmatched words get needs_review=true and are listed in the report.

Re-importing the same slug replaces its chapters while it has no lookup history; once
someone has tapped words in it the import refuses, so the lookup log never loses its tokens.
"""
import argparse
import json
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy import Connection, text

from app.config import ROOT, settings
from app.db import get_engine

from .tokenize import Tok, split_hyphenated, tokenize

ELIDED = {"l": "le", "d": "de", "j": "je", "m": "me", "t": "te", "s": "se", "n": "ne", "c": "ce", "ç": "ce",
          "qu": "que", "jusqu": "jusque", "lorsqu": "lorsque", "puisqu": "puisque", "quoiqu": "quoique"}
UPOS_EQUIV = {"AUX": "VERB", "PROPN": "NOUN", "SCONJ": "CCONJ", "CCONJ": "SCONJ", "DET": "ADJ"}
REPORT_DIR = ROOT / "import-reports"


class ImportRefused(Exception):
    pass


@dataclass
class Match:
    lemma_id: int | None
    sense_id: int | None
    how: str


# Last-resort guesses when spaCy's lemma is wrong (e.g. beaux -> "beal", remarqués -> "remarqué").
_SUFFIXES = [("eaux", "eau"), ("aux", "al"), ("euses", "eux"), ("euse", "eux"), ("ives", "if"), ("ive", "if"),
             ("elles", "el"), ("elle", "el"), ("ennes", "en"), ("enne", "en"), ("ères", "er"), ("ère", "er"),
             ("ettes", "et"), ("ette", "et"), ("ées", "er"), ("és", "er"), ("ée", "er"), ("é", "er"),
             ("es", ""), ("es", "e"), ("s", ""), ("x", ""), ("e", "")]


def guess_lemmas(s: str) -> list[str]:
    return [s[: -len(suf)] + rep for suf, rep in _SUFFIXES if s.endswith(suf) and len(s) - len(suf) >= 2]


class Lexicon:
    """Whole dictionary index in memory (~85k lemmas): fast enough and simple."""

    def __init__(self, conn: Connection):
        self.by_lemma: dict[str, list[tuple[int, str, int]]] = {}
        self.pos: dict[int, str] = {}
        for lid, lemma, pos, hom in conn.execute(text("SELECT id, lemma, pos, homograph FROM lecture.lemma")):
            self.by_lemma.setdefault(lemma.lower(), []).append((lid, pos, hom))
            self.pos[lid] = pos
        for v in self.by_lemma.values():
            v.sort(key=lambda r: r[2])
        self.forms: dict[str, list[int]] = {}
        for form, lid in conn.execute(text("SELECT form, lemma_id FROM lecture.word_form")):
            self.forms.setdefault(form.lower(), []).append(lid)
        # First Petit Robert sense; for words Robert lacks, the first Wiktionary (English) gloss.
        self.first_sense: dict[int, int] = dict(conn.execute(text(
            "SELECT DISTINCT ON (lemma_id) lemma_id, id FROM lecture.sense "
            "WHERE source IN ('petit_robert', 'wiktionary_en') "
            "ORDER BY lemma_id, (source = 'petit_robert') DESC, seq")).all())

    def _pick(self, rows: list[tuple[int, str, int]], upos: str | None) -> int | None:
        if not rows:
            return None
        for want in (upos, UPOS_EQUIV.get(upos or "")):
            for lid, pos, _ in rows:
                if want and pos == want:
                    return lid
        return rows[0][0]

    def match(self, surface: str, lemma: str, upos: str) -> Match:
        s = surface.lower().replace("’", "'")
        lem = lemma.lower().replace("’", "'")
        if s.endswith("'") and s[:-1] in ELIDED:
            lem = ELIDED[s[:-1]]
        if s.startswith("-"):  # inverted pronoun: -il, -t-il, -ce
            s = lem = s.lstrip("-").removeprefix("t-")
        lid, how = None, ""
        exact = [r for r in self.by_lemma.get(lem, []) if r[1] in (upos, UPOS_EQUIV.get(upos))]
        verb_forms = [i for i in self.forms.get(s, []) if self.pos.get(i) == "VERB"] if upos in ("VERB", "AUX") else []
        if exact:
            lid, how = exact[0][0], "lemma+pos"
        elif verb_forms:
            # spaCy says verb but its lemma is wrong ("demande" -> "demande"): use the conjugation tables
            # (Wiktionary word_form) instead of falling through to the noun with the same spelling.
            lid = next((i for i in verb_forms if i in {r[0] for r in self.by_lemma.get(lem, [])}), verb_forms[0])
            how = "verb_form"
        elif s in self.forms:
            ids = self.forms[s]
            lid = next((i for i in ids if self.pos.get(i) == upos), ids[0])
            how = "word_form"
        elif lem in self.by_lemma:
            lid, how = self._pick(self.by_lemma[lem], upos), "lemma"
        elif s in self.by_lemma:
            lid, how = self._pick(self.by_lemma[s], upos), "surface"
        elif lem in self.forms:
            lid, how = self.forms[lem][0], "word_form(lemma)"
        else:
            for cand in guess_lemmas(s):
                if cand in self.by_lemma:
                    lid, how = self._pick(self.by_lemma[cand], upos), "heuristic"
                    break
                if cand in self.forms:
                    lid, how = self.forms[cand][0], "heuristic"
                    break
        return Match(lid, self.first_sense.get(lid) if lid else None, how)


_nlp = None


def nlp():
    global _nlp
    if _nlp is None:
        import spacy

        _nlp = spacy.load("fr_core_news_sm", disable=["ner", "parser"])
    return _nlp


class SpacyParagraph:
    """spaCy analysis of one paragraph, looked up by our token spans."""

    def __init__(self, text_: str):
        self.spans = [(t.idx, t.idx + len(t.text), t.lemma_, t.pos_, str(t.morph)) for t in nlp()(text_)]

    def for_token(self, t: Tok) -> tuple[str, str, str]:
        """(lemma, upos, morph) of the spaCy token that matches our token's span."""
        best, overlap = (t.surface, "X", ""), 0
        for s, e, lemma, pos, morph in self.spans:
            if s == t.start and e == t.end:
                return lemma, pos, morph
            o = min(e, t.end) - max(s, t.start)
            if o > overlap:
                same = (e - s) == (t.end - t.start)
                best, overlap = (lemma if same else t.surface, pos, morph if same else ""), o
        return best


NO_MATCH = Match(None, None, "")


def analyse(text_: str, lex: Lexicon) -> list[tuple[Tok, Match, str, str, str]]:
    """Tokens of one paragraph with their dictionary match and spaCy (lemma, upos, morph)."""
    sp = SpacyParagraph(text_)
    out = []
    for t in tokenize(text_):
        if not t.is_word:
            out.append((t, NO_MATCH, "", "", ""))
            continue
        lemma, pos, morph = sp.for_token(t)
        m = lex.match(t.surface, lemma, pos)
        if m.lemma_id is None and "-" in t.surface and not t.surface.startswith("-"):
            for p in split_hyphenated(t):
                if not p.is_word:
                    out.append((p, NO_MATCH, "", "", ""))
                    continue
                pl, pp, pm = sp.for_token(p)
                out.append((p, lex.match(p.surface, pl, pp), pl, pp, pm))
            continue
        out.append((t, m, lemma, pos, morph))
    return out


def import_pack(conn: Connection, pack: dict, lex: Lexicon | None = None) -> dict:
    lex = lex or Lexicon(conn)
    slug = pack["slug"]
    existing = conn.execute(text("SELECT id FROM lecture.article WHERE slug = :s"), {"s": slug}).scalar()
    if existing:
        used = conn.execute(text("""SELECT count(*) FROM lecture.lookup_event e JOIN lecture.token t ON t.id = e.token_id
            JOIN lecture.paragraph p ON p.id = t.paragraph_id JOIN lecture.chapter c ON c.id = p.chapter_id
            WHERE c.article_id = :a"""), {"a": existing}).scalar()
        if used:
            raise ImportRefused(f"{slug}: {used} lookups already point at this article's tokens; "
                                f"import it under a new slug instead")
        conn.execute(text("DELETE FROM lecture.question WHERE article_id = :a"), {"a": existing})
        conn.execute(text("DELETE FROM lecture.chapter WHERE article_id = :a"), {"a": existing})
        conn.execute(text("""UPDATE lecture.article SET title=:t, week_of=:w, level=:l, source_note=:n, status='draft'
            WHERE id=:a"""), {"a": existing, "t": pack["title"], "w": pack["week_of"], "l": pack.get("level"),
                               "n": pack.get("source_note")})
        article_id = existing
    else:
        article_id = conn.execute(text("""INSERT INTO lecture.article (slug, title, week_of, level, source_note)
            VALUES (:s, :t, :w, :l, :n) RETURNING id"""), {"s": slug, "t": pack["title"], "w": pack["week_of"],
                                                          "l": pack.get("level"), "n": pack.get("source_note")}).scalar()

    words = matched = propn = 0
    unmatched: Counter = Counter()
    hows: Counter = Counter()
    qseq = 0
    for ch in pack["chapters"]:
        chapter_id = conn.execute(text("""INSERT INTO lecture.chapter (article_id, seq, title)
            VALUES (:a, :s, :t) RETURNING id"""), {"a": article_id, "s": ch["seq"], "t": ch.get("title")}).scalar()
        for pseq, ptext in enumerate(ch["paragraphs"], start=1):
            pid = conn.execute(text("""INSERT INTO lecture.paragraph (chapter_id, seq, text)
                VALUES (:c, :s, :t) RETURNING id"""), {"c": chapter_id, "s": pseq, "t": ptext}).scalar()
            rows = []
            for i, (t, m, lemma, pos, morph) in enumerate(analyse(ptext, lex), start=1):
                if t.is_word:
                    words += 1
                    if m.lemma_id:
                        matched += 1
                        hows[m.how] += 1
                    else:
                        unmatched[(t.surface, lemma, pos)] += 1
                        propn += pos == "PROPN"
                rows.append({"p": pid, "seq": i, "surface": t.surface, "s": t.start, "e": t.end, "w": t.is_word,
                             "l": m.lemma_id, "sn": m.sense_id, "r": t.is_word and m.lemma_id is None,
                             "m": morph or None})
            if rows:
                conn.execute(text("""INSERT INTO lecture.token
                    (paragraph_id, seq, surface, char_start, char_end, is_word, lemma_id, sense_id, needs_review, morph)
                    VALUES (:p, :seq, :surface, :s, :e, :w, :l, :sn, :r, :m)"""), rows)
        if ch.get("question"):
            qseq += 1
            q = ch["question"]
            conn.execute(text("""INSERT INTO lecture.question (article_id, chapter_id, seq, kind, prompt, model_answer, rubric)
                VALUES (:a, :c, :s, :k, :p, :m, CAST(:r AS jsonb))"""),
                         {"a": article_id, "c": chapter_id, "s": qseq, "k": q.get("kind", "open"), "p": q["prompt"],
                          "m": q.get("model_answer"), "r": json.dumps(q.get("rubric"), ensure_ascii=False)})
    for q in pack.get("questions", []):
        qseq += 1
        conn.execute(text("""INSERT INTO lecture.question (article_id, seq, kind, prompt, model_answer, rubric)
            VALUES (:a, :s, :k, :p, :m, CAST(:r AS jsonb))"""),
                     {"a": article_id, "s": qseq, "k": q.get("kind", "writing"), "p": q["prompt"],
                      "m": q.get("model_answer"), "r": json.dumps(q.get("rubric"), ensure_ascii=False)})

    coverage = matched / words if words else 1.0
    no_propn = matched / (words - propn) if words - propn else 1.0
    return {
        "article_id": article_id, "slug": slug, "status": "draft",
        "words": words, "matched": matched, "coverage": round(coverage, 4),
        "coverage_without_proper_nouns": round(no_propn, 4),
        "match_kinds": dict(hows),
        "unmatched": [{"surface": s, "spacy_lemma": l, "upos": p, "count": n}
                      for (s, l, p), n in unmatched.most_common()],
        "focus_words_ignored_until_phase_2": pack.get("focus_words", []),
    }


def rematch(conn: Connection, slug: str, lex: Lexicon | None = None) -> dict:
    """Re-run spaCy + dictionary matching on an imported article without touching its token ids
    (so lookups already recorded stay attached). Use after importing Wiktionary or a new dictionary."""
    lex = lex or Lexicon(conn)
    art = conn.execute(text("SELECT id FROM lecture.article WHERE slug = :s"), {"s": slug}).scalar()
    if not art:
        raise SystemExit(f"no article with slug {slug!r}")
    words = matched = changed = 0
    unmatched: Counter = Counter()
    paras = conn.execute(text("""SELECT p.id, p.text FROM lecture.paragraph p JOIN lecture.chapter c ON c.id = p.chapter_id
        WHERE c.article_id = :a ORDER BY c.seq, p.seq"""), {"a": art}).all()
    for pid, ptext in paras:
        sp = SpacyParagraph(ptext)
        updates = []
        for tid, surface, s, e, old_lemma in conn.execute(text("""SELECT id, surface, char_start, char_end, lemma_id
                FROM lecture.token WHERE paragraph_id = :p AND is_word ORDER BY seq"""), {"p": pid}):
            t = Tok(surface, s, e, True)
            lemma, pos, morph = sp.for_token(t)
            m = lex.match(surface, lemma, pos)
            words += 1
            matched += m.lemma_id is not None
            changed += m.lemma_id != old_lemma
            if m.lemma_id is None:
                unmatched[(surface, lemma, pos)] += 1
            updates.append({"id": tid, "l": m.lemma_id, "sn": m.sense_id, "m": morph or None, "r": m.lemma_id is None})
        if updates:
            conn.execute(text("""UPDATE lecture.token SET lemma_id = :l, sense_id = :sn, morph = :m, needs_review = :r
                WHERE id = :id"""), updates)
    return {"slug": slug, "words": words, "matched": matched, "coverage": round(matched / words, 4) if words else 1.0,
            "lemma_changed": changed,
            "unmatched": [{"surface": s, "spacy_lemma": l, "upos": p, "count": n}
                          for (s, l, p), n in unmatched.most_common()]}


def set_status(conn: Connection, slug: str, status: str) -> None:
    n = conn.execute(text("UPDATE lecture.article SET status = :st WHERE slug = :s"), {"st": status, "s": slug}).rowcount
    if not n:
        raise SystemExit(f"no article with slug {slug!r}")


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("import"); p.add_argument("pack")
    p = sub.add_parser("rematch", help="re-match words of an imported article in place (keeps lookups)")
    p.add_argument("slug", nargs="?", help="omit to rematch every article")
    p = sub.add_parser("publish"); p.add_argument("slug")
    p = sub.add_parser("unpublish"); p.add_argument("slug")
    sub.add_parser("list")
    a = ap.parse_args(argv)
    with get_engine(settings.admin_url or None).begin() as conn:
        if a.cmd == "import":
            pack = json.loads(Path(a.pack).read_text(encoding="utf-8"))
            try:
                rep = import_pack(conn, pack)
            except ImportRefused as e:
                sys.exit(str(e))
            REPORT_DIR.mkdir(exist_ok=True)
            out = REPORT_DIR / f"{rep['slug']}.json"
            out.write_text(json.dumps(rep, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"{rep['slug']}: draft, {rep['words']} words, coverage {rep['coverage']:.1%} "
                  f"({rep['coverage_without_proper_nouns']:.1%} without proper nouns), "
                  f"{len(rep['unmatched'])} distinct unmatched -> {out}")
            for u in rep["unmatched"][:40]:
                print(f"  {u['count']:>3}  {u['surface']}  (spaCy: {u['spacy_lemma']} {u['upos']})")
            print(f"publish with: python -m importer.article publish {rep['slug']}")
        elif a.cmd == "rematch":
            slugs = [a.slug] if a.slug else list(conn.execute(text("SELECT slug FROM lecture.article ORDER BY id")).scalars())
            lex = Lexicon(conn)
            for slug in slugs:
                rep = rematch(conn, slug, lex)
                print(f"{slug}: coverage {rep['coverage']:.1%}, {rep['lemma_changed']} words now point to a "
                      f"different entry, {len(rep['unmatched'])} distinct unmatched")
        elif a.cmd == "publish":
            set_status(conn, a.slug, "published"); print(f"{a.slug}: published")
        elif a.cmd == "unpublish":
            set_status(conn, a.slug, "draft"); print(f"{a.slug}: draft")
        else:
            for r in conn.execute(text("SELECT slug, status, week_of, title FROM lecture.article ORDER BY week_of DESC")):
                print(f"{r.week_of}  {r.status:<9}  {r.slug}  {r.title}")


if __name__ == "__main__":
    main()
