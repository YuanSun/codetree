#!/usr/bin/env python3
"""Build Grace's writing page: her correction reports to study, plus progress once pieces are scored.

  ./build.py [content_dir] [output_dir]     (defaults: ./content  ->  ../hosting/sites/writing)

Every NAME.html in content_dir is a correction report Claude produced; each one is listed for Grace to open.
An optional NAME.json next to it is a small scorecard (format in README.md); scored pieces are compared
over time. Plain Python standard library; the output is static files with relative links (/writing/).
Content and output are private (git-ignored).
"""
import datetime, html, json, pathlib, re, shutil, sys

HERE = pathlib.Path(__file__).resolve().parent
SRC = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "content"
OUT = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else HERE.parent / "hosting" / "sites" / "writing"

# Fixed keys, so every piece is scored on the same rows and the rows stay comparable over time.
CRITERIA = [
    ("organisation", "Organisation"),
    ("consigne", "Respect de la consigne"),
    ("vocabulaire", "Vocabulaire"),
    ("syntaxe", "Syntaxe"),
    ("accords", "Accords / genre"),
]
LEVELS = {1: "À travailler", 2: "À consolider", 3: "Bien", 4: "Très bien"}
ERRORS = [
    ("pronoms", "Pronoms / personne"),
    ("genre", "Genre des noms"),
    ("accord", "Accord adjectif / participe"),
    ("conjugaison", "Conjugaison / verbes pronominaux"),
    ("prepositions", "Prépositions"),
    ("vocabulaire", "Mot juste / calques"),
    ("syntaxe", "Syntaxe / phrase"),
    ("orthographe", "Orthographe"),
    ("ponctuation", "Ponctuation"),
]
DATE = re.compile(r"^\d{4}-\d{2}(-\d{2})?$")


class BadScorecard(ValueError):
    pass


def load(path):
    """Read and check one scorecard; unknown keys are refused so a typo can't start a new row."""
    try:
        d = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise BadScorecard(f"{path.name}: not valid JSON ({e})")

    def need(cond, msg):
        if not cond:
            raise BadScorecard(f"{path.name}: {msg}")

    need(isinstance(d.get("title"), str) and d["title"], "needs a title")
    need(isinstance(d.get("date"), str) and DATE.match(d["date"]), "date must be YYYY-MM-DD (or YYYY-MM)")
    for k in ("words", "target_words"):
        need(isinstance(d.get(k), int) and d[k] > 0, f"{k} must be a positive whole number")
    ratings, errors = d.get("ratings", {}), d.get("errors", {})
    crit, cats = dict(CRITERIA), dict(ERRORS)
    for k, v in ratings.items():
        need(k in crit, f"unknown rating '{k}' (use: {', '.join(crit)})")
        need(v in LEVELS, f"rating {k} must be 1-4")
    for k, v in errors.items():
        need(k in cats, f"unknown error category '{k}' (use: {', '.join(cats)})")
        need(isinstance(v, int) and v >= 0, f"error count {k} must be a whole number")
    for k in d.get("recurring", []):
        need(k in cats, f"recurring '{k}' is not an error category")
    report = d.get("report") or path.with_suffix(".html").name
    need((path.parent / report).is_file(), f"report file {report} not found next to it")
    d.update(id=path.stem, report=report, ratings=ratings, errors=errors,
             recurring=d.get("recurring", []), priorities=d.get("priorities", []))
    return d


def report_entry(path, scored):
    """A report to list. Title from its <title>; date from the scorecard, the file name (2026-11-...), or the file."""
    if path.stem in scored:
        p = scored[path.stem]
        return {"id": path.stem, "title": p["title"], "date": p["date"], "source": p.get("source", ""), "piece": p}
    head = path.read_text(encoding="utf-8", errors="replace")[:4000]
    m = re.search(r"<title>(.*?)</title>", head, re.S | re.I)
    title = html.unescape(re.sub(r"\s+", " ", m.group(1)).strip()) if m else path.stem
    d = re.match(r"(\d{4}-\d{2}(-\d{2})?)", path.stem)
    date = d.group(1) if d else datetime.date.fromtimestamp(path.stat().st_mtime).isoformat()
    return {"id": path.stem, "title": title, "date": date, "source": "", "piece": None}


def esc(s):
    return html.escape(str(s))


def per100(n, words):
    return round(n * 100 / words, 1)


