/* CFA study tracker (Levels I and II). CURRICULUM = {levels, concepts} comes from curriculum.js
   (built by extract.py + build.py). Progress lives in this browser's localStorage; Export/Import moves it. */
(function () {
  "use strict";
  const KEY = "cfa-l1-progress-v1";
  /* Approximate exam weights (midpoints of the published ranges); edit if the curriculum differs. */
  const WEIGHT = {
    1: { "Quantitative Methods": 7.5, "Economics": 7.5, "Corporate Finance": 7.5, "Financial Statement Analysis": 12.5, "Equities": 12.5,
      "Fixed Income": 12.5, "Derivatives": 6.5, "Alternative Investments": 8.5, "Portfolio Construction": 10, "Ethical and Professional Standards": 15 },
    2: { "Quantitative Methods": 7.5, "Economics": 7.5, "Financial Statement Analysis": 12.5, "Corporate Issuers": 12.5, "Equity Valuation": 12.5,
      "Fixed Income": 12.5, "Derivatives": 7.5, "Alternative Investments": 7.5, "Portfolio Management": 12.5, "Ethical and Professional Standards": 12.5 },
  };
  const STATE = ["Not started", "Reading", "Done"];
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const rx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  let P = { r: {}, l: {}, exam: "", level: 1 };
  try { P = Object.assign(P, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { /* private mode: start empty */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) { /* ignore */ } };

  const LEVELS = CURRICULUM.levels, CONCEPTS = CURRICULUM.concepts;
  const levelOf = (id) => LEVELS.find((l) => l.id === id) || LEVELS[0];
  const readings = LEVELS.flatMap((lv) => lv.topics.flatMap((t) => t.readings.map((r) => Object.assign({ topic: t, level: lv.id }, r))));
  const byId = Object.fromEntries(readings.map((r) => [r.id, r]));
  const roman = (n) => (n === 1 ? "I" : n === 2 ? "II" : "III");
  const losKey = (r, i) => r.id + "." + i;
  const rState = (r) => P.r[r.id] || 0;
  const lState = (r, i) => P.l[losKey(r, i)] || 0;
  const cur = () => levelOf(P.level);

  /* concept lookups */
  const conceptsByReading = {};
  CONCEPTS.forEach((c) => c.hits.forEach((h) => { (conceptsByReading[h.r] = conceptsByReading[h.r] || new Set()).add(c.id); }));
  const clean = (t) => t.replace(/\s*\(.*?\)/g, "").toLowerCase().trim();

  function topicStats(t) {
    let done = 0, los = 0, losTotal = 0;
    t.readings.forEach((r) => {
      const rr = byId[r.id];
      if (rState(rr) === 2) done++;
      rr.los.forEach((_, i) => { losTotal++; if (lState(rr, i) === 2) los++; });
    });
    const items = t.readings.length + losTotal;
    return { done, total: t.readings.length, los, losTotal, pct: items ? Math.round(100 * (done + los) / items) : 0 };
  }
  const bar = (p) => `<div class="bar"><i style="width:${p}%"></i></div>`;
  const cLink = (id, extra = "") => `<a class="cchip ${extra}" href="#/c/${id}" title="Level ${roman(CONCEPTS[id].level)}">${esc(CONCEPTS[id].term)}</a>`;
  const rLink = (r) => `<a href="#/r/${r.id}">Reading ${r.n} · ${esc(r.title)}</a>`;

  /* ---------- views ---------- */
  function home() {
    const lv = cur(), W = WEIGHT[lv.id] || {};
    const rs = readings.filter((r) => r.level === lv.id);
    const stats = lv.topics.map((t) => Object.assign({ t }, topicStats(t)));
    const wsum = stats.reduce((s, x) => s + (W[x.t.name] || 5), 0);
    const overall = Math.round(stats.reduce((s, x) => s + x.pct * (W[x.t.name] || 5), 0) / wsum);
    const doneR = rs.filter((r) => rState(r) === 2).length;
    const next = rs.find((r) => rState(r) !== 2);
    let plan = '<span class="mute">Pick your exam date to get a weekly target.</span>';
    if (P.exam) {
      const days = Math.ceil((new Date(P.exam + "T00:00:00") - new Date()) / 86400000), left = rs.length - doneR;
      plan = days > 0 ? `<b>${days}</b> days left · <b>${left}</b> readings to go → about <b>${(left / Math.max(days / 7, 1)).toFixed(1)}</b> readings per week` : "Exam date has passed.";
    }
    return `<h1>CFA Level ${roman(lv.id)} study tracker</h1>
<p class="mute">${rs.length} readings in ${lv.topics.length} topics · ${CONCEPTS.filter((c) => c.level === lv.id).length} indexed concepts. Progress is saved in this browser.</p>
<div class="card stats">
 <div class="stat"><div class="ring" style="--p:${overall}"><span>${overall}%</span></div><span class="mute">weighted progress</span></div>
 <div class="stat"><b>${doneR}/${rs.length}</b><span class="mute">readings done</span></div>
 <div class="stat"><b>${stats.reduce((s, x) => s + x.los, 0)}/${stats.reduce((s, x) => s + x.losTotal, 0)}</b><span class="mute">outcomes confident</span></div>
</div>
<div class="tools"><a class="btn" href="#/concepts">📖 Browse concepts A–Z</a></div>
<h2>Plan</h2><div class="card plan"><label>Exam date <input type="date" id="exam" value="${esc(P.exam)}"></label><span>${plan}</span></div>
${next ? `<p>Up next: ${rLink(next)} <span class="mute">(Book ${next.book}, PDF p.${next.page})</span></p>` : "<p>All readings done. Time for mock exams! 🎉</p>"}
<h2>Topics <span class="mute" style="text-transform:none;letter-spacing:0">(exam weight is approximate)</span></h2>
<div class="grid">${stats.map((x) => `<a class="card" href="#/t/${x.t.id}"><h3>${esc(x.t.name)}</h3>
 <div class="mute">~${W[x.t.name] || "?"}% of the exam · ${x.total} readings</div>${bar(x.pct)}
 <div class="mute">${x.done}/${x.total} readings · ${x.los}/${x.losTotal} outcomes · ${x.pct}%</div></a>`).join("")}</div>
<div class="tools"><button id="exp">Export progress</button><button id="imp">Import progress</button><button id="reset">Reset</button></div>`;
  }

  function readingBlock(r, open) {
    const s = rState(r);
    const cs = [...(conceptsByReading[r.id] || [])].sort((a, b) => CONCEPTS[a].term.localeCompare(CONCEPTS[b].term));
    return `<details class="reading" data-n="${r.id}"${open ? " open" : ""}><summary><span class="rn">${r.n}</span><span class="rt">${esc(r.title)}</span>
 <span class="pill s${s}">${STATE[s]}</span></summary><div class="body">
 <p class="mute">Book ${r.book} · starts at PDF page ${r.page}${r.keyPage ? ` · Key Concepts p.${r.keyPage}` : ""}</p>
 ${r.modules.length ? `<ul class="mods">${r.modules.map((m) => `<li>Module ${m.id}: ${esc(m.title)} <span class="mute">(p.${m.page})</span></li>`).join("")}</ul>` : ""}
 <button class="rs" data-n="${r.id}">Mark: ${STATE[(s + 1) % 3]}</button>
 <h2 style="margin-top:14px">Learning outcomes</h2>
 ${r.los.map((l, i) => { const v = lState(r, i); return `<div class="row"><button class="tri s${v}" data-k="${losKey(r, i)}" title="Tap to cycle: not rated → shaky → confident">${["○", "~", "✓"][v]}</button><div>${esc(l)}</div></div>`; }).join("")}
 ${cs.length ? `<h2>Concepts in this reading (${cs.length})</h2><div class="chips">${cs.map((id) => cLink(id)).join("")}</div>` : ""}
 </div></details>`;
  }

  function topic(id) {
    const lv = LEVELS.find((l) => l.topics.some((t) => t.id === id));
    const t = lv && lv.topics.find((x) => x.id === id);
    if (!t) return "<p>Topic not found.</p>";
    const st = topicStats(t);
    return `<p class="crumb"><a href="#/">← All topics</a></p><h1>${esc(t.name)} <span class="mute">Level ${roman(lv.id)}</span></h1>
<p class="mute">${st.done}/${st.total} readings · ${st.los}/${st.losTotal} outcomes confident</p>${bar(st.pct)}${t.readings.map((r) => readingBlock(byId[r.id], false)).join("")}`;
  }

  function reading(id) {
    const r = byId[id];
    if (!r) return "<p>Reading not found.</p>";
    return `<p class="crumb"><a href="#/t/${r.topic.id}">← ${esc(r.topic.name)} (Level ${roman(r.level)})</a></p>${readingBlock(r, true)}`;
  }

  /* radial map of a concept and its neighbours; every label is a link */
  function graph(c) {
    const nb = c.rel.slice(0, 10), W = 640, H = 420, cx = W / 2, cy = H / 2, R = 160;
    const short = (s) => (s.length > 26 ? s.slice(0, 25) + "…" : s);
    const nodes = nb.map((id, i) => {
      const a = (2 * Math.PI * i) / nb.length - Math.PI / 2, x = cx + R * 1.25 * Math.cos(a), y = cy + R * Math.sin(a);
      return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/><a href="#/c/${id}"><circle cx="${x}" cy="${y}" r="5"/>
<text x="${x}" y="${y + (y < cy ? -11 : 19)}" text-anchor="middle">${esc(short(CONCEPTS[id].term))}</text></a>`;
    });
    return `<svg class="graph" viewBox="0 0 ${W} ${H}" role="img" aria-label="Related concepts">${nodes.join("")}
<circle class="hub" cx="${cx}" cy="${cy}" r="9"/><text class="hubt" x="${cx}" y="${cy - 16}" text-anchor="middle">${esc(short(c.term))}</text></svg>`;
  }

  function concept(id) {
    const c = CONCEPTS[+id];
    if (!c) return "<p>Concept not found.</p>";
    const where = c.hits.map((h) => {
      const r = byId[h.r];
      const m = h.m && r.modules.find((x) => x.id === h.m);
      return `<li>${rLink(r)}${m ? ` <span class="mute">› Module ${m.id}: ${esc(m.title)}</span>` : ""} <span class="pill">Book ${h.b} · PDF p.${h.p}</span></li>`;
    }).join("");
    const w = clean(c.term);
    const los = w.length > 3 ? readings.filter((r) => r.level === c.level).flatMap((r) => r.los.map((l, i) => ({ r, l, i }))).filter((x) => x.l.toLowerCase().includes(w)).slice(0, 6) : [];
    return `<p class="crumb"><a href="#/concepts">← All concepts</a></p><h1>${esc(c.term)} <span class="pill">Level ${roman(c.level)}</span></h1>
${(c.also || []).length ? `<p class="mute">Also covered in: ${c.also.map((j) => cLink(j)).join(" ")}</p>` : ""}
<h2>Where to read</h2><ul class="where">${where}</ul>
${los.length ? `<h2>Learning outcomes that mention it</h2>${los.map((x) => `<div class="row"><div>${esc(x.l)}<div class="mute">${rLink(x.r)}</div></div></div>`).join("")}` : ""}
<h2>Related concepts</h2>${c.rel.length ? `<div class="card">${graph(c)}</div><div class="chips">${c.rel.map((j) => cLink(j)).join("")}</div>` : '<p class="mute">No related concepts found.</p>'}`;
  }

  function concepts(letter) {
    const lv = cur();
    const list = CONCEPTS.filter((c) => c.level === lv.id).sort((a, b) => a.term.localeCompare(b.term));
    const letters = [...new Set(list.map((c) => c.term[0].toUpperCase()))];
    const L = letter || letters[0];
    return `<p class="crumb"><a href="#/">← Home</a></p><h1>Concepts · Level ${roman(lv.id)}</h1>
<div class="chips">${letters.map((x) => `<a class="cchip${x === L ? " on" : ""}" href="#/concepts/${x}">${x}</a>`).join("")}</div>
<div class="chips">${list.filter((c) => c.term[0].toUpperCase() === L).map((c) => cLink(c.id)).join("")}</div>`;
  }

  function search(q) {
    const w = q.toLowerCase();
    const hl = (s) => esc(s).replace(new RegExp(rx(esc(q)), "gi"), (m) => `<mark>${m}</mark>`);
    const cs = CONCEPTS.filter((c) => c.term.toLowerCase().includes(w))
      .sort((a, b) => (a.level === P.level ? 0 : 1) - (b.level === P.level ? 0 : 1) || a.term.length - b.term.length).slice(0, 40);
    const hits = [];
    readings.forEach((r) => {
      const tag = `L${roman(r.level)}`;
      if ((r.n + " " + r.title).toLowerCase().includes(w)) hits.push(`<div class="hit"><a href="#/r/${r.id}">Reading ${r.n} · ${hl(r.title)}</a><div class="mute">${tag} · ${esc(r.topic.name)}</div></div>`);
      r.modules.forEach((m) => { if (m.title.toLowerCase().includes(w)) hits.push(`<div class="hit"><a href="#/r/${r.id}">Module ${m.id}: ${hl(m.title)}</a><div class="mute">${tag} · Reading ${r.n} · p.${m.page}</div></div>`); });
      r.los.forEach((l) => { if (l.toLowerCase().includes(w)) hits.push(`<div class="hit"><a href="#/r/${r.id}">${hl(l)}</a><div class="mute">${tag} · Reading ${r.n} · ${esc(r.title)}</div></div>`); });
    });
    return `<h1>Search “${esc(q)}”</h1>
${cs.length ? `<h2>Concepts (${cs.length})</h2><div class="chips">${cs.map((c) => cLink(c.id)).join("")}</div>` : ""}
<h2>Readings, modules and outcomes (${hits.length})</h2>${hits.slice(0, 80).join("") || '<p class="mute">No matches.</p>'}`;
  }

  /* ---------- wiring ---------- */
  function render() {
    const q = $("#q").value.trim();
    const [, kind, arg] = location.hash.split("/");
    $("#app").innerHTML = q.length > 1 ? search(q)
      : kind === "t" ? topic(arg) : kind === "r" ? reading(arg) : kind === "c" ? concept(arg) : kind === "concepts" ? concepts(arg) : home();
    document.querySelectorAll("#levels button").forEach((b) => b.classList.toggle("on", +b.dataset.l === P.level));
  }
  $("#levels").innerHTML = LEVELS.map((l) => `<button data-l="${l.id}">${l.name}</button>`).join("");
  window.addEventListener("hashchange", () => { $("#q").value = ""; render(); window.scrollTo(0, 0); });
  $("#q").addEventListener("input", render);

  document.addEventListener("click", (e) => {
    const rs = e.target.closest(".rs"), tri = e.target.closest(".tri"), lvb = e.target.closest("#levels button");
    if (lvb) {
      P.level = +lvb.dataset.l; save(); location.hash = "#/"; render();
    } else if (rs || tri) {
      const open = [...document.querySelectorAll("details[open]")].map((d) => d.dataset.n);
      if (rs) P.r[rs.dataset.n] = ((P.r[rs.dataset.n] || 0) + 1) % 3;
      else P.l[tri.dataset.k] = ((P.l[tri.dataset.k] || 0) + 1) % 3;
      save(); render();
      open.forEach((n) => { const d = document.querySelector(`details[data-n="${n}"]`); if (d) d.open = true; });
    } else if (e.target.id === "exp") {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(P)], { type: "application/json" }));
      a.download = "cfa-progress.json"; a.click();
    } else if (e.target.id === "imp") {
      const i = document.createElement("input"); i.type = "file"; i.accept = "application/json";
      i.onchange = () => i.files[0].text().then((t) => { try { P = Object.assign({ r: {}, l: {}, exam: "", level: 1 }, JSON.parse(t)); save(); render(); } catch (x) { alert("Not a valid progress file."); } });
      i.click();
    } else if (e.target.id === "reset" && confirm("Erase all progress in this browser?")) {
      P = { r: {}, l: {}, exam: P.exam, level: P.level }; save(); render();
    }
  });
  document.addEventListener("change", (e) => { if (e.target.id === "exam") { P.exam = e.target.value; save(); render(); } });
  render();
})();
