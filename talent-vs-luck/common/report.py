"""Numeric and interactive reports for a finished Talent-vs-Luck run.

Both implementations track the same per-agent story: a final
talent/capital, and a chronological `life_events` log ("what did this
agent actually experience?"). This module turns that into:

- `save_numeric_report`: a JSON file with population-level statistics
  plus a full per-agent table, for scripting/further analysis.
- `save_interactive_report`: a single, dependency-free HTML file you can
  open directly in a browser — a searchable/sortable agent table, and a
  detail panel that shows any agent's capital trajectory and narrated
  life story when you click on them.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import List, Optional, Sequence

import numpy as np

from .stats import summarize_population


def _round(value: float, sig: int = 6) -> float:
    if value == 0 or not np.isfinite(value):
        return float(value)
    return float(f"{value:.{sig}g}")


def _histogram(values: np.ndarray, bins: int = 30, log: bool = False, clip_percentile: float = 0.0) -> dict:
    """Bin edges + counts for a population histogram, JSON-ready.

    `log`-spaced bins are used for capital, which spans many orders of
    magnitude; linear bins for talent, which doesn't.

    `clip_percentile` guards against a single extreme outlier stretching
    the whole axis and squeezing everyone else into a sliver: the *inner*
    bin edges are placed between the `clip_percentile` and
    `100 - clip_percentile` percentiles (so most bins have real
    resolution where the data actually is), while the outermost edges
    are still widened out to the true min/max, so every value is still
    counted somewhere -- outliers just land in a wider catch-all bin at
    either end instead of dictating the whole scale.
    """
    values = np.asarray(values, dtype=float)
    if log:
        values = values[values > 0]
    if values.size == 0:
        return {"edges": [], "counts": [], "log": log}

    true_lo, true_hi = float(values.min()), float(values.max())
    space = values if not log else np.log10(values)
    if clip_percentile > 0 and values.size > 1:
        # percentile is monotonic in its argument, so lo <= hi always --
        # the only degenerate case is lo == hi (the core of the
        # distribution is a spike), handled uniformly below by widening.
        lo, hi = np.percentile(space, [clip_percentile, 100 - clip_percentile])
    else:
        lo, hi = space.min(), space.max()
    if lo == hi:
        lo, hi = lo - 0.5, hi + 0.5

    if log:
        edges = np.logspace(lo, hi, bins + 1)
    else:
        edges = np.linspace(lo, hi, bins + 1)
    edges[0] = min(edges[0], true_lo)
    edges[-1] = max(edges[-1], true_hi)

    counts, edges = np.histogram(values, bins=edges)
    return {"edges": [_round(float(e)) for e in edges], "counts": [int(c) for c in counts], "log": log}


def _agent_rows(talent: np.ndarray, capital: np.ndarray, life_events: Optional[Sequence] = None) -> List[dict]:
    n = capital.size
    order = np.argsort(-capital)
    rank = np.empty(n, dtype=int)
    rank[order] = np.arange(1, n + 1)

    rows = []
    for i in range(n):
        events = life_events[i] if life_events is not None else []
        lucky_seized = sum(1 for e in events if e["type"] == "lucky_seized")
        lucky_missed = sum(1 for e in events if e["type"] == "lucky_missed")
        unlucky = sum(1 for e in events if e["type"] == "unlucky")
        rows.append(
            {
                "id": i,
                "talent": _round(float(talent[i])),
                "capital": _round(float(capital[i])),
                "rank": int(rank[i]),
                "lucky_seized": lucky_seized,
                "lucky_missed": lucky_missed,
                "unlucky": unlucky,
            }
        )
    return rows


def save_numeric_report(
    path: str,
    talent: np.ndarray,
    capital: np.ndarray,
    life_events: Optional[Sequence] = None,
    meta: Optional[dict] = None,
) -> dict:
    """Write a JSON report: population summary + a full per-agent table.

    Returns the report dict as well, in case the caller wants to print
    or further inspect it without re-reading the file.
    """
    summary = summarize_population(talent, capital)
    rows = sorted(_agent_rows(talent, capital, life_events), key=lambda r: r["rank"])
    report = {"meta": meta or {}, "summary": summary, "agents": rows}

    out_path = Path(path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2))
    return report


def save_interactive_report(
    path: str,
    talent: np.ndarray,
    capital: np.ndarray,
    life_events: Optional[Sequence] = None,
    capital_history: Optional[np.ndarray] = None,
    meta: Optional[dict] = None,
) -> None:
    """Write a single-file, offline-capable interactive HTML report.

    `capital_history` is `(n_steps + 1, n_agents)` (or anything that
    converts to that shape) and drives the per-agent trajectory chart;
    `life_events` is a per-agent list of event dicts (as produced by
    `simulation.model.run_simulation` or `spatial_sim.world.World`) and
    drives the narrated timeline. Either can be omitted, in which case
    the report just won't offer that view.
    """
    summary = summarize_population(talent, capital)
    rows = _agent_rows(talent, capital, life_events)

    history_by_agent = None
    if capital_history is not None:
        hist = np.asarray(capital_history, dtype=float)
        history_by_agent = [[_round(float(v)) for v in hist[:, i]] for i in range(hist.shape[1])]

    events_by_agent = None
    if life_events is not None:
        events_by_agent = [
            [
                {
                    "step": e["step"],
                    "type": e["type"],
                    "before": _round(float(e["capital_before"])),
                    "after": _round(float(e["capital_after"])),
                }
                for e in agent_events
            ]
            for agent_events in life_events
        ]

    data = {
        "meta": meta or {},
        "summary": summary,
        "agents": rows,
        "history": history_by_agent,
        "events": events_by_agent,
        "talent_histogram": _histogram(talent, bins=30, log=False),
    }

    json_blob = json.dumps(data, separators=(",", ":")).replace("</script>", "<\\/script>")
    html = _HTML_TEMPLATE.replace("__REPORT_DATA__", json_blob)

    out_path = Path(path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(html, encoding="utf-8")


_HTML_TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Talent vs Luck — run report</title>
<style>
  :root {
    --bg: #f6f6f9;
    --panel: #ffffff;
    --border: #e1e1e7;
    --text: #1b1b22;
    --text-dim: #68686f;
    --accent: #3f6fd8;
    --lucky: #1f9d55;
    --unlucky: #d1453d;
    --highlight: #f0a020;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #131318;
      --panel: #1c1c24;
      --border: #2d2d38;
      --text: #ecedf3;
      --text-dim: #9797a6;
      --accent: #7ea0ff;
      --lucky: #4fce85;
      --unlucky: #ff7b72;
      --highlight: #ffc857;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    padding: 24px 16px 48px;
  }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta-line { color: var(--text-dim); margin: 0 0 20px; font-size: 13px; }
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 10px;
    margin-bottom: 24px;
  }
  .stat {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px 12px;
  }
  .stat-label { font-size: 11px; color: var(--text-dim); text-transform: uppercase; letter-spacing: .04em; }
  .stat-value { font-size: 18px; font-weight: 600; margin-top: 2px; }
  main {
    display: grid;
    grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
    gap: 16px;
    max-width: 1400px;
  }
  @media (max-width: 900px) {
    main { grid-template-columns: 1fr; }
  }
  section.panel {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 14px;
    min-width: 0;
  }
  .panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; gap: 8px; flex-wrap: wrap; }
  .panel-header h2 { font-size: 14px; margin: 0; }
  input#search {
    background: var(--bg);
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: 8px;
    padding: 6px 10px;
    font-size: 13px;
    width: 140px;
  }
  .table-wrap { max-height: 560px; overflow: auto; border: 1px solid var(--border); border-radius: 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead th {
    position: sticky; top: 0;
    background: var(--panel);
    text-align: right;
    padding: 8px 10px;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
  }
  thead th:first-child, thead th:nth-child(2) { text-align: left; }
  tbody td { padding: 6px 10px; text-align: right; border-bottom: 1px solid var(--border); }
  tbody td:first-child, tbody td:nth-child(2) { text-align: left; }
  tbody tr.row { cursor: pointer; }
  tbody tr.row:hover { background: color-mix(in srgb, var(--accent) 10%, transparent); }
  tbody tr.row.selected { background: color-mix(in srgb, var(--accent) 22%, transparent); }
  .jump-buttons { display: flex; gap: 6px; }
  button.jump {
    background: var(--bg);
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: 8px;
    padding: 6px 10px;
    font-size: 12px;
    cursor: pointer;
  }
  button.jump:hover { border-color: var(--accent); color: var(--accent); }
  #detail-empty { color: var(--text-dim); padding: 20px 4px; }
  #detail-stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 12px; }
  #detail-stats div { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; }
  #detail-stats span { display: block; font-size: 11px; color: var(--text-dim); }
  #detail-stats b { font-size: 15px; }
  canvas#chart { width: 100%; height: 160px; display: block; margin-bottom: 12px; }
  ul#timeline { list-style: none; margin: 0; padding: 0; max-height: 320px; overflow: auto; border: 1px solid var(--border); border-radius: 8px; }
  ul#timeline li { display: flex; gap: 8px; align-items: baseline; padding: 7px 10px; border-bottom: 1px solid var(--border); font-size: 13px; }
  ul#timeline li:last-child { border-bottom: none; }
  ul#timeline li.empty { color: var(--text-dim); }
  ul#timeline li .icon { flex: none; }
  ul#timeline li .when { flex: none; color: var(--text-dim); font-variant-numeric: tabular-nums; min-width: 128px; }
  ul#timeline li.lucky .what { color: var(--lucky); }
  ul#timeline li.unlucky .what { color: var(--unlucky); }
  .dist-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    max-width: 1400px;
    margin-bottom: 16px;
  }
  @media (max-width: 900px) {
    .dist-grid { grid-template-columns: 1fr; }
  }
  .dist-title { font-size: 13px; font-weight: 600; margin-bottom: 8px; }
  canvas.dist-chart { width: 100%; height: 140px; display: block; cursor: crosshair; }
  .dist-caption { font-size: 12px; color: var(--text-dim); margin-top: 8px; }
  #chart-tooltip {
    position: fixed;
    display: none;
    background: var(--panel);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 5px 9px;
    border-radius: 6px;
    font-size: 12px;
    pointer-events: none;
    z-index: 50;
    white-space: nowrap;
  }
</style>
</head>
<body>
<h1>Talent vs Luck — run report</h1>
<p class="meta-line" id="meta-line"></p>
<div class="summary-grid" id="summary-grid"></div>

<div class="dist-grid">
  <section class="panel">
    <div class="dist-title" id="talent-dist-title">Talent distribution</div>
    <canvas id="talent-chart" class="dist-chart"></canvas>
    <div class="dist-caption" id="talent-dist-caption"></div>
  </section>
  <section class="panel">
    <div class="dist-title" id="capital-dist-title">Final capital distribution</div>
    <canvas id="capital-chart" class="dist-chart"></canvas>
    <div class="dist-caption" id="capital-dist-caption"></div>
  </section>
</div>

<main>
  <section class="panel">
    <div class="panel-header">
      <h2>Agents</h2>
      <input id="search" type="text" placeholder="Search by id…">
    </div>
    <div class="table-wrap">
      <table id="agent-table">
        <thead>
          <tr>
            <th data-field="rank">Rank</th>
            <th data-field="id">ID</th>
            <th data-field="talent">Talent</th>
            <th data-field="capital">Capital</th>
            <th data-field="lucky_seized">Lucky ✓</th>
            <th data-field="lucky_missed">Lucky ✗</th>
            <th data-field="unlucky">Unlucky</th>
          </tr>
        </thead>
        <tbody id="agent-tbody"></tbody>
      </table>
    </div>
  </section>

  <section class="panel">
    <div class="panel-header">
      <h2 id="detail-title">Select an agent</h2>
      <div class="jump-buttons">
        <button class="jump" id="jump-richest">Wealthiest</button>
        <button class="jump" id="jump-talented">Most talented</button>
      </div>
    </div>
    <div id="detail-empty">Click any row in the agent table to see their capital trajectory and life story.</div>
    <div id="detail-body" hidden>
      <div id="detail-stats"></div>
      <canvas id="chart"></canvas>
      <ul id="timeline"></ul>
    </div>
  </section>
</main>

<div id="chart-tooltip"></div>

<script id="report-data" type="application/json">__REPORT_DATA__</script>
<script>
(function () {
  var data = JSON.parse(document.getElementById('report-data').textContent);
  var agents = data.agents;
  var history = data.history;
  var events = data.events;
  var summary = data.summary;
  var meta = data.meta || {};

  var tbody = document.getElementById('agent-tbody');
  var searchInput = document.getElementById('search');
  var sortState = { field: 'rank', dir: 1 };
  var selectedId = null;

  function fmt(n) {
    if (n === null || n === undefined) return '—';
    var abs = Math.abs(n);
    if (abs === 0) return '0';
    if (abs >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
    // Rounding to 3 decimals would silently print "0" for tiny-but-nonzero
    // capital (an agent many unlucky halvings deep) -- use scientific
    // notation there instead of lying about the value.
    if (abs < 0.001) return n.toExponential(1);
    return (Math.round(n * 1000) / 1000).toString();
  }

  function metaLine() {
    var bits = [];
    if (meta.implementation) bits.push(meta.implementation);
    if (meta.n_agents) bits.push(meta.n_agents + ' agents');
    if (meta.n_steps) bits.push(meta.n_steps + ' steps');
    if (meta.seed !== undefined && meta.seed !== null) bits.push('seed ' + meta.seed);
    if (meta.generated_at) bits.push('generated ' + meta.generated_at);
    return bits.join(' · ');
  }

  function renderSummary() {
    document.getElementById('meta-line').textContent = metaLine();
    var grid = document.getElementById('summary-grid');
    var items = [
      ['Agents', summary.n_agents],
      ['Median capital', fmt(summary.median_capital)],
      ['Mean capital', fmt(summary.mean_capital)],
      ['Gini (capital)', summary.gini_capital.toFixed(3)],
      ['Gini (talent)', summary.gini_talent.toFixed(3)],
      ['Talent↔capital corr.', summary.corr_talent_capital.toFixed(3)],
      ["Richest agent's talent %ile", summary.top_capital_talent_percentile.toFixed(1) + '%'],
      ["Most-talented agent's wealth %ile", summary.max_talent_capital_percentile.toFixed(1) + '%'],
    ];
    grid.innerHTML = items.map(function (it) {
      return '<div class="stat"><div class="stat-label">' + it[0] + '</div><div class="stat-value">' + it[1] + '</div></div>';
    }).join('');
  }

  function sortedAgents() {
    var field = sortState.field, dir = sortState.dir;
    var list = agents.slice();
    list.sort(function (a, b) { return (a[field] - b[field]) * dir; });
    return list;
  }

  function renderTable() {
    var q = searchInput.value.trim();
    var list = sortedAgents();
    if (q !== '') {
      list = list.filter(function (a) { return String(a.id).indexOf(q) !== -1; });
    }
    tbody.innerHTML = list.map(function (a) {
      var cls = 'row' + (a.id === selectedId ? ' selected' : '');
      return '<tr class="' + cls + '" data-id="' + a.id + '">' +
        '<td>' + a.rank + '</td>' +
        '<td>#' + a.id + '</td>' +
        '<td>' + a.talent.toFixed(3) + '</td>' +
        '<td>' + fmt(a.capital) + '</td>' +
        '<td>' + a.lucky_seized + '</td>' +
        '<td>' + a.lucky_missed + '</td>' +
        '<td>' + a.unlucky + '</td>' +
        '</tr>';
    }).join('');
    Array.prototype.forEach.call(tbody.querySelectorAll('tr'), function (tr) {
      tr.addEventListener('click', function () {
        selectAgent(parseInt(tr.getAttribute('data-id'), 10));
      });
    });
  }

  function describeEvent(e) {
    if (e.type === 'lucky_seized') {
      return { icon: '🍀', cls: 'lucky', text: 'Seized a lucky opportunity — capital ' + fmt(e.before) + ' → ' + fmt(e.after) };
    }
    if (e.type === 'lucky_missed') {
      return { icon: '🍀', cls: 'lucky', text: "A lucky opportunity appeared, but talent wasn't enough to seize it — capital stayed at " + fmt(e.before) };
    }
    return { icon: '⚡', cls: 'unlucky', text: 'Hit by misfortune — capital ' + fmt(e.before) + ' → ' + fmt(e.after) };
  }

  function drawChart(values) {
    var canvas = document.getElementById('chart');
    var ctx = canvas.getContext('2d');
    var w = canvas.width = canvas.clientWidth * 2;
    var h = canvas.height = canvas.clientHeight * 2;
    ctx.clearRect(0, 0, w, h);
    var textColor = getComputedStyle(document.body).getPropertyValue('--text-dim').trim();
    if (!values || values.length < 2) {
      ctx.fillStyle = textColor;
      ctx.font = '22px sans-serif';
      ctx.fillText('No trajectory data recorded for this run', 16, h / 2);
      return;
    }
    // Capital can shrink to genuinely tiny (but never zero) values after
    // enough unlucky halvings -- floor only guards against literal 0/NaN,
    // it must not clip real data (a 1e-6 floor used to silently flatten
    // anything smaller than that, which happens well within 80 steps).
    var floor = 1e-300;
    var logs = values.map(function (v) { return Math.log10(v > 0 ? v : floor); });
    var minL = Math.min.apply(null, logs), maxL = Math.max.apply(null, logs);
    if (minL === maxL) { minL -= 1; maxL += 1; }
    var padL = 70, padR = 16, padTB = 16;
    var accent = getComputedStyle(document.body).getPropertyValue('--accent').trim();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.beginPath();
    values.forEach(function (v, i) {
      var x = padL + (i / (values.length - 1)) * (w - padL - padR);
      var yl = (logs[i] - minL) / (maxL - minL);
      var y = h - padTB - yl * (h - padTB * 2);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.fillStyle = textColor;
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'right';
    // Axis labels are the actual plotted min/max (not the first/last data
    // point -- those can be anywhere on the line, e.g. an agent who dips
    // below their starting capital and never fully recovers).
    ctx.fillText(fmt(Math.pow(10, maxL)), padL - 8, padTB + 10);
    ctx.fillText(fmt(Math.pow(10, minL)), padL - 8, h - padTB);
  }

  function drawHistogram(canvasId, hist, opts) {
    opts = opts || {};
    var canvas = document.getElementById(canvasId);
    var ctx = canvas.getContext('2d');
    var w = canvas.width = canvas.clientWidth * 2;
    var h = canvas.height = canvas.clientHeight * 2;
    ctx.clearRect(0, 0, w, h);
    var textColor = getComputedStyle(document.body).getPropertyValue('--text-dim').trim();
    var accent = getComputedStyle(document.body).getPropertyValue('--accent').trim();
    var highlight = getComputedStyle(document.body).getPropertyValue('--highlight').trim();

    if (!hist || !hist.edges || hist.edges.length < 2) {
      ctx.fillStyle = textColor;
      ctx.font = '20px sans-serif';
      ctx.fillText('No data', 16, h / 2);
      return;
    }

    var edges = hist.edges, counts = hist.counts, isLog = hist.log;
    var padL = 46, padR = 12, padT = 14, padB = 26;
    var plotW = w - padL - padR, plotH = h - padT - padB;
    var maxCount = Math.max.apply(null, counts) || 1;
    var loEdge = edges[0], hiEdge = edges[edges.length - 1];
    var logLo = isLog ? Math.log10(loEdge) : 0, logHi = isLog ? Math.log10(hiEdge) : 0;

    function toX(v) {
      var t = isLog ? (Math.log10(v) - logLo) / (logHi - logLo) : (v - loEdge) / (hiEdge - loEdge);
      return padL + t * plotW;
    }

    var bars = [];
    ctx.fillStyle = accent;
    for (var i = 0; i < counts.length; i++) {
      var x0 = toX(edges[i]), x1 = toX(edges[i + 1]);
      var bh = (counts[i] / maxCount) * plotH;
      var y = padT + plotH - bh;
      ctx.fillRect(x0, y, Math.max(x1 - x0 - 1, 1), Math.max(bh, counts[i] > 0 ? 2 : 0));
      bars.push({ x0: x0, x1: x1, count: counts[i], lo: edges[i], hi: edges[i + 1] });
    }

    ctx.strokeStyle = textColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, padT + plotH);
    ctx.lineTo(w - padR, padT + plotH);
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(fmt(loEdge), padL, h - 6);
    ctx.textAlign = 'right';
    ctx.fillText(fmt(hiEdge), w - padR, h - 6);

    function vline(v, color, dashed) {
      if (v < loEdge || v > hiEdge) return;
      var x = toX(v);
      ctx.strokeStyle = color;
      ctx.lineWidth = dashed ? 2 : 3;
      if (dashed) ctx.setLineDash([6, 5]); else ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, padT + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (opts.mean !== undefined && opts.mean !== null) vline(opts.mean, highlight, false);
    if (opts.std) {
      vline(opts.mean - opts.std, highlight, true);
      vline(opts.mean + opts.std, highlight, true);
    }

    var tooltip = document.getElementById('chart-tooltip');
    canvas.onmousemove = function (e) {
      var rect = canvas.getBoundingClientRect();
      var scaleX = canvas.width / rect.width;
      var mx = (e.clientX - rect.left) * scaleX;
      var hitBar = null;
      for (var j = 0; j < bars.length; j++) {
        if (mx >= bars[j].x0 && mx <= bars[j].x1) { hitBar = bars[j]; break; }
      }
      if (hitBar) {
        tooltip.style.display = 'block';
        tooltip.style.left = (e.clientX + 12) + 'px';
        tooltip.style.top = (e.clientY + 12) + 'px';
        tooltip.textContent = fmt(hitBar.lo) + '–' + fmt(hitBar.hi) + ': ' + hitBar.count + ' agent' + (hitBar.count === 1 ? '' : 's');
      } else {
        tooltip.style.display = 'none';
      }
    };
    canvas.onmouseleave = function () { tooltip.style.display = 'none'; };
  }

  // A Pareto/power-law distribution only ever describes a *tail* (zero
  // density below some minimum, monotonically decreasing above it) --
  // a plain histogram of the *whole* population (including the ~40% of
  // agents sitting below the starting capital) can never look like one.
  // The standard way to actually show power-law tail behavior is a
  // log-log rank-size plot: P(capital >= x) vs x. A power-law tail shows
  // up as a straight line here, which a raw histogram cannot reveal.
  function drawParetoTail(canvasId, capitals, paretoExponent, tailFraction) {
    var canvas = document.getElementById(canvasId);
    var ctx = canvas.getContext('2d');
    var w = canvas.width = canvas.clientWidth * 2;
    var h = canvas.height = canvas.clientHeight * 2;
    ctx.clearRect(0, 0, w, h);
    var textColor = getComputedStyle(document.body).getPropertyValue('--text-dim').trim();
    var accent = getComputedStyle(document.body).getPropertyValue('--accent').trim();
    var highlight = getComputedStyle(document.body).getPropertyValue('--highlight').trim();

    var sorted = capitals.filter(function (v) { return v > 0; }).sort(function (a, b) { return b - a; });
    var n = sorted.length;
    if (n < 2) {
      ctx.fillStyle = textColor;
      ctx.font = '20px sans-serif';
      ctx.fillText('No data', 16, h / 2);
      return;
    }

    var logX = sorted.map(function (v) { return Math.log10(v); });
    var logY = sorted.map(function (v, i) { return Math.log10((i + 1) / n); }); // survival prob, always <= 0
    var minLogX = logX[n - 1], maxLogX = logX[0];
    if (minLogX === maxLogX) { minLogX -= 0.5; maxLogX += 0.5; }
    var minLogY = logY[0]; // most negative (rarest / richest point)

    var padL = 52, padR = 12, padT = 14, padB = 26;
    var plotW = w - padL - padR, plotH = h - padT - padB;

    function toX(lx) { return padL + (lx - minLogX) / (maxLogX - minLogX) * plotW; }
    function toY(ly) { return padT + (ly / minLogY) * plotH; } // ly in [minLogY, 0] -> [padT+plotH, padT]

    var points = sorted.map(function (v, i) { return { x: toX(logX[i]), y: toY(logY[i]), value: v, rank: i + 1 }; });

    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    points.forEach(function (p, i) { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
    ctx.stroke();

    // Dashed reference line: the fitted power law over the top
    // `tailFraction` of agents (same convention as the backend's
    // pareto_exponent), anchored at that cutoff point.
    if (paretoExponent !== null && paretoExponent !== undefined) {
      var k = Math.max(Math.floor(n * tailFraction), 5);
      if (k < n) {
        var x0 = sorted[k - 1], y0 = k / n;
        var xMax = sorted[0];
        var logX0 = Math.log10(x0), logY0 = Math.log10(y0);
        var logXMax = Math.log10(xMax);
        var fitStart = { x: toX(logX0), y: toY(logY0) };
        var fitEnd = { x: toX(logXMax), y: toY(logY0 - paretoExponent * (logXMax - logX0)) };
        ctx.strokeStyle = highlight;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.moveTo(fitStart.x, fitStart.y);
        ctx.lineTo(fitEnd.x, fitEnd.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    ctx.strokeStyle = textColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, padT + plotH);
    ctx.lineTo(w - padR, padT + plotH);
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(fmt(sorted[n - 1]), padL, h - 6);
    ctx.textAlign = 'right';
    ctx.fillText(fmt(sorted[0]), w - padR, h - 6);

    var tooltip = document.getElementById('chart-tooltip');
    canvas.onmousemove = function (e) {
      var rect = canvas.getBoundingClientRect();
      var scaleX = canvas.width / rect.width;
      var mx = (e.clientX - rect.left) * scaleX;
      var nearest = null, bestDist = Infinity;
      for (var j = 0; j < points.length; j++) {
        var d = Math.abs(points[j].x - mx);
        if (d < bestDist) { bestDist = d; nearest = points[j]; }
      }
      if (nearest) {
        tooltip.style.display = 'block';
        tooltip.style.left = (e.clientX + 12) + 'px';
        tooltip.style.top = (e.clientY + 12) + 'px';
        tooltip.textContent = fmt(nearest.rank) + ' of ' + n + ' agents (' + (100 * nearest.rank / n).toFixed(1) + '%) have capital ≥ ' + fmt(nearest.value);
      } else {
        tooltip.style.display = 'none';
      }
    };
    canvas.onmouseleave = function () { tooltip.style.display = 'none'; };
  }

  function renderDistributions() {
    drawHistogram('talent-chart', data.talent_histogram, { mean: summary.mean_talent, std: summary.std_talent });
    document.getElementById('talent-dist-title').textContent =
      'Talent distribution — Normal(μ=' + summary.mean_talent.toFixed(3) + ', σ=' + summary.std_talent.toFixed(3) + ')';
    document.getElementById('talent-dist-caption').textContent =
      'Solid line = mean (' + summary.mean_talent.toFixed(3) + '); dashed lines = ±1 std dev (' + summary.std_talent.toFixed(3) + '). Hover a bar for its count.';

    var capitals = agents.map(function (a) { return a.capital; });
    drawParetoTail('capital-chart', capitals, summary.pareto_exponent, 0.2);
    document.getElementById('capital-dist-title').textContent =
      'Final capital — Pareto tail (log-log rank-size)' +
      (summary.pareto_exponent !== null && summary.pareto_exponent !== undefined
        ? ', exponent ≈ ' + summary.pareto_exponent.toFixed(2)
        : '');
    document.getElementById('capital-dist-caption').textContent =
      'P(capital ≥ x), both axes log-scale: a straight line means a Pareto (power-law) tail, the paper’s headline claim about wealth. ' +
      'Dashed line = fitted power law on the wealthiest 20%. Median capital ' + fmt(summary.median_capital) +
      ' vs. mean ' + fmt(summary.mean_capital) + ' shows how far a few outliers pull the average above the typical outcome. Hover the curve for exact rank/value.';
  }

  function selectAgent(id) {
    selectedId = id;
    var agent = agents[id];
    document.getElementById('detail-empty').hidden = true;
    document.getElementById('detail-body').hidden = false;
    document.getElementById('detail-title').textContent = 'Agent #' + id;
    document.getElementById('detail-stats').innerHTML =
      '<div><span>Talent</span><b>' + agent.talent.toFixed(3) + '</b></div>' +
      '<div><span>Final capital</span><b>' + fmt(agent.capital) + '</b></div>' +
      '<div><span>Wealth rank</span><b>' + agent.rank + ' / ' + summary.n_agents + '</b></div>' +
      '<div><span>Lucky seized / missed</span><b>' + agent.lucky_seized + ' / ' + agent.lucky_missed + '</b></div>' +
      '<div><span>Unlucky hits</span><b>' + agent.unlucky + '</b></div>';

    drawChart(history ? history[id] : null);

    var timeline = document.getElementById('timeline');
    var evs = events ? events[id] : [];
    if (!evs || evs.length === 0) {
      timeline.innerHTML = '<li class="empty">No notable events — a quiet, uneventful career.</li>';
    } else {
      timeline.innerHTML = evs.map(function (e) {
        var d = describeEvent(e);
        return '<li class="' + d.cls + '"><span class="icon">' + d.icon + '</span>' +
          '<span class="when">Step ' + e.step + ' (year ' + (e.step / 2).toFixed(1) + ')</span>' +
          '<span class="what">' + d.text + '</span></li>';
      }).join('');
    }

    renderTable();
  }

  Array.prototype.forEach.call(document.querySelectorAll('#agent-table th[data-field]'), function (th) {
    th.addEventListener('click', function () {
      var field = th.getAttribute('data-field');
      if (sortState.field === field) { sortState.dir *= -1; }
      else { sortState.field = field; sortState.dir = field === 'rank' ? 1 : -1; }
      renderTable();
    });
  });

  searchInput.addEventListener('input', renderTable);
  document.getElementById('jump-richest').addEventListener('click', function () { selectAgent(summary.top_capital_agent_id); });
  document.getElementById('jump-talented').addEventListener('click', function () { selectAgent(summary.max_talent_agent_id); });

  renderSummary();
  renderDistributions();
  renderTable();
  selectAgent(summary.top_capital_agent_id);

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      renderDistributions();
      if (selectedId !== null) drawChart(history ? history[selectedId] : null);
    }, 150);
  });
})();
</script>
</body>
</html>
"""