def short_date(d):
    months = "janv. févr. mars avr. mai juin juil. août sept. oct. nov. déc.".split()
    y, m, *rest = d.split("-")
    return (f"{int(rest[0])} " if rest else "") + f"{months[int(m) - 1]} {y}"


def tile(label, value, note=""):
    return f'<div class="tile"><span>{esc(label)}</span><b>{value}</b><small>{note}</small></div>'


def change(now, before, lower_is_better=True):
    if before is None:
        return "first piece"
    diff = round(now - before, 1)
    if diff == 0:
        return "same as last time"
    better = (diff < 0) == lower_is_better
    arrow = "▼" if diff < 0 else "▲"
    return f'<em class="{"up" if better else "down"}">{arrow} {abs(diff):g}</em> vs last piece'


def col_heads(pieces):
    return "".join(f'<th scope="col"><a href="reports/{esc(p["report"])}">{esc(short_date(p["date"]))}</a>'
                   f'<small>{esc(p["title"])}</small></th>' for p in pieces)


def ratings_table(pieces):
    rows = []
    for key, label in CRITERIA:
        cells = []
        for p in pieces:
            v = p["ratings"].get(key)
            tip = f'{label} · {short_date(p["date"])}'
            cells.append(f'<td class="lv lv{v}" data-tip="{esc(tip)}: {esc(LEVELS[v])}">{v} <small>{esc(LEVELS[v])}</small></td>'
                         if v else '<td class="lv none" data-tip="not rated">–</td>')
        rows.append(f'<tr><th scope="row">{esc(label)}</th>{"".join(cells)}</tr>')
    return f'<table class="grid"><thead><tr><th></th>{col_heads(pieces)}</tr></thead><tbody>{"".join(rows)}</tbody></table>'


def errors_table(pieces):
    used = [(k, l) for k, l in ERRORS if any(p["errors"].get(k) for p in pieces)]
    top = max([per100(p["errors"].get(k, 0), p["words"]) for p in pieces for k, _ in used] or [1]) or 1
    rows = []
    for key, label in used:
        cells = []
        for p in pieces:
            n = p["errors"].get(key, 0)
            r = per100(n, p["words"])
            flag = ' <span class="rec" title="flagged as recurring in this report">⚠</span>' if key in p["recurring"] else ""
            cells.append(f'<td class="err" data-tip="{esc(label)}: {n} error(s) in {p["words"]} words = {r:g} per 100 words">'
                         f'<span class="num">{n}{flag}</span><i style="width:{max(r / top * 100, 2 if n else 0):.0f}%"></i></td>')
        rows.append(f'<tr><th scope="row">{esc(label)}</th>{"".join(cells)}</tr>')
    totals = "".join(f'<td class="err tot">{sum(p["errors"].values())} <small>· {per100(sum(p["errors"].values()), p["words"]):g}/100 mots</small></td>'
                     for p in pieces)
    return (f'<table class="grid"><thead><tr><th></th>{col_heads(pieces)}</tr></thead><tbody>{"".join(rows)}'
            f'<tr class="total"><th scope="row">Total</th>{totals}</tr></tbody></table>')


def length_chart(pieces):
    top = max(max(p["words"], p["target_words"]) for p in pieces) * 1.1
    bars = []
    for p in pieces:
        w, t = p["words"], p["target_words"]
        bars.append(f'<div class="len" data-tip="{esc(short_date(p["date"]))}: {w} words written, target {t}">'
                    f'<span class="lab">{esc(short_date(p["date"]))}</span>'
                    f'<span class="track"><i style="width:{w / top * 100:.1f}%"></i><b style="left:{t / top * 100:.1f}%"></b></span>'
                    f'<span class="val">{w} <small>/ {t}</small></span></div>')
    return "".join(bars)


PAGE = """<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Grace's Writing</title><link rel="stylesheet" href="style.css"></head>
<body><header class="top"><a class="brand" href="../">← Home Hub</a><span class="sub">✍️ Writing · Grace</span><a class="side" href="../exam/">Brébeuf exam notes →</a></header>
<main>{body}</main><div id="tip" role="tooltip" hidden></div><script src="app.js"></script></body></html>
"""


def study_list(reports):
    items = []
    for r in reports:
        p = r["piece"]
        extra = f' · {p["words"]} mots · {sum(p["errors"].values())} erreurs' if p else ""
        items.append(f'<a class="piece" href="reports/{esc(r["id"])}.html"><b>{esc(r["title"])}</b>'
                     f'<span>{esc(short_date(r["date"]))}{" · " + esc(r["source"]) if r["source"] else ""}{extra}</span></a>')
    return f'<section class="panel"><h2>Corrections to study</h2>{"".join(items)}</section>'


