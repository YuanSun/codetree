"""Turn a plain-text transcription into an article pack JSON (docs/DESIGN.md, 内容管线).

    python tools/text2pack.py content/book.txt content/book.questions.json -o content/book.pack.json

Text format:
    @title ...            metadata lines (@title, @slug, @week_of, @source_note, @level, @lang)
    @lang en              English text (default fr)
    ## 1 Chapter title    starts a chapter (the number is the chapter seq)
    blank-line separated paragraphs
    @image images/book/ch1.jpg | caption    inside a chapter: a picture after the paragraphs above it
                                            (path relative to the pack file; the caption is optional)

Typography: straight apostrophes become ’. French only: the spaces before ! ? ; : » and after « become
narrow no-break spaces (U+202F), so "!" never wraps alone onto the next line.

The questions file is {"chapters": {"1": {"kind": "open", "prompt": ..., "rubric": {...}}},
"questions": [...], "focus_words": [...]}. A rubric's "evidence" ([{"chapter": 4, "quote": "..."}]) names the
passages that hold the answer: each quote must be copied exactly from one paragraph of that chapter (spaces,
apostrophes and case don't matter); a quote that isn't found stops the build.
Packs made from books stay in content/, which is git-ignored (family use only).
"""
import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

NNBSP = " "


def typography(s: str, lang: str = "fr") -> str:
    s = re.sub(r"\s+", " ", s).strip()
    s = s.replace("'", "’")
    if lang != "fr":
        return s
    s = re.sub(r" ([!?;:»])", NNBSP + r"\1", s)
    s = re.sub(r"« ", "«" + NNBSP, s)
    return s


def norm_quote(s: str) -> str:
    """Same rule as importer.article.norm_quote."""
    s = s.translate(str.maketrans({"\u00a0": " ", "\u202f": " ", "\u2009": " ", "\u2019": "'", "\u2018": "'",
                                   "\u02bc": "'", "\u201c": '"', "\u201d": '"'})).lower()
    return " ".join(s.split())


def check_evidence(pack: dict) -> list[str]:
    """Give the quotes the text's typography; return the ones not found in one paragraph of their chapter."""
    paras = {c["seq"]: [norm_quote(p) for p in c["paragraphs"]] for c in pack["chapters"]}
    qs = [c["question"] for c in pack["chapters"] if c.get("question")] + pack["questions"]
    missing = []
    for q in qs:
        for e in (q.get("rubric") or {}).get("evidence") or []:
            e["quote"] = typography(e["quote"], pack["lang"])
            if not any(norm_quote(e["quote"]) in p for p in paras.get(e.get("chapter"), [])):
                missing.append(f"  ch. {e.get('chapter')}: {e['quote']!r}  ({q['prompt'][:50]!r})")
    return missing


def parse(text: str) -> dict:
    meta: dict = {}
    chapters: list[dict] = []
    para: list[str] = []

    def flush():
        if para and chapters:
            chapters[-1]["paragraphs"].append(typography(" ".join(para), lang()))
        para.clear()

    def lang() -> str:
        return meta.get("lang", "fr")

    for line in text.splitlines():
        if line.startswith("@image "):
            flush()
            if not chapters:
                sys.exit(f"@image before the first chapter: {line}")
            file, _, caption = line[len("@image "):].partition("|")
            ch = chapters[-1]
            ch.setdefault("images", []).append({"after": len(ch["paragraphs"]), "file": file.strip(),
                                                "caption": typography(caption, lang()) or None})
        elif line.startswith("@"):
            k, _, v = line[1:].partition(" ")
            meta[k] = v.strip()
        elif line.startswith("## "):
            flush()
            m = re.match(r"##\s+(\d+)\s+(.*)", line)
            if not m:
                sys.exit(f"bad chapter line: {line}")
            chapters.append({"seq": int(m.group(1)), "title": typography(m.group(2), lang()), "paragraphs": []})
        elif not line.strip():
            flush()
        else:
            para.append(line.strip())
    flush()
    return {"meta": meta, "chapters": chapters}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("text")
    ap.add_argument("questions", nargs="?")
    ap.add_argument("-o", "--out", required=True)
    ap.add_argument("--slug")
    ap.add_argument("--week-of")
    a = ap.parse_args()
    doc = parse(Path(a.text).read_text(encoding="utf-8"))
    meta = doc["meta"]
    q = json.loads(Path(a.questions).read_text(encoding="utf-8")) if a.questions else {}
    for ch in doc["chapters"]:
        if str(ch["seq"]) in q.get("chapters", {}):
            ch["question"] = q["chapters"][str(ch["seq"])]
    pack = {
        "slug": a.slug or meta.get("slug"),
        "title": meta["title"],
        "lang": meta.get("lang", "fr"),
        "week_of": a.week_of or meta.get("week_of"),
        "source_note": meta.get("source_note") or meta.get("author"),
        "level": meta.get("level"),
        "chapters": doc["chapters"],
        "questions": q.get("questions", []),
        "focus_words": q.get("focus_words", []),
    }
    missing = [k for k in ("slug", "title", "week_of") if not pack[k]]
    if missing:
        sys.exit(f"missing {missing}: add @slug / @week_of lines or pass --slug / --week-of")
    bad = check_evidence(pack)
    if bad:
        sys.exit("evidence quotes not found in one paragraph of their chapter (copy them exactly, no […]):\n"
                 + "\n".join(bad))
    Path(a.out).write_text(json.dumps(pack, ensure_ascii=False, indent=2), encoding="utf-8")
    words = sum(len(p.split()) for c in pack["chapters"] for p in c["paragraphs"])
    print(f"{a.out}: {len(pack['chapters'])} chapters, "
          f"{sum(len(c['paragraphs']) for c in pack['chapters'])} paragraphs, ~{words} words, "
          f"{sum(len(c.get('images', [])) for c in pack['chapters'])} pictures")
    qs = [c["question"] for c in pack["chapters"] if c.get("question")] + pack["questions"]
    kinds = Counter(q.get("kind", "open") for q in qs)
    with_ev = sum(1 for q in qs if (q.get("rubric") or {}).get("evidence"))
    print(f"  questions: {len(qs)} ({', '.join(f'{n} {k}' for k, n in sorted(kinds.items()))}), "
          f"{with_ev} with evidence")
    for c in pack["chapters"]:
        n = sum(len(p.split()) for p in c["paragraphs"])
        print(f"  {c['seq']}. {c['title']}: ~{n} words (~{n / 120:.0f} min at 120 words/min)")


if __name__ == "__main__":
    main()
