/* CFA Level I tracker. CURRICULUM comes from curriculum.js (built by extract.py + build.py).
   Progress lives in this browser's localStorage; use Export/Import to move it between devices. */
(function () {
  "use strict";
  const KEY = "cfa-l1-progress-v1";
  /* Approximate exam weights (midpoint of the published Level I ranges); edit if the 2027 curriculum differs. */
  const WEIGHT = { "quantitative-methods": 7.5, "economics": 7.5, "corporate-finance": 7.5, "financial-statement-analysis": 12.5,
    "equities": 12.5, "fixed-income": 12.5, "derivatives": 6.5, "alternative-investments": 8.5, "portfolio-construction": 10,
    "ethical-and-professional-standards": 15 };
  const BOOK_PDF = (b) => `Book ${b}`;
  const STATE = ["Not started", "Reading", "Done"], LOS_STATE = ["", "Shaky", "Confident"];
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  let P = { r: {}, l: {}, exam: "" };
  try { P = Object.assign(P, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { /* private mode: start empty */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) { /* ignore */ } };

  const readings = CURRICULUM.flatMap((t) => t.readings.map((r) => Object.assign({ topic: t }, r)));
  const losKey = (r, i) => r.n + "." + i;
  const rState = (r) => P.r[r.n] || 0;
  const lState = (r, i) => P.l[losKey(r, i)] || 0;

  function topicStats(t) {
    let done = 0, total = 0, los = 0, losTotal = 0;
    t.readings.forEach((r) => {
      total++; if (rState(r) === 2) done++;
      r.los.forEach((_, i) => { losTotal++; if (lState(r, i) === 2) los++; });
    });
    const items = total + losTotal;
    return { done, total, los, losTotal, pct: items ? Math.round(100 * (done + los) / items) : 0 };
  }
  const bar = (p) => `<div class="bar"><i style="width:${p}%"></i></div>`;

  /* ---------- views ---------- */
  function home() {
    const stats = CURRICULUM.map((t) => Object.assign({ t }, topicStats(t)));
    const wsum = stats.reduce((s, x) => s + (WEIGHT[x.t.id] || 5), 0);
    const overall = Math.round(stats.reduce((s, x) => s + x.pct * (WEIGHT[x.t.id] || 5), 0) / wsum);
    const doneR = readings.filter((r) => rState(r) === 2).length;
    const next = readings.find((r) => rState(r) !== 2);
    let plan = '<span class="mute">Pick your exam date to get a weekly target.</span>';
    if (P.exam) {
      const days = Math.ceil((new Date(P.exam + "T00:00:00") - new Date()) / 86400000);
      const left = readings.length - doneR;
      plan = days > 0
        ? `<b>${days}</b> days left · <b>${left}</b> readings to go → about <b>${(left / Math.max(days / 7, 1)).toFixed(1)}</b> readings per week`
        : "Exam date has passed.";
    }
    return `<h1>CFA Level I study tracker</h1><p class="mute">${readings.length} readings in 10 topics, from your Schweser notes. Progress is saved in this browser.</p>
<div class="card stats">
 <div class="stat"><div class="ring" style="--p:${overall}"><span>${overall}%</span></div><span class="mute">weighted progress</span></div>
 <div class="stat"><b>${doneR}/${readings.length}</b><span class="mute">readings done</span></div>
 <div class="stat"><b>${stats.reduce((s, x) => s + x.los, 0)}/${stats.reduce((s, x) => s + x.losTotal, 0)}</b><span class="mute">outcomes confident</span></div>
</div>
<h2>Plan</h2><div class="card plan"><label>Exam date <input type="date" id="exam" value="${esc(P.exam)}"></label><span>${plan}</span></div>
${next ? `<p>Up next: <a href="#/r/${next.n}">Reading ${next.n} · ${esc(next.title)}</a> <span class="mute">(${BOOK_PDF(next.book)}, PDF p.${next.page})</span></p>` : "<p>All readings done. Time for mock exams! 🎉</p>"}
<h2>Topics <span class="mute" style="text-transform:none;letter-spacing:0">(exam weight is approximate)</span></h2>
<div class="grid">${stats.map((x) => `<a class="card" href="#/t/${x.t.id}"><h3>${esc(x.t.name)}</h3>
 <div class="mute">~${WEIGHT[x.t.id] || "?"}% of the exam · ${x.total} readings</div>${bar(x.pct)}
 <div class="mute">${x.done}/${x.total} readings · ${x.los}/${x.losTotal} outcomes · ${x.pct}%</div></a>`).join("")}</div>
<div class="tools"><button id="exp">Export progress</button><button id="imp">Import progress</button><button id="reset">Reset</button></div>`;
  }

  function readingBlock(r, open) {
    const s = rState(r);
    return `<details class="reading" data-n="${r.n}"${open ? " open" : ""}><summary><span class="rn">${r.n}</span><span class="rt">${esc(r.title)}</span>
 <span class="pill s${s}">${STATE[s]}</span></summary><div class="body">
 <p class="mute">${BOOK_PDF(r.book)} · starts at PDF page ${r.page}${r.keyPage ? ` · Key Concepts p.${r.keyPage}` : ""}</p>
 ${r.modules.length ? `<ul class="mods">${r.modules.map((m) => `<li>Module ${m.id}: ${esc(m.title)} <span class="mute">(p.${m.page})</span></li>`).join("")}</ul>` : ""}
 <button class="rs" data-n="${r.n}">Mark: ${STATE[(s + 1) % 3]}</button>
 <h2 style="margin-top:14px">Learning outcomes</h2>
 ${r.los.map((l, i) => { const v = lState(r, i); return `<div class="row"><button class="tri s${v}" data-k="${losKey(r, i)}" title="Tap to cycle: not rated → shaky → confident">${["○", "~", "✓"][v]}</button><div>${esc(l)}</div></div>`; }).join("")}
 </div></details>`;
  }

  function topic(id) {
    const t = CURRICULUM.find((x) => x.id === id);
    if (!t) return "<p>Topic not found.</p>";
    const st = topicStats(t);
    return `<p class="crumb"><a href="#/">← All topics</a></p><h1>${esc(t.name)}</h1>
<p class="mute">${st.done}/${st.total} readings · ${st.los}/${st.losTotal} outcomes confident</p>${bar(st.pct)}${t.readings.map((r) => readingBlock(r, false)).join("")}`;
  }

  function reading(n) {
    const r = readings.find((x) => x.n === +n);
    if (!r) return "<p>Reading not found.</p>";
    return `<p class="crumb"><a href="#/t/${r.topic.id}">← ${esc(r.topic.name)}</a></p>${readingBlock(r, true)}`;
  }

  function search(q) {
    const w = q.toLowerCase();
    const hl = (s) => esc(s).replace(new RegExp(esc(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), (m) => `<mark>${m}</mark>`);
    const hits = [];
    readings.forEach((r) => {
      if ((r.n + " " + r.title).toLowerCase().includes(w)) hits.push(`<div class="hit"><a href="#/r/${r.n}">Reading ${r.n} · ${hl(r.title)}</a><div class="mute">${esc(r.topic.name)}</div></div>`);
      r.modules.forEach((m) => { if (m.title.toLowerCase().includes(w)) hits.push(`<div class="hit"><a href="#/r/${r.n}">Module ${m.id}: ${hl(m.title)}</a><div class="mute">Reading ${r.n} · p.${m.page}</div></div>`); });
      r.los.forEach((l) => { if (l.toLowerCase().includes(w)) hits.push(`<div class="hit"><a href="#/r/${r.n}">${hl(l)}</a><div class="mute">Reading ${r.n} · ${esc(r.title)}</div></div>`); });
    });
    return `<h1>Search</h1><p class="mute">${hits.length} match${hits.length === 1 ? "" : "es"} for “${esc(q)}”</p>${hits.slice(0, 80).join("")}`;
  }

  /* ---------- wiring ---------- */
  function render() {
    const q = $("#q").value.trim();
    const [, kind, arg] = location.hash.split("/");
    $("#app").innerHTML = q.length > 1 ? search(q) : kind === "t" ? topic(arg) : kind === "r" ? reading(arg) : home();
  }
  window.addEventListener("hashchange", () => { $("#q").value = ""; render(); window.scrollTo(0, 0); });
  $("#q").addEventListener("input", render);

  document.addEventListener("click", (e) => {
    const rs = e.target.closest(".rs"), tri = e.target.closest(".tri");
    if (rs || tri) {
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
      i.onchange = () => i.files[0].text().then((t) => { try { P = Object.assign({ r: {}, l: {}, exam: "" }, JSON.parse(t)); save(); render(); } catch (x) { alert("Not a valid progress file."); } });
      i.click();
    } else if (e.target.id === "reset" && confirm("Erase all progress in this browser?")) {
      P = { r: {}, l: {}, exam: P.exam }; save(); render();
    }
  });
  document.addEventListener("change", (e) => { if (e.target.id === "exam") { P.exam = e.target.value; save(); render(); } });
  render();
})();
