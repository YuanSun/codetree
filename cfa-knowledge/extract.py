#!/usr/bin/env python3
"""Read the Schweser CFA PDFs and write content/curriculum.json:
levels > topics > readings > modules + learning outcomes (LOS), plus a concept index
(each back-of-book index term with the readings/pages it appears on, and related concepts).

  python3 extract.py --l1 "/folder/with/Level I books" --l2 "/folder/with/Level II books"   (pip install pymupdf)

Only titles, page numbers, LOS and index terms are extracted; the book text is not copied into the site.
The output is git-ignored.
"""
import argparse, glob, json, pathlib, re, sys
from collections import defaultdict
import pymupdf

PAGES = r"\d+(?:\s*[–-]\s*\d+)?"
INDEX_LINE = re.compile(rf"^(.*?),\s*({PAGES}(?:,\s*{PAGES})*)\s*$")


def outline(d, book):
    toc = [(l, t.strip(), p) for l, t, p in d.get_toc()]
    topics, pending, cur = [], [], None
    for l, t, p in toc:
        if l == 1 and (m := re.match(r"Reading (\d+)\s+(.*)", t)):
            cur = {"n": int(m[1]), "title": m[2], "book": book, "page": p, "modules": []}
            pending.append(cur)
        elif l == 2 and cur and (m := re.match(r"Module ([\d.]+):\s*(.*)", t)):
            cur["modules"].append({"id": m[1], "title": m[2], "page": p})
        elif l == 2 and cur and t == "Key Concepts":
            cur["keyPage"] = p
        elif l == 1 and (m := re.match(r"Topic Quiz:\s*(.*)", t)):
            topics.append({"name": m[1], "readings": pending}); pending = []
    if pending:
        topics.append({"name": "Other", "readings": pending})
    los_start = next(p for l, t, p in toc if t.startswith("Learning Outcome Statements"))
    los_end = min(p for l, t, p in toc if l == 1 and p > los_start)
    index_start = next((p for l, t, p in toc if l == 1 and t == "Index"), None)
    return topics, los_start, los_end, index_start


def parse_los(d, start, end):
    lines = [l.strip() for i in range(start - 1, end - 1) for l in d[i].get_text().splitlines() if l.strip()]
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


def parse_index(d, start):
    """-> [(term, [printed page numbers])]"""
    lines = [l.strip() for i in range(start - 1, d.page_count) for l in d[i].get_text().splitlines() if l.strip()]
    out, prefix = [], ""
    for l in lines:
        if re.fullmatch(r"[A-Z]|Index", l):
            prefix = ""; continue
        m = INDEX_LINE.match(prefix + l)
        if m:
            pages = []
            for part in re.split(r",\s*", m[2]):
                a = [int(x) for x in re.split(r"\s*[–-]\s*", part)]
                pages += list(range(a[0], a[-1] + 1)) if len(a) == 2 and a[1] - a[0] < 6 else [a[0]]
            out.append((m[1].strip(), pages)); prefix = ""
        elif len(prefix) < 120:
            prefix += l + " "
        else:
            prefix = ""
    return out


def resolve(d, entries, first_page, last_page):
    """Index entries carry *printed* page numbers, which drift from PDF pages (blank pages, answer keys).
    Anchor on terms whose text is found exactly as often as they are indexed, interpolate the drift between
    anchors, then snap each page to the nearest page whose text really contains the term."""
    texts = [re.sub(r"\s+", " ", d[i].get_text().lower().replace("-\n", "")) for i in range(d.page_count)]
    body = range(first_page - 1, last_page)
    def where(term):
        t = re.sub(r"\s*\(.*?\)", "", term).lower().strip()
        return [i + 1 for i in body if t and t in texts[i]]
    matches = {t: where(t) for t, _ in entries}
    anchors = []
    for t, pages in entries:
        m = matches[t]
        if len(m) == len(pages) and m:
            anchors += list(zip(pages, m))
    anchors.sort()
    def guess(pg):
        near = min(anchors, key=lambda a: abs(a[0] - pg)) if anchors else (pg, pg + first_page - 1)
        return pg + near[1] - near[0]
    out = []
    for t, pages in entries:
        res = []
        for pg in pages:
            g = guess(pg); m = matches[t]
            near = min(m, key=lambda x: abs(x - g)) if m else None
            res.append(near if near is not None and abs(near - g) <= 12 else g)
        out.append((t, sorted(set(x for x in res if first_page <= x <= last_page))))
    return out


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def book_files(folder, pattern):
    """The level's PDFs in book order, by the number in the name (Book_2, V3), not alphabetically."""
    files = glob.glob(str(pathlib.Path(folder).expanduser() / pattern))
    num = lambda f: int(m[1]) if (m := re.search(r"(?:Book|V)[_ ]?(\d+)\.pdf$", f, re.I)) else 999
    return sorted(files, key=lambda f: (num(f), f))


