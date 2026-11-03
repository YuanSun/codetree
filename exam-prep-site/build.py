#!/usr/bin/env python3
"""Build the exam-prep website from notes exported by export_apple_notes.py.

  ./build.py [content_dir] [output_dir]     (defaults: ./content  ->  ../hosting/sites/exam)

The result is plain static files with relative links, so it works under any path (/exam/).
Needs pandoc to turn each note's Markdown into HTML. Notes and output are private: both are git-ignored.
"""
import html, json, pathlib, re, shutil, subprocess, sys, unicodedata
from urllib.parse import quote

HERE = pathlib.Path(__file__).resolve().parent
SRC = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "content"
OUT = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else HERE.parent / "hosting" / "sites" / "exam"

# subject tag -> keywords looked for in the title and the attachment names
SUBJECTS = [
    ("Math", ["math", "maths", "mathématiques", "devoir"]),
    ("Logic", ["logic", "logique"]),
    ("French", ["french", "frech", "français", "francais", "culture", "lecture", "comprehension", "sushis", "vocab"]),
    ("Writing", ["writing", "writ", "passion", "lighthouse", "rédaction", "panne", "amitie"]),
    ("Interview", ["interview", "entrevue"]),
]
KIND = [("Mock exam", ["mock", "sample", "final"]), ("Review", ["review", "correction", "report", "feedback", "results"]),
        ("Class note", ["class note", "lesson", "冲刺", "theme"])]


def tags_for(text, table):
    t = text.lower()
    return [name for name, words in table if any(w in t for w in words)]


def ascii_slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:40]


def parse(md_path):
    raw = md_path.read_text(encoding="utf-8")
    m = re.match(r"---\n(.*?)\n---\n(.*)", raw, re.S)
    meta, body = {}, raw
    if m:
        for line in m.group(1).splitlines():
            k, _, v = line.partition(":")
            meta[k.strip()] = v.strip().strip('"')
        body = m.group(2)
    return meta, body


def attachment_section(body):
    """Split off the '## Attachments' list written by the exporter."""
    head, _, tail = body.partition("\n## Attachments\n")
    files = re.findall(r"\]\(([^)]+)\)", tail)
    return head.strip(), [pathlib.PurePosixPath(re.sub(r"%20", " ", f)) for f in files]


def to_html(md):
    if not md.strip():
        return ""
    r = subprocess.run(["pandoc", "-f", "gfm", "-t", "html", "--wrap=none"], input=md, capture_output=True, text=True)
    if r.returncode:
        sys.exit("pandoc failed: " + r.stderr)
    return r.stdout


def plain(h):
    t = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", h))).strip()
    return re.sub(r"^(\W*\*\W*)+", "", t)


PAGE = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title><link rel="stylesheet" href="{root}style.css"></head>
<body><header class="top"><a class="brand" href="{root}index.html">📚 Exam Prep</a><span class="sub">Grace · Brébeuf HU</span></header>
<main>{body}</main>{script}</body></html>
"""


def main():
    if not SRC.is_dir() or not any(SRC.glob("*.md")):
        sys.exit(f"No notes in {SRC}. Run ./export_apple_notes.py ExamPreparation {SRC} first.")
    tmp = OUT.with_name(OUT.name + ".new")
    shutil.rmtree(tmp, ignore_errors=True)
    (tmp / "n").mkdir(parents=True)
    notes = []
    for i, md in enumerate(sorted(SRC.glob("*.md")), 1):
        meta, body = parse(md)
        text, files = attachment_section(body)
        title = meta.get("title", md.stem)
        slug = f"{i:02d}-{ascii_slug(title) or 'note'}"
        names = " ".join(f.name for f in files)
        subjects = tags_for(title + " " + names, SUBJECTS) or ["Other"]
        kind = (tags_for(title + " " + names, KIND) or ["Note"])[0]
        att = []
        for f in files:
            src = SRC / f
            if not src.is_file():
                continue
            dst = pathlib.Path("files") / slug / re.sub(r"^\d+-", "", f.name)
            (tmp / dst.parent).mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, tmp / dst)
            att.append({"name": dst.name, "href": "../" + quote(dst.as_posix()), "kind": dst.suffix.lower().lstrip(".")})
        body_html = to_html(text)
        notes.append({"slug": slug, "title": title, "date": meta.get("date", ""), "subjects": subjects, "kind": kind,
                      "attachments": att, "html": body_html, "text": plain(body_html)})

    for n in notes:
        chips = "".join(f'<span class="chip s-{s.lower()}">{s}</span>' for s in n["subjects"]) + f'<span class="chip kind">{n["kind"]}</span>'
        items = []
        for a in n["attachments"]:
            icon = {"pdf": "📄", "html": "🌐"}.get(a["kind"], "📎")
            items.append(f'<li>{icon} <a href="{a["href"]}" target="_blank" rel="noopener">{html.escape(a["name"])}</a></li>')
        previews = [a for a in n["attachments"] if a["kind"] in ("html", "pdf")]
        first = next((a for a in previews if a["kind"] == "html"), None)   # HTML reports preview more reliably than PDFs
        embeds = "".join(
            f'<details class="embed"{" open" if a is first else ""}><summary>{html.escape(a["name"])}</summary>'
            f'<iframe src="{a["href"]}" loading="lazy"></iframe></details>'
            for a in previews)
        body = (f'<p class="crumb"><a href="../index.html">← All notes</a></p><h1>{html.escape(n["title"])}</h1>'
                f'<p class="meta">{n["date"]} {chips}</p>'
                + (f'<section class="note">{n["html"]}</section>' if n["html"] else "")
                + (f'<h2>Files</h2><ul class="files">{"".join(items)}</ul><h2>Preview</h2>{embeds}' if items else ""))
        (tmp / "n" / f'{n["slug"]}.html').write_text(PAGE.format(title=html.escape(n["title"]), root="../", body=body, script=""), encoding="utf-8")

    data = [{"slug": n["slug"], "title": n["title"], "date": n["date"], "subjects": n["subjects"], "kind": n["kind"],
             "files": len(n["attachments"]), "text": n["text"][:4000]} for n in notes]
    index = """
<section class="hero"><h1>Exam preparation log</h1><p class="lead"><span id="count"></span> notes · <span id="files"></span> reports and exam papers</p></section>
<section class="panel"><h2>Activity by month</h2><div id="chart" class="chart"></div></section>
<section class="controls"><input id="q" type="search" placeholder="Search titles and notes…" autocomplete="off"><div id="chips" class="chips"></div></section>
<div id="list"></div>"""
    script = f'<script>const NOTES={json.dumps(data, ensure_ascii=False)};</script><script src="app.js"></script>'
    (tmp / "index.html").write_text(PAGE.format(title="Exam Prep", root="", body=index, script=script), encoding="utf-8")
    shutil.copy2(HERE / "assets" / "style.css", tmp / "style.css")
    shutil.copy2(HERE / "assets" / "app.js", tmp / "app.js")

    shutil.rmtree(OUT, ignore_errors=True)
    tmp.rename(OUT)
    print(f"Built {len(notes)} notes -> {OUT}")


if __name__ == "__main__":
    main()
