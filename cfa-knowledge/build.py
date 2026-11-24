#!/usr/bin/env python3
"""Build the CFA knowledge base: notes/<level>/*.md (concept explanations, written for this site) + assets
-> a static site with fuzzy search.

  python3 build.py                       # -> ../hosting/sites/cfa-kb  (served at /kb/)
  python3 build.py --out /some/dir       # anywhere else
  python3 build.py --obsidian ~/Vault/CFA   # also write one Obsidian note per concept (aliases in front matter)

If ../cfa-academy/content/curriculum.json exists (made by cfa-academy/extract.py from your own Schweser PDFs),
readings also get their learning outcomes, modules, book pages and the books' index terms. Without it the site
still works; it just has no book page references.

Note format (one file per topic):

    # Quantitative Methods
    @topic quant

    ## Net present value (NPV)
    @id npv
    @r 24                       reading number (several: 24, 44)
    @aka net present value; is the project worth it; value created   (search synonyms, ';'-separated)
    @see irr; wacc              related concept ids (also [[id]] or [[id|text]] links inside the text)

    First paragraph = the one-line summary shown in search results. Then Markdown: ### headings, lists,
    tables, > callouts, **bold**, `code`, display math $$...$$ and inline math \\( ... \\).
"""
import argparse, html, json, pathlib, re, shutil, sys

HERE = pathlib.Path(__file__).resolve().parent
CURRICULUM = HERE.parent / "cfa-academy" / "content" / "curriculum.json"

LEVELS = {"L1": "Level I", "L2": "Level II"}
# topic order and exam weight (approximate midpoints) per level
TOPIC_ORDER = {
    "L1": ["ethics", "quant", "econ", "corp", "fsa", "equity", "fi", "deriv", "alt", "pm"],
}


# ---------- parsing ----------
def parse_notes(path, level):
    text = path.read_text(encoding="utf-8")
    m = re.search(r"^# (.+)$", text, re.M)
    topic = {"name": m[1].strip(), "id": re.search(r"^@topic (\S+)", text, re.M)[1], "level": level}
    concepts = []
    for block in re.split(r"^## ", text, flags=re.M)[1:]:
        title, _, rest = block.partition("\n")
        meta, body = {}, []
        lines = rest.split("\n")
        i = 0
        while i < len(lines) and (lines[i].startswith("@") or not lines[i].strip()) and not body:
            if lines[i].startswith("@"):
                k, _, v = lines[i][1:].partition(" ")
                meta[k] = v.strip()
            i += 1
        body = "\n".join(lines[i:]).strip()
        if "id" not in meta:
            sys.exit(f"{path.name}: concept '{title}' has no @id")
        concepts.append({
            "id": meta["id"],
            "title": title.strip(),
            "topic": topic["id"],
            "level": level,
            "r": [x.strip() for x in meta.get("r", "").split(",") if x.strip()],
            "aka": [x.strip() for x in meta.get("aka", "").split(";") if x.strip()],
            "see": [x.strip() for x in meta.get("see", "").split(";") if x.strip()],
            "md": body,
        })
    return topic, concepts


