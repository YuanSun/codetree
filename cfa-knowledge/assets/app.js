/* CFA knowledge base: hash-routed single page over data.json, with a forgiving search engine.
   Routes (plain #name so they also survive inside claude.ai artifacts):
     #home  #t-<topic>  #c-<concept>  #r-<L1>-<n>  #q-<words-joined-by-hyphens> */
(function () {
  "use strict";
  const TOPICS = {
    L1: {
      ethics: { short: "Ethics", w: "15–20%" }, quant: { short: "Quant", w: "6–9%" }, econ: { short: "Economics", w: "6–9%" },
      corp: { short: "Corporate Issuers", w: "6–9%" }, fsa: { short: "FSA", w: "11–14%" }, equity: { short: "Equity", w: "11–14%" },
      fi: { short: "Fixed Income", w: "11–14%" }, deriv: { short: "Derivatives", w: "5–8%" }, alt: { short: "Alternatives", w: "7–10%" },
      pm: { short: "Portfolio Mgmt", w: "8–12%" },
    },
    L2: {
      ethics2: { short: "Ethics", w: "10–15%" }, quant2: { short: "Quant", w: "5–10%" }, econ2: { short: "Economics", w: "5–10%" },
      corp2: { short: "Corporate Issuers", w: "5–10%" }, fsa2: { short: "FSA", w: "10–15%" }, equity2: { short: "Equity Valuation", w: "10–15%" },
      fi2: { short: "Fixed Income", w: "10–15%" }, deriv2: { short: "Derivatives", w: "5–10%" }, alt2: { short: "Alternatives", w: "5–10%" },
      pm2: { short: "Portfolio Mgmt", w: "10–15%" },
    },
  };
  const LV = { L1: "Level I", L2: "Level II" };
  const TI = (tp) => TOPICS.L1[tp] || TOPICS.L2[tp] || {};
  const twin = (tp) => (tp.endsWith("2") ? tp.slice(0, -1) : tp + "2");
  const STOP = new Set("a an the of to in for and or is are be on with by at as it its what how do does did i my me we you your can could should would which when why where who whom this that these those vs versus between from into about than then there their them they get got use used using mean means meaning definition define explain tell show give find calculate compute work works".split(" "));
  STOP.delete("mean"); // "mean" is a statistics concept: keep it searchable
  const SYN = {
    vol: "volatility standard deviation", volatility: "standard deviation", stdev: "standard deviation", std: "standard deviation", sd: "standard deviation", sigma: "standard deviation",
    corr: "correlation", cov: "covariance", ret: "return", rtn: "return", px: "price", yld: "yield", bp: "basis point", bps: "basis point",
    fx: "exchange rate currency", forex: "exchange rate currency", currency: "exchange rate", pe: "price earnings", p: "price", div: "dividend", divs: "dividend",
    capex: "capital expenditure investment", fcf: "free cash flow", opex: "operating expense", lev: "leverage", mgmt: "management", dep: "depreciation", depr: "depreciation",
    amort: "amortization", inv: "inventory", ar: "receivable", ap: "payable", eq: "equity", fi: "fixed income bond", bond: "fixed income", bonds: "fixed income",
    stock: "equity share", stocks: "equity share", shares: "equity", rates: "interest rate", rate: "interest", sensitivity: "duration", risky: "risk",
    profit: "income earnings", profits: "earnings", earnings: "income", loan: "debt", loans: "debt", borrowing: "debt", inflation: "cpi price level",
    hedge: "hedging derivative", crypto: "digital asset cryptocurrency", bitcoin: "digital asset cryptocurrency", reit: "real estate", ipo: "initial public offering",
    lbo: "leveraged buyout", vc: "venture capital", pv: "present value", fv: "future value", ytm: "yield to maturity", eps: "earnings per share",
    roe: "return on equity", roa: "return on assets", ebit: "operating income", cogs: "cost of goods sold", cagr: "geometric mean compound annual growth",
    insider: "material nonpublic information", sharpe: "sharpe ratio", treynor: "treynor ratio", alpha: "jensen alpha abnormal return",
  };

  // ---------- text helpers ----------
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const norm = (s) => String(s).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  function stem(w) {
    if (w.length <= 3 || /^\d/.test(w)) return w;
    if (w.endsWith("ies") && w.length > 4) w = w.slice(0, -3) + "y";
    else if (w.endsWith("sses")) w = w.slice(0, -2);
    else if (w.endsWith("ing") && w.length > 5) w = w.slice(0, -3);
    else if (w.endsWith("ed") && w.length > 4) w = w.slice(0, -2);
    else if (w.endsWith("s") && !/(ss|us|is)$/.test(w)) w = w.slice(0, -1);
    if (w.endsWith("e") && w.length > 3) w = w.slice(0, -1);
    return w;
  }
  const toks = (s, keepStop) => norm(s).split(" ").filter((w) => w && (keepStop || !STOP.has(w))).map(stem);
  const SMALL = new Set(["of", "and", "the", "to", "for", "in", "on", "a", "an", "vs", "with", "by"]);
  function acronyms(phrase) {
    const out = [];
    const words = norm(phrase.replace(/\(.*?\)/g, " ")).split(" ").filter((w) => w && !SMALL.has(w));
    if (words.length >= 2 && words.length <= 7) out.push(words.map((w) => w[0]).join(""));
    for (const m of phrase.matchAll(/\(([^)]+)\)/g)) out.push(...norm(m[1]).split(" "));
    return out;
  }
  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i]; let best = i;
      for (let j = 1; j <= b.length; j++) {
        let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        cur.push(v); if (v < best) best = v;
      }
      if (best > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }

  // ---------- search engine ----------
  class Engine {
    constructor(docs, weights) {
      this.docs = docs; this.inv = new Map(); this.W = weights;
      docs.forEach((d, i) => {
        const tf = new Map();
        for (const [f, w] of Object.entries(weights)) for (const t of d.f[f] || []) tf.set(t, (tf.get(t) || 0) + w);
        for (const [t, v] of tf) { if (!this.inv.has(t)) this.inv.set(t, new Map()); this.inv.get(t).set(i, v); }
      });
      this.vocab = [...this.inv.keys()];
      this.N = docs.length;
    }
    expand(q) {
      // vocabulary terms a query token may stand for, with a similarity weight
      const out = new Map();
      if (this.inv.has(q)) out.set(q, 1);
      if (q.length >= 3) for (const v of this.vocab) if (v !== q && v.startsWith(q)) out.set(v, Math.max(out.get(v) || 0, q.length >= 5 ? 0.8 : 0.6));
      if (q.length >= 4) {
        const max = q.length >= 7 ? 2 : 1;
        for (const v of this.vocab) {
          if (out.has(v) || Math.abs(v.length - q.length) > max || v[0] !== q[0] && max === 1) continue;
          const d = lev(q, v, max);
          if (d <= max) out.set(v, d === 1 ? 0.65 : 0.45);
        }
      }
      return out;
    }
    search(query, opts = {}) {
      const main = [...new Set(toks(query))];
      if (!main.length) return { hits: [], terms: [], fixes: [] };
      const extra = [];
      for (const w of norm(query).split(" ")) if (SYN[w]) extra.push(...toks(SYN[w]));
      const score = new Map(), cover = new Map(), terms = new Set(), fixes = [];
      const idf = (t) => Math.log(1 + this.N / this.inv.get(t).size);
      const add = (qt, weight, counts) => {
        const ex = this.expand(qt);
        if (counts && !ex.has(qt) && ex.size) {
          const best = [...ex.entries()].sort((a, b) => b[1] - a[1])[0];
          if (best[1] < 1) fixes.push(best[0]);
        }
        const per = new Map();
        for (const [t, sim] of ex) {
          terms.add(t);
          const w = sim * idf(t) * weight;
          for (const [i, tf] of this.inv.get(t)) {
            const v = w * (1 + Math.log(tf));
            if (v > (per.get(i) || 0)) per.set(i, v);
          }
        }
        for (const [i, v] of per) {
          score.set(i, (score.get(i) || 0) + v);
          if (counts) cover.set(i, (cover.get(i) || 0) + 1);
        }
      };
      main.forEach((t) => add(t, 1, true));
      extra.filter((t) => !main.includes(t)).forEach((t) => add(t, 0.55, false));
      const qn = main.join(" ");
      const hits = [];
      for (const [i, s] of score) {
        const d = this.docs[i], c = (cover.get(i) || 0) / main.length;
        let v = s * (0.2 + 0.8 * c * c);
        if (d.tt && main.every((t) => d.tt.has(t))) v += Math.max(4, 14 - d.tt.size * 1.5);
        if (d.ph) {
          if (d.ph[0] === qn) v += 40;
          else if (d.ph.some((p) => p === qn)) v += 30;
          else if (qn.length > 3 && d.ph[0].startsWith(qn)) v += 25;
          else if (qn.length > 3 && d.ph.some((p) => p.includes(qn))) v += 12;
        }
        hits.push({ i, s: v, d });
      }
      hits.sort((a, b) => b.s - a.s);
      return { hits: opts.limit ? hits.slice(0, opts.limit) : hits, terms: [...terms], fixes };
    }
  }

  // ---------- state ----------
  const app = document.getElementById("app"), rail = document.getElementById("rail"), q = document.getElementById("q"), drop = document.getElementById("drop");
  let D, C = {}, CE, IE, byTopic = {}, byReading = {}, topicName = {}, back = {};
  let lvFilter = "all";
  // Your own books (home server only): books/<L1-B2>.pdf linked by build.py --books-l1/--books-l2.
  let BOOKS = null;
  const bookUrl = (lv, b, p) => `books/${lv}-B${b}.pdf#page=${p}`;
  const openLink = (lv, b, p, label) => BOOKS && BOOKS.has(`${lv}-B${b}`) ? `<a class="chip open" href="${bookUrl(lv, b, p)}" target="_blank" rel="noopener">${label || "Open p." + p} ↗</a>` : "";
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem("cfakb:" + k)) ?? d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("cfakb:" + k, JSON.stringify(v)); } catch (e) { /* storage blocked: fine */ } },
  };

  function prepare(data) {
    D = data;
    D.topics.forEach((t) => { topicName[t.id] = t.name; byTopic[t.id] = []; });
    D.concepts.forEach((c) => {
      C[c.id] = c; byTopic[c.tp].push(c);
      c.r.forEach((r) => { const k = c.lv + ":" + r; (byReading[k] = byReading[k] || []).push(c); });
    });
    D.concepts.forEach((c) => new Set([...c.see, ...c.links]).forEach((x) => { if (C[x] && x !== c.id) (back[x] = back[x] || new Set()).add(c.id); }));
    try { lvFilter = JSON.parse(localStorage.getItem("cfakb:lv")) || "all"; } catch (e) { lvFilter = "all"; }
    const order = [...(D.topicOrder.L1 || []), ...(D.topicOrder.L2 || [])];
    D.topics.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    CE = new Engine(D.concepts.map((c) => {
      const rd = c.r.map((r) => (D.readings[c.lv + ":" + r] || {}).title || "").join(" ");
      const acr = [c.t, ...c.aka].flatMap(acronyms);
      return {
        c, tt: new Set(toks(c.t)), ph: [norm(c.t), norm(c.t.replace(/\(.*?\)/g, "")), ...c.aka.map(norm)].map((p) => toks(p, true).join(" ")),
        f: { t: toks(c.t), aka: c.aka.flatMap((a) => toks(a)), acr: acr.map(stem), ctx: toks(topicName[c.tp] + " " + rd), body: toks(c.txt) },
      };
    }), { t: 10, aka: 6, acr: 9, ctx: 1.2, body: 0.6 });
    IE = new Engine(D.index.map(([term, lv, hits]) => ({ term, lv, hits, ph: [toks(term, true).join(" ")], f: { t: toks(term), acr: acronyms(term).map(stem) } })), { t: 10, acr: 8 });
  }

  // ---------- rendering helpers ----------
  const tc = (tp) => `style="--tc:var(--t-${tp})"`;
  const lvOf = (tp) => (TOPICS.L2[tp] ? "L2" : "L1");
  const topicChip = (tp) => `<a class="chip topic" ${tc(tp)} href="#t-${tp}"><span class="dot"></span><b class="lvb">${lvOf(tp)}</b>${esc(TI(tp).short || topicName[tp])}</a>`;
  const rKey = (lv, n) => lv + ":" + n;
  const rLink = (lv, n, label) => `<a href="#r-${lv}-${n}">${label || "Reading " + n}</a>`;
  const pageRef = (b, p) => `Book ${b} · p.${p}`;
  function highlight(text, terms, max) {
    let s = text;
    if (max && s.length > max) {
      const low = s.toLowerCase();
      let at = -1;
      for (const t of terms) { const k = low.indexOf(t); if (k >= 0 && (at < 0 || k < at)) at = k; }
      const start = at > 60 ? s.lastIndexOf(" ", at - 50) + 1 : 0;
      s = (start > 0 ? "… " : "") + s.slice(start, start + max) + (start + max < s.length ? " …" : "");
    }
    let h = esc(s);
    const ts = terms.filter((t) => t.length >= 3).sort((a, b) => b.length - a.length).slice(0, 12);
    if (ts.length) h = h.replace(new RegExp("\\b(" + ts.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")[a-z]*", "gi"), "<mark>$&</mark>");
    return h;
  }
  function typeset(el) {
    if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([el]).catch(() => {});
    else setTimeout(() => window.MathJax && MathJax.typesetPromise && MathJax.typesetPromise([el]).catch(() => {}), 600);
  }

  function renderRail(active) {
    rail.innerHTML = ["L1", "L2"].map((lv, i) => `<div class="lv"${i ? ' style="margin-top:18px"' : ""}>${LV[lv]}</div>` +
      D.topics.filter((t) => t.level === lv).map((t) =>
        `<a href="#t-${t.id}" ${tc(t.id)} class="${active === t.id ? "on" : ""}"><span class="dot"></span>${esc(t.name)}<span class="n">${byTopic[t.id].length}</span></a>`).join("")).join("");
  }

  // ---------- views ----------
  function viewHome() {
    const recent = store.get("recent", []).filter((id) => C[id]).slice(0, 10);
    const tries = ["how sensitive is a bond to rates", "wacc", "ebitda multiple", "fifo lifo inflation", "insider info", "sharpe vs treynor", "h model", "callable bond volatility", "current rate method", "fundamental law", "unit root", "cds pricing"];
    renderRail();
    app.innerHTML = `<section class="hero"><h1>Look it up, understand it, get back to work.</h1>
      <p>${D.concepts.length} CFA Level I and II concepts explained in plain language, with formulas, examples and where to read more in your books. Search the way you'd ask a colleague: abbreviations, half-remembered terms and typos are fine.</p>
      <div class="big"><svg class="ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input id="bigq" type="search" placeholder="e.g. price sensitivity to yield, ROE breakdown, insider trading" autocomplete="off" aria-label="Search the knowledge base"></div>
      <div class="tries">Try: ${tries.map((t) => `<a href="#q-${slug(t)}">${esc(t)}</a>`).join(" · ")}</div></section>
      ${recent.length ? `<div class="sec"><h2>Recently viewed</h2><div class="recent">${recent.map((id) => `<a class="chip" href="#c-${id}">${esc(C[id].t)}</a>`).join("")}</div></div>` : ""}
      ${["L1", "L2"].map((lv) => `<div class="sec"><h2>${LV[lv]} topics</h2><div class="grid">${D.topics.filter((t) => t.level === lv).map((t) => {
        const cs = byTopic[t.id];
        return `<a class="tcard" ${tc(t.id)} href="#t-${t.id}"><h3>${esc(t.name)}</h3><div class="meta">${cs.length} concepts · exam weight ≈ ${TI(t.id).w || "?"}</div>
          <div class="ex">${cs.slice(0, 4).map((c) => esc(c.t.replace(/\s*\(.*?\)/, ""))).join(" · ")}</div></a>`;
      }).join("")}</div></div>`).join("")}`;
    const big = document.getElementById("bigq");
    big.addEventListener("input", () => { q.value = big.value; liveDrop(big.value, big); });
    big.addEventListener("keydown", (e) => dropKeys(e, big));
    setTimeout(() => big.focus({ preventScroll: true }), 0);
  }

  function viewTopic(tp) {
    const t = D.topics.find((x) => x.id === tp);
    if (!t) return viewHome();
    renderRail(tp);
    const rs = Object.values(D.readings).filter((r) => r.level === t.level && (byReading[rKey(t.level, r.n)] || []).some((c) => c.tp === tp));
    rs.sort((a, b) => a.n - b.n);
    const listed = new Set();
    const tw = topicName[twin(tp)] ? twin(tp) : null;
    let html = `<div class="crumbs"><a href="#home">Home</a> › ${LV[t.level]}</div><h1 style="font-size:30px">${esc(t.name)}</h1>
      <p class="mute">${byTopic[tp].length} concepts · approx. exam weight ${TI(tp).w || "?"}${tw ? ` · <a href="#t-${tw}">Same topic in ${LV[lvOf(tw)]} →</a>` : ""}</p>`;
    const block = (title, ref, cs) => `<div class="rd"><h3>${title}${ref}</h3><div class="list">${cs.map((c) =>
      `<a href="#c-${c.id}"><div class="lt">${esc(c.t)}</div><div class="ls">${esc(c.sum.length > 170 ? c.sum.slice(0, 168) + "…" : c.sum)}</div></a>`).join("")}</div></div>`;
    if (rs.length) {
      for (const r of rs) {
        const cs = byReading[rKey(t.level, r.n)].filter((c) => c.tp === tp && !listed.has(c.id));
        cs.forEach((c) => listed.add(c.id));
        if (cs.length) html += block(`<a href="#r-${t.level}-${r.n}">Reading ${r.n}: ${esc(r.title)}</a>`, ` <span class="ref">${pageRef(r.book, r.page)}</span>`, cs);
      }
      const rest = byTopic[tp].filter((c) => !listed.has(c.id));
      if (rest.length) html += block("Other concepts", "", rest);
    } else {
      const groups = {};
      byTopic[tp].forEach((c) => { const k = c.r[0] || "-"; (groups[k] = groups[k] || []).push(c); });
      for (const [r, cs] of Object.entries(groups).sort((a, b) => a[0] - b[0])) html += block(r === "-" ? "Other" : "Reading " + r, "", cs);
    }
    app.innerHTML = html;
  }

  function viewReading(lv, n) {
    const r = D.readings[rKey(lv, n)], cs = byReading[rKey(lv, n)] || [];
    const tp = cs[0]?.tp;
    renderRail(tp);
    const idx = D.index.filter(([, l, hits]) => l === lv && hits.some((h) => String(h[0]) === String(n))).map(([term]) => term);
    app.innerHTML = `<div class="crumbs"><a href="#home">Home</a> › ${LV[lv]} › ${tp ? `<a href="#t-${tp}">${esc(topicName[tp])}</a> ›` : ""} Reading ${n}</div>
      <h1 style="font-size:28px">${r ? esc(r.title) : "Reading " + n}</h1>
      ${r ? `<p class="ref" style="margin-top:8px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">Reading ${n} · ${pageRef(r.book, r.page)} ${openLink(lv, r.book, r.page, "Open in book")}</p>` : ""}
      <div class="sec"><h2>Concepts explained here</h2><div class="list">${cs.map((c) => `<a href="#c-${c.id}"><div class="lt">${esc(c.t)}</div><div class="ls">${esc(c.sum.slice(0, 170))}${c.sum.length > 170 ? "…" : ""}</div></a>`).join("") || '<div class="mute">None yet.</div>'}</div></div>
      ${r && r.los.length ? `<div class="sec"><h2>Learning outcomes</h2><ol class="los" type="a">${r.los.map((l) => `<li>${esc(l)}</li>`).join("")}</ol></div>` : ""}
      ${r && r.modules.length ? `<div class="sec"><h2>Modules in your book</h2><div class="list mods">${r.modules.map(([id, t, p]) => `<div><b>${esc(id)}</b> ${esc(t)} <span class="ref">· p.${p}</span> ${openLink(lv, r.book, p)}</div>`).join("")}</div></div>` : ""}
      ${idx.length ? `<div class="sec"><h2>Terms from the book index</h2><div class="chips">${idx.map((t) => `<a class="chip" href="#q-${slug(t)}">${esc(t)}</a>`).join("")}</div></div>` : ""}`;
  }

  function viewConcept(id) {
    const c = C[id];
    if (!c) { app.innerHTML = `<div class="empty">No concept called “${esc(id)}”. <a href="#q-${slug(id.replace(/-/g, " "))}">Search for it</a>.</div>`; return; }
    renderRail(c.tp);
    const recent = store.get("recent", []).filter((x) => x !== id); recent.unshift(id); store.set("recent", recent.slice(0, 20));
    const aka = c.aka.filter((a) => !norm(c.t).includes(norm(a)));
    const linked = [...new Set([...c.see, ...c.links, ...(back[id] || [])])].filter((x) => x !== id && C[x]);
    const related = linked.filter((x) => C[x].lv === c.lv);
    const cross = linked.filter((x) => C[x].lv !== c.lv);
    const siblings = c.r.flatMap((r) => byReading[rKey(c.lv, r)] || []).filter((x) => x.id !== id && !related.includes(x.id));
    const list = byTopic[c.tp], k = list.indexOf(c), prev = list[k - 1], next = list[k + 1];
    const reads = c.r.map((n) => {
      const r = D.readings[rKey(c.lv, n)];
      return `<div class="row">${rLink(c.lv, n, `Reading ${n}${r ? ": " + esc(r.title) : ""}`)}${r ? `<span class="ref">${pageRef(r.book, r.page)}</span>${openLink(c.lv, r.book, r.page, "Open in book")}` : ""}</div>`;
    }).join("");
    const pages = c.pg.length ? `<div class="row"><span class="mute">Indexed on</span> ${c.pg.map(([r, b, p]) => BOOKS && BOOKS.has(`${c.lv}-B${b}`) ? `<a class="chip open" href="${bookUrl(c.lv, b, p)}" target="_blank" rel="noopener" title="Reading ${r}">${pageRef(b, p)} ↗</a>` : `<a class="chip" href="#r-${c.lv}-${r}" title="Reading ${r}">${pageRef(b, p)}</a>`).join("")}</div>` : "";
    app.innerHTML = `<article class="concept">
      <div class="crumbs"><a href="#home">Home</a> › ${LV[c.lv]} › ${topicChip(c.tp)} ${c.r.length ? "› " + c.r.map((n) => rLink(c.lv, n)).join(", ") : ""}</div>
      <h1>${esc(c.t)}</h1>
      ${aka.length ? `<div class="aka"><b>Also searched as</b>${aka.map(esc).join(" · ")}</div>` : ""}
      <div class="body">${c.html}</div>
      <div class="sec"><h2>Where in your books</h2><div class="where">${reads}${pages}</div></div>
      ${cross.length ? `<div class="sec cross"><h2>${c.lv === "L1" ? "Goes deeper in Level II" : "Level I foundation"}</h2><div class="list">${cross.map((x) =>
        `<a href="#c-${x}"><div class="lt">${esc(C[x].t)}</div><div class="ls">${esc(C[x].sum.length > 150 ? C[x].sum.slice(0, 148) + "…" : C[x].sum)}</div><div class="lm">${topicChip(C[x].tp).replace("<a ", "<span ").replace("</a>", "</span>")}</div></a>`).join("")}</div></div>` : ""}
      ${related.length ? `<div class="sec"><h2>Related concepts</h2><div class="chips">${related.map((x) => `<a class="chip" href="#c-${x}">${esc(C[x].t)}</a>`).join("")}</div></div>` : ""}
      ${siblings.length ? `<div class="sec"><h2>Same reading</h2><div class="chips">${siblings.map((x) => `<a class="chip" href="#c-${x.id}">${esc(x.t)}</a>`).join("")}</div></div>` : ""}
      <nav class="pager">${prev ? `<a href="#c-${prev.id}">← ${esc(prev.t)}</a>` : "<span></span>"}${next ? `<a class="r" href="#c-${next.id}">${esc(next.t)} →</a>` : ""}</nav>
    </article>`;
    typeset(app);
  }

  function viewSearch(query) {
    renderRail();
    q.value = query;
    const res = CE.search(query), ix = IE.search(query, { limit: 30 });
    const n = { all: res.hits.length, L1: res.hits.filter((h) => h.d.c.lv === "L1").length, L2: res.hits.filter((h) => h.d.c.lv === "L2").length };
    if (lvFilter !== "all") { res.hits = res.hits.filter((h) => h.d.c.lv === lvFilter); ix.hits = ix.hits.filter((h) => h.d.lv === lvFilter); }
    const top = res.hits.slice(0, 40), terms = res.terms;
    const seg = `<div class="seg" role="group" aria-label="Level">${[["all", "All levels"], ["L1", "Level I"], ["L2", "Level II"]].map(([k, l]) =>
      `<button data-lv="${k}" class="${lvFilter === k ? "on" : ""}" aria-pressed="${lvFilter === k}">${l} <span>${n[k]}</span></button>`).join("")}</div>`;
    const fix = res.fixes.length && (!top.length || top[0].s < 8) ? `<div class="hint">Searched with the closest terms: <b>${esc(res.fixes.join(", "))}</b>.</div>` : "";
    app.innerHTML = `<div class="crumbs"><a href="#home">Home</a> › Search</div><h1 style="font-size:26px">“${esc(query)}”</h1>${seg}
      <p class="sq">${top.length ? `${res.hits.length} concept${res.hits.length === 1 ? "" : "s"} matched${res.hits.length > 40 ? ", top 40 shown" : ""}` : "No concepts matched."}</p>${fix}
      ${top.length ? `<div class="list">${top.map(({ d }) => {
        const c = d.c, inTitle = toks(c.t).some((t) => terms.includes(t));
        const why = !inTitle ? c.aka.find((a) => toks(a).some((t) => terms.includes(t))) : null;
        return `<a href="#c-${c.id}"><div class="lt">${highlight(c.t, terms)}</div>
          <div class="ls">${highlight(inTitle || why ? c.sum : c.txt, terms, 200)}</div>
          <div class="lm">${topicChip(c.tp).replace("<a ", "<span ").replace("</a>", "</span>")}${why ? `<span class="ref">matched “${esc(why)}”</span>` : ""}${c.r.length ? `<span class="ref">R${c.r.join(", R")}</span>` : ""}</div></a>`;
      }).join("")}</div>` : `<div class="empty">Try fewer words, an abbreviation (WACC, YTM, EPS) or a related idea.</div>`}
      ${ix.hits.length ? `<div class="sec"><h2>In the book indexes</h2><div class="list">${ix.hits.filter((h) => h.s > 3).slice(0, 10).map(({ d }) =>
        `<div><span class="lt">${highlight(d.term, ix.terms)}</span> <span class="ref">${d.lv}</span> <span class="mute">—</span> ${d.hits.slice(0, 6).map(([r, b, p]) => `<a class="chip" href="#r-${d.lv}-${r}">R${r} · ${pageRef(b, p)}</a>`).join(" ")}</div>`).join("")}</div></div>` : ""}`;
    app.querySelectorAll(".seg button").forEach((b) => b.addEventListener("click", () => {
      lvFilter = b.dataset.lv;
      try { localStorage.setItem("cfakb:lv", JSON.stringify(lvFilter)); } catch (e) { /* fine */ }
      viewSearch(query);
    }));
  }

  // ---------- live dropdown ----------
  let dropSel = -1, dropFor = null;
  function liveDrop(text, input) {
    dropFor = input;
    if (!text.trim()) { drop.hidden = true; return; }
    const hits = CE.search(text, { limit: 8 }).hits, terms = CE.search(text).terms;
    dropSel = -1;
    drop.innerHTML = hits.map(({ d }) => `<a href="#c-${d.c.id}"><span class="dt">${highlight(d.c.t, terms)}</span><span class="ds">${d.c.lv} · ${esc(TI(d.c.tp).short || "")} · ${esc(d.c.sum)}</span></a>`).join("") +
      `<a href="#q-${slug(text)}" class="all">See all results for “${esc(text)}” ↵</a>`;
    const box = input.getBoundingClientRect(), top = q.closest(".sbox").getBoundingClientRect();
    drop.style.cssText = input === q ? "" : `left:${box.left - top.left}px;right:auto;width:${box.width}px;top:${box.bottom - top.top + 6}px`;
    drop.hidden = false;
  }
  function dropKeys(e, input) {
    const items = [...drop.querySelectorAll("a")];
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (drop.hidden || !items.length) return;
      e.preventDefault();
      dropSel = (dropSel + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items.forEach((a, i) => a.classList.toggle("on", i === dropSel));
      items[dropSel].scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = dropSel >= 0 && items[dropSel] ? items[dropSel].getAttribute("href") : (input.value.trim() ? "#q-" + slug(input.value) : null);
      if (target) { drop.hidden = true; input.blur(); go(target); }
    } else if (e.key === "Escape") { drop.hidden = true; input.blur(); }
  }
  const slug = (s) => norm(s).replace(/ /g, "-").slice(0, 120);
  function go(h) { if (location.hash === h) route(); else location.hash = h; }

  // ---------- router ----------
  function route() {
    drop.hidden = true; rail.classList.remove("open");
    const h = decodeURIComponent(location.hash.slice(1));
    let m;
    if ((m = h.match(/^c-(.+)$/))) viewConcept(m[1]);
    else if ((m = h.match(/^t-(.+)$/))) viewTopic(m[1]);
    else if ((m = h.match(/^r-(L\d)-(\d+)$/))) viewReading(m[1], m[2]);
    else if ((m = h.match(/^q-(.+)$/))) viewSearch(m[1].replace(/-/g, " "));
    else viewHome();
    if (!/^q-/.test(h)) q.value = "";
    window.scrollTo(0, 0);
  }

  q.addEventListener("input", () => liveDrop(q.value, q));
  q.addEventListener("focus", () => q.value && liveDrop(q.value, q));
  q.addEventListener("keydown", (e) => dropKeys(e, q));
  document.addEventListener("click", (e) => { if (!e.target.closest(".sbox") && !e.target.closest(".big")) drop.hidden = true; });
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); (document.getElementById("bigq") || q).focus(); }
  });
  document.getElementById("menu").addEventListener("click", () => rail.classList.toggle("open"));
  window.addEventListener("hashchange", route);

  app.innerHTML = '<div class="empty">Loading the knowledge base…</div>';
  fetch("data.json").then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((data) => {
      prepare(data); route();
      fetch("books/available.json").then((r) => (r.ok ? r.json() : null)).then((b) => { if (b) { BOOKS = new Set(b); route(); } }).catch(() => { /* no books here: fine */ });
    })
    .catch((e) => { app.innerHTML = `<div class="empty">Could not load data.json (${esc(e.message)}). Run <code>python3 build.py</code> and serve the output folder.</div>`; });
})();
