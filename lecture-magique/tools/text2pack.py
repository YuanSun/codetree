"""Turn a plain-text transcription into an article pack JSON (docs/DESIGN.md, 内容管线).

    python tools/text2pack.py content/book.txt content/book.questions.json -o content/book.pack.json

Text format:
    @title ...            metadata lines (@title, @slug, @week_of, @source_note, @level)
    ## 1 Chapter title    starts a chapter (the number is the chapter seq)
    blank-line separated paragraphs

Typography: straight apostrophes become ’ and the spaces before ! ? ; : » and after « become
narrow no-break spaces (U+202F), so "!" never wraps alone onto the next line.

The questions file is {"chapters": {"1": {"kind": "open", "prompt": ..., "rubric": {...}}},
"questions": [...], "focus_words": [...]}.
Packs made from books stay in content/, which is git-ignored (family use only).
"""
import argparse
import json
import re
import sys
from pathlib import Path

NNBSP = " "


def typography(s: str) -> str:
    s = re.sub(r"\s+", " ", s).strip()
    s = s.replace("'", "’")
    s = re.sub(r" ([!?;:»])", NNBSP + r"\1", s)
    s = re.sub(r"« ", "«" + NNBSP, s)
    return s


def parse(text: str) -> dict:
    meta: dict = {}
    chapters: list[dict] = []
    para: list[str] = []

    def flush():
        if para and chapters:
            chapters[-1]["paragraphs"].append(typography(" ".join(para)))
        para.clear()

    for line in text.splitlines():
        if line.startswith("@"):
            k, _, v = line[1:].partition(" ")
            meta[k] = v.strip()
        elif line.startswith("## "):
            flush()
            m = re.match(r"##\s+(\d+)\s+(.*)", line)
            if not m:
                sys.exit(f"bad chapter line: {line}")
            chapters.append({"seq": int(m.group(1)), "title": typography(m.group(2)), "paragraphs": []})
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
    Path(a.out).write_text(json.dumps(pack, ensure_ascii=False, indent=2), encoding="utf-8")
    words = sum(len(p.split()) for c in pack["chapters"] for p in c["paragraphs"])
    print(f"{a.out}: {len(pack['chapters'])} chapters, "
          f"{sum(len(c['paragraphs']) for c in pack['chapters'])} paragraphs, ~{words} words")
    for c in pack["chapters"]:
        n = sum(len(p.split()) for p in c["paragraphs"])
        print(f"  {c['seq']}. {c['title']}: ~{n} words (~{n / 120:.0f} min at 120 words/min)")


if __name__ == "__main__":
    main()
