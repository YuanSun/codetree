/* Shared shell: top bar + search, XP/streak, floating TOC, progress, quizzes, home page, reading bar. */
(function () {
  "use strict";
  const body = document.body;
  const ROOT = body.dataset.root || "";
  const MODS = window.FAA_MODULES || [];
  const KEY = "faa.progress.v1";
  const reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.documentElement.classList.add("js");

  const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } };
  const el = (tag, attrs, html) => {
    const n = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => n.setAttribute(k, v));
    if (html != null) n.innerHTML = html;
    return n;
  };
  const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ----- progress store (never throws if storage is blocked) ----- */
  const store = {
    read() { return lsGet(KEY) || {}; },
    write(o) { lsSet(KEY, o); },
    get(id) { return this.read()[id] || {}; },
    set(id, patch) { const o = this.read(); o[id] = Object.assign(o[id] || {}, patch); this.write(o); }
  };
  window.FAA_STORE = store;

  /* ----- XP, levels, streak ----- */
  const XPKEY = "faa.xp.v1";
  const LEVELS = [[0, "Trainee"], [60, "Junior Associate"], [160, "Associate"], [320, "Senior Associate"], [550, "Analyst"], [850, "Lead"], [1250, "Manager"], [1800, "Principal"]];
  const dayStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const xpState = () => Object.assign({ xp: 0, streak: 0, last: "", daily: "", cards: {} }, lsGet(XPKEY) || {});
  function touchStreak(s) {
    const today = dayStr(new Date());
    if (s.last === today) return s;
    const y = new Date(); y.setDate(y.getDate() - 1);
    s.streak = s.last === dayStr(y) ? s.streak + 1 : 1;
    s.last = today;
    return s;
  }
  function levelOf(xp) {
    let i = 0;
    LEVELS.forEach((l, k) => { if (xp >= l[0]) i = k; });
    const next = LEVELS[i + 1];
    return { n: i + 1, name: LEVELS[i][1], into: xp - LEVELS[i][0], span: next ? next[0] - LEVELS[i][0] : 0 };
  }
  const FAA_XP = window.FAA_XP = {
    state: xpState,
    save(s) { lsSet(XPKEY, s); paintChip(); },
    award(n, why) {
      if (n <= 0) return;
      const s = touchStreak(xpState());
      const before = levelOf(s.xp).n;
      s.xp += n;
      this.save(s);
      toast(`+${n} XP · ${why}`);
      if (levelOf(s.xp).n > before) { toast(`Level up! You are now ${levelOf(s.xp).name}`); confetti(); }
    },
    confetti
  };
  function toast(msg) {
    let box = document.getElementById("toasts");
    if (!box) { box = el("div", { id: "toasts", "aria-live": "polite" }); body.append(box); }
    const t = el("div", { class: "toast" }, esc(msg));
    box.append(t);
    setTimeout(() => t.classList.add("out"), 2600);
    setTimeout(() => t.remove(), 3100);
  }
  function confetti() {
    if (reduceMotion) return;
    const bits = ["💰", "📈", "✨", "🎉", "🟦", "🟩"];
    for (let i = 0; i < 26; i++) {
      const b = el("span", { class: "confetti" }, bits[i % bits.length]);
      b.style.left = Math.random() * 100 + "vw";
      b.style.animationDelay = Math.random() * 0.4 + "s";
      b.style.fontSize = 14 + Math.random() * 14 + "px";
      body.append(b);
      setTimeout(() => b.remove(), 2200);
    }
  }
  function paintChip() {
    const chip = document.getElementById("xpchip");
    if (!chip) return;
    const s = xpState(), L = levelOf(s.xp);
    const pct = L.span ? Math.round((L.into / L.span) * 100) : 100;
    chip.innerHTML = `<span class="flame">🔥${s.streak || 1}</span><span class="lvl">Lv ${L.n} · ${L.name}</span><i class="xpbar"><b style="width:${pct}%"></b></i><span class="xpn">${s.xp} XP</span>`;
    chip.title = L.span ? `${L.span - L.into} XP to the next level` : "Top level";
  }
  lsSet(XPKEY, touchStreak(xpState()));

  /* ----- theme ----- */
  try { const t = localStorage.getItem("faa.theme"); if (t) document.documentElement.dataset.theme = t; } catch (e) {}

  /* ----- top bar ----- */
  const page = body.dataset.page || "";
  const on = (p) => (page === p ? "on" : "");
  const bar = el("header", { class: "topbar" },
    `<a class="brand" href="${ROOT}index.html">📈 Fund Accounting Academy</a>
     <nav>
       <a href="${ROOT}index.html" class="${on("home")}">Roadmap</a>
       <a href="${ROOT}flashcards.html" class="${on("flashcards")}">Flashcards</a>
       <a href="${ROOT}tools.html" class="${on("tools")}">Calculators</a>
       <a href="${ROOT}glossary.html" class="${on("glossary")}">Glossary</a>
     </nav><span class="spacer"></span>
     <span id="xpchip" class="xpchip"></span>
     <form class="search" action="${ROOT}search.html" method="get" role="search">
       <input name="q" type="search" placeholder="Search concepts ( / )" autocomplete="off" aria-label="Search the course">
       <div class="search-pop" role="listbox"></div></form>
     <button id="theme" title="Toggle dark mode">◐</button>`);
  body.prepend(bar);
  paintChip();
  bar.querySelector("#theme").onclick = () => {
    const dark = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() === "#12161c";
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("faa.theme", next); } catch (e) {}
  };

  /* ----- search box: top matches as you type; Enter opens the full results page ----- */
  (function () {
    if (page === "search") { bar.querySelector(".search").style.display = "none"; return; }
    const form = bar.querySelector(".search"), input = form.querySelector("input"), pop = form.querySelector(".search-pop");
    let ready = null, sel = -1;
    const load = () => ready || (ready = Promise.all(["assets/search-index.js", "assets/search.js"].map((f) => new Promise((ok, no) => {
      const sc = document.createElement("script"); sc.src = ROOT + f; sc.onload = ok; sc.onerror = no; document.head.append(sc);
    }))).catch(() => { ready = null; }));
    const kind = { module: "Lesson", term: "Glossary", tool: "Calculator" };
    async function show() {
      const q = input.value.trim();
      if (!q) { pop.classList.remove("open"); return; }
      await load();
      if (!window.FAA_SEARCH || !window.FAA_INDEX) return;
      const rows = FAA_SEARCH.search(window.FAA_INDEX, q, 6);
      sel = -1;
      pop.innerHTML = rows.length
        ? rows.map(({ entry: e }) => `<a href="${ROOT}${e.u}"><b>${esc(e.h)}</b><small>${kind[e.k]}${e.k === "module" ? " · " + esc(e.t) : ""}</small></a>`).join("") +
          `<div class="more">Enter for all results</div>`
        : '<div class="none">No matches</div>';
      pop.classList.add("open");
    }
    input.addEventListener("focus", load);
    input.addEventListener("input", show);
    input.addEventListener("keydown", (e) => {
      const items = [...pop.querySelectorAll("a")];
      if (e.key === "Escape") { pop.classList.remove("open"); input.blur(); }
      else if ((e.key === "ArrowDown" || e.key === "ArrowUp") && items.length) {
        e.preventDefault();
        sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        items.forEach((a, i) => a.classList.toggle("sel", i === sel));
      } else if (e.key === "Enter" && sel >= 0 && items[sel]) { e.preventDefault(); location.href = items[sel].href; }
    });
    document.addEventListener("click", (e) => { if (!form.contains(e.target)) pop.classList.remove("open"); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); }
    });
  })();

  /* ----- floating TOC (module list + this page's headings) and back-to-top ----- */
  const tocBtn = el("button", { id: "toc-btn", "aria-label": "Contents", title: "Contents" }, "☰");
  const panel = el("aside", { id: "toc-panel", "aria-label": "Contents" });
  let html = "";
  const heads = [...document.querySelectorAll("main h2")];
  if (heads.length) {
    heads.forEach((h, i) => { if (!h.id) h.id = "sec-" + i; });
    html += "<h4>On this page</h4>" + heads.map((h) => `<a href="#${h.id}">${h.textContent}</a>`).join("");
  }
  html += "<h4>Course</h4>" + MODS.map((m) => `<a href="${ROOT}modules/${m.file}">${m.icon} ${m.id} · ${m.title}</a>`).join("");
  panel.innerHTML = html;
  body.append(tocBtn, panel);
  tocBtn.onclick = () => panel.classList.toggle("open");
  panel.addEventListener("click", (e) => { if (e.target.tagName === "A") panel.classList.remove("open"); });
  const topBtn = el("button", { id: "top-btn", "aria-label": "Back to top", title: "Back to top" }, "↑");
  topBtn.onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });
  body.append(topBtn);
  window.addEventListener("scroll", () => { topBtn.style.display = window.scrollY > 500 ? "block" : "none"; }, { passive: true });

  /* ----- home page ----- */
  const hero = document.getElementById("hero");
  if (hero) buildHome();

  function buildHome() {
    const prog = store.read();
    const done = (m) => !!(prog[m.id] || {}).done;
    const doneCount = MODS.filter(done).length;
    const next = MODS.find((m) => !done(m));
    const qCount = Object.values(window.FAA_QUIZ || {}).reduce((n, q) => n + q.length, 0);
    const mins = MODS.reduce((n, m) => n + m.mins, 0);
    const s = xpState(), L = levelOf(s.xp);

    hero.innerHTML = `
      <div class="hero-copy">
        <span class="eyebrow">Fund accounting · Advent Geneva · Senior skills</span>
        <h1>Learn to run a fund's books like a senior.</h1>
        <p>Short lessons, live calculators, flashcards and quizzes. Go from first month on the desk to the person who reviews the NAV.</p>
        <div class="hero-cta">
          ${next ? `<a class="btn big" href="modules/${next.file}">${doneCount ? "Continue" : "Start"}: ${next.icon} ${esc(next.title)} →</a>` : `<a class="btn big" href="flashcards.html">All done! Drill flashcards →</a>`}
          <a class="btn big ghost-w" href="flashcards.html">Flashcards</a>
        </div>
      </div>
      <div class="hero-stats">
        <div><b>${MODS.length}</b><span>modules</span></div>
        <div><b>${Math.round(mins / 60)}h</b><span>of lessons</span></div>
        <div><b>${qCount}</b><span>quiz questions</span></div>
        <div><b>${(window.FAA_GLOSSARY || []).length || 60}+</b><span>glossary terms</span></div>
      </div>`;

    const status = document.getElementById("status");
    if (status) {
      const pct = Math.round((doneCount / MODS.length) * 100);
      status.innerHTML = `
        <div class="card stat"><div class="ring big" style="--p:${pct}"><span>${pct}%</span></div>
          <div><b>${doneCount} of ${MODS.length} modules</b><p>${next ? "Next up: " + esc(next.title) : "Course complete!"}</p></div></div>
        <div class="card stat"><div class="ring big gold" style="--p:${L.span ? Math.round((L.into / L.span) * 100) : 100}"><span>${L.n}</span></div>
          <div><b>${esc(L.name)}</b><p>${s.xp} XP · 🔥 ${s.streak || 1}-day streak</p></div></div>
        <div id="daily" class="card daily"></div>`;
      buildDaily(document.getElementById("daily"));
    }

    const grid = document.getElementById("module-grid");
    Object.keys(window.FAA_TRACKS).forEach((t) => {
      const mods = MODS.filter((m) => m.track === t);
      const sec = el("section", { class: "track " + t }, `<h2><span class="dot"></span>${window.FAA_TRACKS[t].label}<small>${mods.length} modules · ${mods.reduce((n, m) => n + m.mins, 0)} min</small></h2>`);
      const g = el("div", { class: "grid path" });
      mods.forEach((m) => {
        const p = prog[m.id] || {};
        const pct = p.done ? 100 : p.quiz != null ? 50 : 0;
        g.append(el("a", { class: "card mod-card " + m.track + (next && next.id === m.id ? " next" : ""), href: `modules/${m.file}` },
          `<div class="ring" style="--p:${pct}"><span>${m.icon}</span></div>
           <div class="mc-body"><h3><small>${m.id}</small> ${esc(m.title)}</h3><p>${esc(m.blurb)}</p>
           <div class="meta"><span>${m.mins} min${p.quiz != null ? " · quiz " + p.quiz + "%" : ""}</span>
           <span>${p.done ? '<span class="done-badge">✓ done</span>' : next && next.id === m.id ? '<span class="next-badge">Up next</span>' : ""}</span></div></div>`));
      });
      sec.append(g);
      grid.append(sec);
    });
  }

  /* ----- daily challenge: one question a day, picked by date ----- */
  function buildDaily(box) {
    const all = [];
    Object.entries(window.FAA_QUIZ || {}).forEach(([id, qs]) => qs.forEach((q) => all.push(Object.assign({ id }, q))));
    if (!all.length) return;
    const d = new Date();
    const q = all[(d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate()) % all.length];
    const today = dayStr(d), s = xpState();
    box.innerHTML = `<b>🎯 Daily challenge</b><p>${q.q}</p>`;
    q.o.forEach((o, i) => {
      const b = el("button", { class: "opt" }, esc(o));
      b.onclick = () => {
        box.querySelectorAll(".opt").forEach((x, k) => { x.disabled = true; if (k === q.a) x.classList.add("right"); });
        if (i !== q.a) b.classList.add("wrong");
        box.append(el("p", { class: "why" }, "<b>Why:</b> " + q.w));
        if (i === q.a && s.daily !== today) { const st = xpState(); st.daily = today; lsSet(XPKEY, st); FAA_XP.award(15, "daily challenge"); }
      };
      box.append(b);
    });
  }

  /* ----- module page ----- */
  const modId = body.dataset.module;
  if (modId) {
    const idx = MODS.findIndex((m) => m.id === modId);
    const mod = MODS[idx];
    const main = document.querySelector("main");
    const crumb = main.querySelector(".crumb");
    const h1 = main.querySelector("h1");
    const lead = main.querySelector(".lead");
    if (mod && crumb && h1) {
      crumb.innerHTML = `<span class="pill ${mod.track}">${window.FAA_TRACKS[mod.track].label}</span> &nbsp; Module ${mod.id} of ${MODS.length} · ~${mod.mins} min`;
      const hero2 = el("div", { class: "mod-hero " + mod.track });
      main.insertBefore(hero2, crumb);
      hero2.append(crumb, h1);
      if (lead) hero2.append(lead);
      hero2.prepend(el("div", { class: "mod-icon" }, mod.icon));
    }

    const quizBox = el("section", { class: "quiz" });
    quizBox.innerHTML = '<h2>Check yourself</h2><div id="qs"></div><p class="score" id="score"></p>';
    main.append(quizBox);
    renderQuiz(modId, quizBox.querySelector("#qs"), quizBox.querySelector("#score"));

    const done = el("p", {}, '<button class="btn" id="mark">Mark module complete</button>');
    main.append(done);
    const mark = done.querySelector("#mark");
    const paint = () => { const d = store.get(modId).done; mark.textContent = d ? "✓ Completed (click to undo)" : "Mark module complete"; mark.classList.toggle("ghost", !!d); };
    mark.onclick = () => {
      const was = store.get(modId);
      store.set(modId, { done: !was.done });
      if (!was.done && !was.xpDone) { store.set(modId, { xpDone: true }); FAA_XP.award(50, `module ${modId} complete`); confetti(); }
      paint();
    };
    paint();

    const prev = MODS[idx - 1], next = MODS[idx + 1];
    main.append(el("div", { class: "pager" },
      (prev ? `<a class="btn ghost" href="${prev.file}">← ${prev.title}</a>` : `<a class="btn ghost" href="../index.html">← Roadmap</a>`) +
      (next ? `<a class="btn" href="${next.file}">${next.title} →</a>` : `<a class="btn" href="../index.html">Roadmap →</a>`)));

    // reading progress bar
    const rb = el("div", { id: "readbar" }, "<i></i>");
    body.append(rb);
    const upd = () => { const h = document.documentElement.scrollHeight - innerHeight; rb.firstChild.style.width = (h > 0 ? Math.min(100, (scrollY / h) * 100) : 0) + "%"; };
    addEventListener("scroll", upd, { passive: true }); upd();
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
            const best = store.get(id).bestRight || 0;   // XP only for improving your best, so retakes can't farm points
            store.set(id, { quiz: pct, bestRight: Math.max(best, right) });
            if (right > best) FAA_XP.award((right - best) * 10, `quiz ${id}`);
            if (right === data.length) confetti();
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

  /* ----- fade-in on scroll (skipped for reduced motion / no IntersectionObserver) ----- */
  if (!reduceMotion && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
    document.querySelectorAll("main h2, main .card, main .callout, main .flow, main table, main details").forEach((n) => { n.classList.add("rv"); io.observe(n); });
  }
})();
