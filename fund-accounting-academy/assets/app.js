/* Shared shell: top bar, floating TOC + back-to-top, progress (localStorage), quiz engine, pager. */
(function () {
  "use strict";
  const body = document.body;
  const ROOT = body.dataset.root || "";
  const MODS = window.FAA_MODULES || [];
  const KEY = "faa.progress.v1";

  /* ----- progress store (never throws if storage is blocked) ----- */
  const store = {
    read() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } },
    write(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* private mode */ } },
    get(id) { return this.read()[id] || {}; },
    set(id, patch) { const o = this.read(); o[id] = Object.assign(o[id] || {}, patch); this.write(o); }
  };
  window.FAA_STORE = store;

  const el = (tag, attrs, html) => {
    const n = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => n.setAttribute(k, v));
    if (html != null) n.innerHTML = html;
    return n;
  };

  /* ----- theme ----- */
  try { const t = localStorage.getItem("faa.theme"); if (t) document.documentElement.dataset.theme = t; } catch (e) {}

  /* ----- top bar ----- */
  const page = body.dataset.page || "";
  const bar = el("header", { class: "topbar" },
    `<a class="brand" href="${ROOT}index.html">Fund Accounting Academy</a>
     <nav>
       <a href="${ROOT}index.html" class="${page === "home" ? "on" : ""}">Roadmap</a>
       <a href="${ROOT}tools.html" class="${page === "tools" ? "on" : ""}">Calculators</a>
       <a href="${ROOT}glossary.html" class="${page === "glossary" ? "on" : ""}">Glossary</a>
     </nav><span class="spacer"></span><button id="theme" title="Toggle dark mode">◐</button>`);
  body.prepend(bar);
  bar.querySelector("#theme").onclick = () => {
    const dark = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() === "#12161c";
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("faa.theme", next); } catch (e) {}
  };

  /* ----- floating TOC (module list + this page's headings) and back-to-top ----- */
  const tocBtn = el("button", { id: "toc-btn", "aria-label": "Contents", title: "Contents" }, "☰");
  const panel = el("aside", { id: "toc-panel", "aria-label": "Contents" });
  let html = "";
  const heads = [...document.querySelectorAll("main h2")];
  if (heads.length) {
    heads.forEach((h, i) => { if (!h.id) h.id = "sec-" + i; });
    html += "<h4>On this page</h4>" + heads.map((h) => `<a href="#${h.id}">${h.textContent}</a>`).join("");
  }
  html += "<h4>Course</h4>" + MODS.map((m) => `<a href="${ROOT}modules/${m.file}">${m.id} · ${m.title}</a>`).join("");
  panel.innerHTML = html;
  body.append(tocBtn, panel);
  tocBtn.onclick = () => panel.classList.toggle("open");
  panel.addEventListener("click", (e) => { if (e.target.tagName === "A") panel.classList.remove("open"); });
  const topBtn = el("button", { id: "top-btn", "aria-label": "Back to top", title: "Back to top" }, "↑");
  topBtn.onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });
  body.append(topBtn);
  window.addEventListener("scroll", () => { topBtn.style.display = window.scrollY > 500 ? "block" : "none"; }, { passive: true });

  /* ----- home page ----- */
  const grid = document.getElementById("module-grid");
  if (grid) {
    const prog = store.read();
    const doneCount = MODS.filter((m) => (prog[m.id] || {}).done).length;
    const bar2 = document.getElementById("progress-bar");
    if (bar2) bar2.style.width = Math.round((doneCount / MODS.length) * 100) + "%";
    const label = document.getElementById("progress-label");
    if (label) label.textContent = `${doneCount} of ${MODS.length} modules complete`;
    Object.keys(window.FAA_TRACKS).forEach((t) => {
      const mods = MODS.filter((m) => m.track === t);
      const sec = el("section", {}, `<h2>${window.FAA_TRACKS[t].label}</h2>`);
      const g = el("div", { class: "grid" });
      mods.forEach((m) => {
        const p = prog[m.id] || {};
        g.append(el("a", { class: "card mod-card " + m.track, href: `modules/${m.file}` },
          `<h3>${m.id} · ${m.title}</h3><p>${m.blurb}</p>
           <div class="meta"><span>${m.mins} min${p.quiz != null ? " · quiz " + p.quiz + "%" : ""}</span>
           <span>${p.done ? '<span class="done-badge">✓ done</span>' : ""}</span></div>`));
      });
      sec.append(g);
      grid.append(sec);
    });
  }

  /* ----- module page: header pill, pager, completion button, quiz ----- */
  const modId = body.dataset.module;
  if (modId) {
    const idx = MODS.findIndex((m) => m.id === modId);
    const mod = MODS[idx];
    const main = document.querySelector("main");
    const crumb = main.querySelector(".crumb");
    if (crumb && mod) crumb.innerHTML = `<span class="pill ${mod.track}">${window.FAA_TRACKS[mod.track].label}</span> &nbsp; Module ${mod.id} · ~${mod.mins} min`;

    const quizBox = el("section", { class: "quiz" });
    quizBox.innerHTML = '<h2>Check yourself</h2><div id="qs"></div><p class="score" id="score"></p>';
    main.append(quizBox);
    renderQuiz(modId, quizBox.querySelector("#qs"), quizBox.querySelector("#score"));

    const done = el("p", {}, '<button class="btn" id="mark">Mark module complete</button>');
    main.append(done);
    const mark = done.querySelector("#mark");
    const paint = () => { const d = store.get(modId).done; mark.textContent = d ? "✓ Completed (click to undo)" : "Mark module complete"; mark.classList.toggle("ghost", !!d); };
    mark.onclick = () => { store.set(modId, { done: !store.get(modId).done }); paint(); };
    paint();

    const prev = MODS[idx - 1], next = MODS[idx + 1];
    main.append(el("div", { class: "pager" },
      (prev ? `<a class="btn ghost" href="${prev.file}">← ${prev.title}</a>` : `<a class="btn ghost" href="../index.html">← Roadmap</a>`) +
      (next ? `<a class="btn" href="${next.file}">${next.title} →</a>` : `<a class="btn" href="../index.html">Roadmap →</a>`)));
  }

  function renderQuiz(id, qs, scoreEl) {
    const data = (window.FAA_QUIZ || {})[id] || [];
    let answered = 0, right = 0;
    data.forEach((q, qi) => {
      const box = el("div", { class: "q" }, `<p>${qi + 1}. ${q.q}</p>`);
      q.o.forEach((opt, oi) => {
        const lab = el("label", {}, `<input type="radio" name="q${qi}" value="${oi}"> ${opt}`);
        lab.querySelector("input").onchange = () => {
          if (box.classList.contains("answered")) return;
          box.classList.add("answered");
          box.querySelectorAll("input").forEach((i) => (i.disabled = true));
          answered++;
          const labels = box.querySelectorAll("label");
          labels[q.a].classList.add("right");
          if (oi === q.a) right++; else lab.classList.add("wrong");
          if (answered === data.length) {
            const pct = Math.round((right / data.length) * 100);
            scoreEl.textContent = `Score: ${right}/${data.length} (${pct}%)`;
            store.set(id, { quiz: pct });
          }
        };
        box.append(lab);
      });
      box.append(el("div", { class: "why" }, "<b>Why:</b> " + q.w));
      qs.append(box);
    });
    const prior = store.get(id).quiz;
    if (prior != null) scoreEl.textContent = `Best/last score on record: ${prior}%`;
  }
})();
