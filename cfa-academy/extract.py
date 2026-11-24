#!/usr/bin/env python3
"""Read the Schweser CFA Level I PDFs and write curriculum.json (topics > readings > modules + LOS).

  python3 extract.py "/path/to/folder with the 4 PDFs" [out.json]      (needs: pip install pymupdf)

Only the outline is extracted (topic / reading / module titles, PDF page numbers and the
learning-outcome statements). The book text itself is never copied into the site; each module
points at its PDF page instead. The output is git-ignored.
"""
import glob, json, pathlib, re, sys
import pymupdf

TOPIC_ORDER = ["Quantitative Methods", "Economics", "Corporate Finance", "Financial Statement Analysis", "Equities",
               "Fixed Income", "Derivatives", "Alternative Investments", "Portfolio Construction",
               "Ethical and Professional Standards"]


def book_data(path, book):
    d = pymupdf.open(path)
    toc = [(l, t.strip(), p) for l, t, p in d.get_toc()]
    readings, pending, topics, cur = [], [], [], None
    for l, t, p in toc:
        if l == 1 and (m := re.match(r"Reading (\d+)\s+(.*)", t)):
            cur = {"n": int(m[1]), "title": m[2], "book": book, "page": p, "modules": []}
            pending.append(cur)
        elif l == 2 and cur and (m := re.match(r"Module ([\d.]+):\s*(.*)", t)):
            cur["modules"].append({"id": m[1], "title": m[2], "page": p})
        elif l == 2 and cur and t == "Key Concepts":
            cur["keyPage"] = p
        elif l == 1 and (m := re.match(r"Topic Quiz:\s*(.*)", t)):
            topics.append({"name": m[1], "quizPage": p, "readings": pending}); pending = []
        elif l == 1 and t.startswith("Formulas"):
            formulas = p
    if pending:          # readings after the last topic quiz would be a parsing gap
        topics.append({"name": "?", "readings": pending})
    los_start = next(p for l, t, p in toc if t.startswith("Learning Outcome Statements"))
    first_reading = min(r["page"] for t in topics for r in t["readings"])
    return d, topics, los_start, first_reading


def parse_los(d, start, end):
    text = "\n".join(d[i].get_text() for i in range(start - 1, end - 1))
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    out, cur, item = {}, None, None
    for i, l in enumerate(lines):
        nxt = " ".join(lines[i + 1:i + 3])
        if (m := re.match(r"^(\d{1,3})\.\s+(\S.*)$", l)) and "candidate should be able" in nxt:
            cur = out.setdefault(int(m[1]), []); item = None
        elif cur is not None and (m := re.match(r"^([a-z])\.\s+(.*)$", l)):
            item = [m[2]]; cur.append(item)
        elif cur is not None and item is not None and "candidate should be able" not in l and not re.fullmatch(r"\d+", l):
            item.append(l)
    return {n: [" ".join(x) for x in items] for n, items in out.items()}


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    folder = pathlib.Path(sys.argv[1]).expanduser()
    dest = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else pathlib.Path(__file__).parent / "content" / "curriculum.json"
    books = sorted(glob.glob(str(folder / "*Book*.pdf")))
    if not books:
        sys.exit(f"No *Book*.pdf files in {folder}")
    topics = {}
    for i, f in enumerate(books, 1):
        d, tps, los_page, first = book_data(f, i)
        los = parse_los(d, los_page, first)
        for t in tps:
            for r in t["readings"]:
                r["los"] = los.get(r["n"], [])
            topics.setdefault(t["name"], {"name": t["name"], "readings": []})["readings"] += t["readings"]
    ordered = [topics[n] for n in TOPIC_ORDER if n in topics] + [t for n, t in topics.items() if n not in TOPIC_ORDER]
    for t in ordered:
        t["id"] = re.sub(r"[^a-z]+", "-", t["name"].lower()).strip("-")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(ordered, ensure_ascii=False, indent=1), encoding="utf-8")
    nr = sum(len(t["readings"]) for t in ordered)
    nl = sum(len(r["los"]) for t in ordered for r in t["readings"])
    print(f"{len(ordered)} topics, {nr} readings, {nl} LOS -> {dest}")


if __name__ == "__main__":
    main()