def page(reports, pieces):
    head = ('<section class="hero"><h1>Writing</h1><p class="lead">Grace\'s French writing, corrected by Claude. '
            'Open a correction to study it.</p></section>' + study_list(reports))
    if not pieces:
        return PAGE.format(body=head)
    return PAGE.format(body=head + progress(pieces))


def progress(pieces):
    last = pieces[-1]
    prev = pieces[-2] if len(pieces) > 1 else None
    total = lambda p: sum(p["errors"].values())
    rate = per100(total(last), last["words"])
    rate_prev = per100(total(prev), prev["words"]) if prev else None
    over = round((last["words"] / last["target_words"] - 1) * 100)
    over_prev = round((prev["words"] / prev["target_words"] - 1) * 100) if prev else None
    recurring = [l for k, l in ERRORS if k in last["recurring"]]
    tiles = "".join([
        tile("Pieces scored", len(pieces), f"since {short_date(pieces[0]['date'])}"),
        tile("Errors per 100 words", f"{rate:g}", change(rate, rate_prev)),
        tile("Length vs target", f"{over:+d}%", f"{last['words']} / {last['target_words']} words · " + change(abs(over), abs(over_prev) if prev else None)),
        tile("Recurring now", len(recurring), esc(", ".join(recurring)) or "none flagged"),
    ])
    prios = "".join(f"<li>{esc(x)}</li>" for x in last["priorities"])
    hint = '<p class="hint">Trends appear from the second corrected piece onward; each new scorecard adds a column.</p>' if len(pieces) == 1 else ""
    return f"""
<h2 class="part">Progress <small>(pieces with a scorecard)</small></h2>
<section class="tiles">{tiles}</section>
{f'<section class="panel"><h2>Working on now</h2><ol class="prios">{prios}</ol><p class="hint">From the latest report: <a href="reports/{esc(last["report"])}">{esc(last["title"])}</a></p></section>' if prios else ''}
<section class="panel"><h2>Ratings by piece</h2>{hint}<div class="scroll">{ratings_table(pieces)}</div>
<p class="legend"><span class="sw lv1"></span>1 À travailler <span class="sw lv2"></span>2 À consolider <span class="sw lv3"></span>3 Bien <span class="sw lv4"></span>4 Très bien
 · qualitative ratings from each report, not an official grid</p></section>
<section class="panel"><h2>Errors by type</h2><div class="scroll">{errors_table(pieces)}</div>
<p class="legend">Number = errors found; bar = errors per 100 words, so longer and shorter pieces compare fairly. ⚠ = flagged as recurring.</p></section>
<section class="panel"><h2>Length vs target</h2>{length_chart(pieces)}<p class="legend">Bar = words written · vertical tick = target length</p></section>"""


def main():
    files = sorted(SRC.glob("*.html")) if SRC.is_dir() else []
    if not files:
        sys.exit(f"No correction reports (*.html) in {SRC} (see README.md).")
    try:
        pieces = sorted((load(c) for c in sorted(SRC.glob("*.json"))), key=lambda p: (p["date"], p["id"]))
    except BadScorecard as e:
        sys.exit(f"Scorecard problem: {e}")
    scored = {p["report"][:-5]: p for p in pieces if p["report"].endswith(".html")}
    reports = sorted((report_entry(f, scored) for f in files), key=lambda r: (r["date"], r["id"]), reverse=True)
    tmp = OUT.with_name(OUT.name + ".new")
    shutil.rmtree(tmp, ignore_errors=True)
    (tmp / "reports").mkdir(parents=True)
    for f in files:
        shutil.copy2(f, tmp / "reports" / f.name)
    (tmp / "index.html").write_text(page(reports, pieces), encoding="utf-8")
    (tmp / "data.json").write_text(json.dumps(pieces, ensure_ascii=False, indent=1), encoding="utf-8")
    for f in ("style.css", "app.js"):
        shutil.copy2(HERE / "assets" / f, tmp / f)
    shutil.rmtree(OUT, ignore_errors=True)
    tmp.rename(OUT)
    print(f"Built {len(reports)} report(s), {len(pieces)} with a scorecard -> {OUT}")


if __name__ == "__main__":
    main()