def level_data(level, folder, pattern):
    files = book_files(folder, pattern)
    if not files:
        sys.exit(f"No files matching {pattern} in {folder}")
    topics, raw_index = {}, []
    for book, f in enumerate(files, 1):
        d = pymupdf.open(f)
        tps, los_s, los_e, idx = outline(d, book)
        los = parse_los(d, los_s, los_e)
        for t in tps:
            for r in t["readings"]:
                r["los"] = los.get(r["n"], [])
                r["id"] = str(r["n"]) if level == 1 else f"{level}-{r['n']}"
            topics.setdefault(t["name"], {"name": t["name"], "id": f"l{level}-{slug(t['name'])}", "readings": []})["readings"] += t["readings"]
        if idx:
            first = min(r["page"] for t in tps for r in t["readings"])
            entries = resolve(d, parse_index(d, idx), first, idx - 1)
            print(f"  L{level} book {book}: {len(entries)} index terms resolved")
            raw_index.append((book, entries))
    readings = [r for t in topics.values() for r in t["readings"]]
    return list(topics.values()), readings, raw_index


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--l1", help="folder with the Level I books (*Book*.pdf)")
    ap.add_argument("--l2", help="folder with the Level II books (*V1.pdf ... *V5.pdf)")
    ap.add_argument("--out", default=str(pathlib.Path(__file__).parent / "content" / "curriculum.json"))
    a = ap.parse_args()
    if not (a.l1 or a.l2):
        ap.error("give --l1 and/or --l2")
    levels, concepts = [], {}
    for level, folder, pat in ((1, a.l1, "*Book*.pdf"), (2, a.l2, "*V[0-9].pdf")):
        if not folder:
            continue
        topics, readings, raw_index = level_data(level, folder, pat)
        levels.append({"id": level, "name": f"Level {'I' * level if level < 3 else 'III'}", "topics": topics})
        by_book = defaultdict(list)
        for r in readings:
            by_book[r["book"]].append(r)
        for book, entries in raw_index:
            rs = sorted(by_book[book], key=lambda r: r["page"])
            for term, pages in entries:
                c = concepts.setdefault(f"{level}:{term.lower()}", {"term": term, "level": level, "hits": []})
                for pg in pages:
                    pdf = pg
                    r = next((x for x in reversed(rs) if x["page"] <= pdf), None)
                    if not r:
                        continue
                    m = next((x for x in reversed(r["modules"]) if x["page"] <= pdf), None)
                    h = {"r": r["id"], "b": book, "p": pdf}
                    if m:
                        h["m"] = m["id"]
                    if h not in c["hits"]:
                        c["hits"].append(h)
    out = [c for c in concepts.values() if c["hits"]]
    for i, c in enumerate(out):
        c["id"] = i
    link(out)
    dest = pathlib.Path(a.out); dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps({"levels": levels, "concepts": out}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(levels)} level(s), {sum(len(t['readings']) for l in levels for t in l['topics'])} readings, "
          f"{sum(len(r['los']) for l in levels for t in l['topics'] for r in t['readings'])} LOS, {len(out)} concepts -> {dest}")


def link(concepts, per=10):
    """Related concepts: same page (3) > same module (2) > same reading (1); same term in the other level (cross)."""
    by_page, by_mod, by_read = defaultdict(set), defaultdict(set), defaultdict(set)
    for c in concepts:
        for h in c["hits"]:
            by_page[(h["b"], h["p"], c["level"])].add(c["id"])
            by_mod[(h["r"], h.get("m"))].add(c["id"]) if h.get("m") else None
            by_read[h["r"]].add(c["id"])
    for c in concepts:
        score = defaultdict(int)
        for h in c["hits"]:
            for o in by_page[(h["b"], h["p"], c["level"])]: score[o] += 3
            if h.get("m"):
                for o in by_mod[(h["r"], h["m"])]: score[o] += 2
            for o in by_read[h["r"]]: score[o] += 1
        score.pop(c["id"], None)
        c["rel"] = [o for o, _ in sorted(score.items(), key=lambda x: (-x[1], concepts[x[0]]["term"]))[:per]]
    names = defaultdict(list)
    for c in concepts:
        names[re.sub(r"\s*\(.*?\)|[^a-z0-9 ]", "", c["term"].lower()).strip()].append(c["id"])
    for ids in names.values():
        if len(ids) > 1:
            for i in ids:
                c = concepts[i]; c["also"] = [j for j in ids if concepts[j]["level"] != c["level"]]


if __name__ == "__main__":
    main()