# ---------- a small Markdown renderer (enough for these notes) ----------
def render(md, known):
    math = []

    def keep(m):
        math.append(m[0])
        return f"\x00{len(math) - 1}\x00"

    md = re.sub(r"\$\$.+?\$\$|\\\(.+?\\\)", keep, md, flags=re.S)

    def inline(s):
        s = html.escape(s, quote=False)
        s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
        s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
        s = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?!\w)", r"<em>\1</em>", s)

        def wl(m):
            cid, _, label = m[1].partition("|")
            cid = cid.strip()
            label = label.strip() or (known[cid]["title"] if cid in known else cid)
            if cid not in known:
                print(f"  warning: link to unknown concept [[{cid}]]")
                return label
            return f'<a href="#c-{cid}" class="xref">{label}</a>'

        s = re.sub(r"\[\[([^\]]+)\]\]", wl, s)
        s = re.sub(r"\[([^\]]+)\]\((https?://[^)]+)\)", r'<a href="\2" target="_blank" rel="noopener">\1</a>', s)
        return s

    out, lines, i = [], md.split("\n"), 0
    while i < len(lines):
        l = lines[i]
        if not l.strip():
            i += 1
        elif l.startswith("### "):
            out.append(f"<h3>{inline(l[4:].strip())}</h3>"); i += 1
        elif (mm := re.fullmatch(r"\s*\x00(\d+)\x00\s*", l)) and math[int(mm[1])].startswith("$$"):
            out.append(f'<div class="math">{l.strip()}</div>'); i += 1
        elif l.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                rows.append([c.strip() for c in lines[i].strip().strip("|").split("|")]); i += 1
            head, body = rows[0], [r for r in rows[1:] if not all(re.fullmatch(r":?-+:?", c) for c in r)]
            t = "<thead><tr>" + "".join(f"<th>{inline(c)}</th>" for c in head) + "</tr></thead><tbody>"
            t += "".join("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>" for r in body)
            out.append(f'<div class="tbl"><table>{t}</tbody></table></div>')
        elif l.startswith(">"):
            buf = []
            while i < len(lines) and lines[i].startswith(">"):
                buf.append(lines[i][1:].strip()); i += 1
            kind = "tip"
            if buf and (m := re.match(r"\*\*(.+?)\*\*", buf[0])):
                w = m[1].lower()
                kind = "warn" if any(k in w for k in ("watch", "trap", "careful", "mistake")) else "work" if "work" in w or "practice" in w else "tip"
            out.append(f'<aside class="callout {kind}">{inline(" ".join(buf))}</aside>')
        elif re.match(r"\s*([-*]|\d+\.)\s", l):
            ordered = bool(re.match(r"\s*\d+\.", l))
            items = []
            while i < len(lines) and (re.match(r"\s*([-*]|\d+\.)\s", lines[i]) or (lines[i].startswith("  ") and lines[i].strip())):
                if re.match(r"\s*([-*]|\d+\.)\s", lines[i]):
                    items.append(re.sub(r"^\s*([-*]|\d+\.)\s+", "", lines[i]))
                else:
                    items[-1] += " " + lines[i].strip()
                i += 1
            tag = "ol" if ordered else "ul"
            out.append(f"<{tag}>" + "".join(f"<li>{inline(x)}</li>" for x in items) + f"</{tag}>")
        else:
            buf = []
            while i < len(lines) and lines[i].strip() and not re.match(r"(### |\||>|\s*([-*]|\d+\.)\s)", lines[i]):
                buf.append(lines[i].strip()); i += 1
            out.append(f"<p>{inline(' '.join(buf))}</p>")
    s = "\n".join(out)
    return re.sub(r"\x00(\d+)\x00", lambda m: html.escape(math[int(m[1])], quote=False), s)


def plain(md):
    s = re.sub(r"\$\$.+?\$\$", " ", md, flags=re.S)
    s = re.sub(r"\\\((.+?)\\\)", " ", s, flags=re.S)
    s = re.sub(r"\[\[([^\]|]+)\|?([^\]]*)\]\]", lambda m: m[2] or m[1].replace("-", " "), s)
    s = re.sub(r"[#*`>|]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def norm(s):
    return re.sub(r"[^a-z0-9]+", " ", s.lower().replace("’", "'")).strip()


# ---------- build ----------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(HERE.parent / "hosting" / "sites" / "cfa-kb"))
    ap.add_argument("--obsidian", help="also export one Markdown note per concept into this folder")
    a = ap.parse_args()

    topics, concepts = [], []
    for lvl in LEVELS:
        for f in sorted((HERE / "notes" / lvl).glob("*.md")):
            t, cs = parse_notes(f, lvl)
            topics.append(t); concepts += cs
    known = {}
    for c in concepts:
        if c["id"] in known:
            sys.exit(f"duplicate concept id {c['id']}")
        known[c["id"]] = c

    cur = json.loads(CURRICULUM.read_text(encoding="utf-8")) if CURRICULUM.is_file() else None
    readings, index_terms = {}, []
    if cur:
        for lv in cur["levels"]:
            lvl = "L1" if str(lv["id"]) in ("1", "L1") else "L2"
            for t in lv["topics"]:
                for r in t["readings"]:
                    readings[f"{lvl}:{r['n']}"] = {
                        "n": r["n"], "title": r["title"], "book": r["book"], "page": r["page"],
                        "modules": [[m["id"], m["title"], m["page"]] for m in r["modules"]],
                        "los": r.get("los", []), "level": lvl, "topicName": t["name"],
                    }
        for c in cur["concepts"]:
            lvl = "L1" if str(c.get("level")) in ("1", "L1") else "L2"
            index_terms.append([c["term"], lvl, [[h["r"], h["b"], h["p"]] for h in c["hits"]]])
    else:
        print("  note: no curriculum.json found, building without book references")

    # where-in-the-books for each concept: index terms equal to its title or an alias
    by_term = {}
    for term, lvl, hits in index_terms:
        by_term.setdefault((lvl, norm(term)), []).extend(hits)
    for c in concepts:
        names = {norm(c["title"]), norm(re.sub(r"\s*\(.*?\)", "", c["title"]))} | {norm(x) for x in c["aka"]}
        hits = []
        for n in names:
            for alt in (n, n + "s", n[:-1] if n.endswith("s") else n):
                hits += by_term.get((c["level"], alt), [])
        c["pages"] = sorted({tuple(h) for h in hits}, key=lambda h: (h[1], h[2]))[:8]

    out_concepts = []
    for c in concepts:
        body = c["md"]
        first = re.split(r"\n\s*\n", body, maxsplit=1)[0]
        out_concepts.append({
            "id": c["id"], "t": c["title"], "tp": c["topic"], "lv": c["level"], "r": c["r"], "aka": c["aka"],
            "see": [s for s in c["see"] if s in known],
            "links": sorted(set(re.findall(r"\[\[([^\]|]+)", body)) & set(known)),
            "sum": plain(first), "txt": plain(body), "html": render(body, known), "pg": c["pages"],
        })
        for s in c["see"]:
            if s not in known:
                print(f"  warning: {c['id']} @see unknown '{s}'")

    data = {"levels": LEVELS, "topicOrder": TOPIC_ORDER, "topics": topics, "concepts": out_concepts,
            "readings": readings, "index": index_terms}
    out = pathlib.Path(a.out).expanduser()
    tmp = out.with_name(out.name + ".new")
    shutil.rmtree(tmp, ignore_errors=True)
    tmp.mkdir(parents=True)
    page = (HERE / "assets" / "page.html").read_text(encoding="utf-8")
    css = (HERE / "assets" / "style.css").read_text(encoding="utf-8")
    js = (HERE / "assets" / "app.js").read_text(encoding="utf-8")
    # index.html: a normal web page for the hosting gateway (css/js as files)
    (tmp / "index.html").write_text(
        '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
        + page.replace("<!--STYLE-->", '<link rel="stylesheet" href="style.css">\n</head><body>')
              .replace("<!--SCRIPT-->", '<script src="app.js"></script>\n</body></html>'), encoding="utf-8")
    shutil.copy(HERE / "assets" / "style.css", tmp)
    shutil.copy(HERE / "assets" / "app.js", tmp)
    # artifact.html: one self-contained fragment (for publishing as a claude.ai artifact beside data.json)
    (tmp / "artifact.html").write_text(
        page.replace("<!--STYLE-->", f"<style>\n{css}</style>").replace("<!--SCRIPT-->", f"<script>\n{js}</script>"), encoding="utf-8")
    (tmp / "data.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    shutil.rmtree(out, ignore_errors=True)
    tmp.rename(out)
    print(f"Built {len(out_concepts)} concepts in {len(topics)} topics, {len(readings)} readings, "
          f"{len(index_terms)} book index terms -> {out}")

    if a.obsidian:
        vault = pathlib.Path(a.obsidian).expanduser()
        vault.mkdir(parents=True, exist_ok=True)
        tname = {t["id"]: t["name"] for t in topics}
        for c in concepts:
            fm = ["---", f"aliases: {json.dumps(c['aka'], ensure_ascii=False)}",
                  f"tags: [cfa/{c['level'].lower()}, cfa/{c['topic']}]",
                  f"readings: {json.dumps(c['r'])}", "---", ""]
            body = re.sub(r"\[\[([^\]|]+)(\|[^\]]*)?\]\]",
                          lambda m: f"[[{known[m[1]]['title'] if m[1] in known else m[1]}{m[2] or ''}]]", c["md"])
            body = re.sub(r"\\\((.+?)\\\)", r"$\1$", body, flags=re.S)
            see = "".join(f"\n- [[{known[s]['title']}]]" for s in c["see"] if s in known)
            text = "\n".join(fm) + f"# {c['title']}\n\n*{tname[c['topic']]}*\n\n{body}\n" + (f"\n## Related{see}\n" if see else "")
            safe = re.sub(r'[\\/:*?"<>|]', "-", c["title"])
            (vault / f"{safe}.md").write_text(text, encoding="utf-8")
        print(f"Wrote {len(concepts)} Obsidian notes -> {vault}")


if __name__ == "__main__":
    main()
