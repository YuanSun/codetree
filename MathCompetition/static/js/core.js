/* Math Contest Lab — shared front-end toolkit (no dependencies).
 *
 *   MC.h / MC.fmt / MC.parseNum      small helpers
 *   MC.store                         progress: the signed-in profile's (Postgres) or this browser's (localStorage)
 *   MC.award / MC.confetti / MC.toast / MC.badge   rewards
 *   MC.guided(root, cfg)             "you do each step" worked examples
 *   MC.quiz(root, data)              the practice / homework engine
 *   MC.widgets                       registry for figures & explorers used by quiz questions
 */
(function () {
  'use strict';
  const MC = (window.MC = { widgets: {} });
  // URL prefix when a gateway mounts the site under a path (e.g. "/math"); derived from this script's own URL.
  const BASE = (document.currentScript && document.currentScript.src
    ? new URL(document.currentScript.src).pathname.replace(/\/static\/js\/core\.js$/, '') : '');
  MC.base = BASE;

  /* ------------------------------------------------------------------ helpers */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  MC.$ = $; MC.$$ = $$;

  /** Tiny hyperscript: h('div', {class:'x', html:'<b>hi</b>', onclick: fn}, child, ...) */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'html') el.innerHTML = v;
      else if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
    return el;
  }
  MC.h = h;
  /** el.replaceChildren(...) that skips null/false (plain replaceChildren would write the text "null"). */
  MC.fill = (el, ...kids) => el.replaceChildren(...kids.flat().filter((k) => k != null && k !== false));

  /** Mini markup for content strings: [[3/8]] -> stacked fraction, **bold**. Everything else is plain HTML. */
  MC.fmt = (s) =>
    String(s)
      .replace(/\[\[([^\]/]+)\/([^\]]+)\]\]/g, '<span class="frac"><span>$1</span><span>$2</span></span>')
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/\*([^*<>]+)\*/g, '<i>$1</i>');

  /** "$1,200", "3/8", "1 1/2", "45 min", "25%" -> number (NaN if there is none). */
  MC.parseNum = function (raw) {
    if (typeof raw === 'number') return raw;
    const s = String(raw).toLowerCase().replace(/,/g, '').replace(/[$%]/g, '').replace(/\s+/g, ' ').trim();
    let m = s.match(/^(-?\d+) (\d+)\s*\/\s*(\d+)/);
    if (m) return +m[1] + (+m[2] / +m[3]) * (+m[1] < 0 ? -1 : 1);
    m = s.match(/^(-?\d*\.?\d+)\s*\/\s*(\d*\.?\d+)/);
    if (m) return +m[2] ? +m[1] / +m[2] : NaN;
    m = s.match(/-?\d*\.?\d+/);
    return m ? +m[0] : NaN;
  };
  MC.near = (a, b, tol = 0.011) => Math.abs(a - b) <= tol;
  MC.gcd = (a, b) => (b ? MC.gcd(b, a % b) : Math.abs(a));
  MC.clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  MC.money = (v) => '$' + (Math.round(v * 100) / 100).toFixed(2).replace(/\.00$/, '');
  MC.shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  MC.svg = (tag, attrs = {}, ...kids) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    for (const kid of kids.flat()) if (kid != null) el.append(kid.nodeType ? kid : document.createTextNode(kid));
    return el;
  };

  /* -------------------------------------------------------------------- store */
  // Two homes for progress: a signed-in profile (Postgres, via the server) or just this browser (localStorage).
  // /api/session.js runs before this file and says which one, plus the saved progress, so it is known synchronously.
  const SESSION = (MC.session = window.MC_SESSION || { enabled: false, user: null, state: null });
  const USER = SESSION.user;
  const KEY = USER ? `mc.progress.v1.u${USER.id}` : 'mc.progress.v1';     // local copy: the only store when signed out, a backup when signed in
  const OUTBOX = `mc.outbox.v1.u${USER ? USER.id : 0}`;                   // changes the server has not confirmed yet
  const blank = () => ({ xp: 0, weeks: {} });
  const readJSON = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode: nothing persists locally */ } };
  let state = USER && SESSION.state ? Object.assign(blank(), SESSION.state) : (readJSON(KEY) || blank());
  let outbox = (USER && readJSON(OUTBOX)) || { set: {}, del: {}, xp: null };

  function applyOutbox() {            // changes made just before the last page change that never reached the server
    for (const [k, v] of Object.entries(outbox.set)) { const [w, p, id] = k.split('|'); ((state.weeks[w] = state.weeks[w] || {})[p] = state.weeks[w][p] || {})[id] = v; }
    for (const k of Object.keys(outbox.del)) { const [w, p, id] = k.split('|'); if (state.weeks[w] && state.weeks[w][p]) delete state.weeks[w][p][id]; }
    if (outbox.xp != null) state.xp = Math.max(state.xp, outbox.xp);
  }
  let flushTimer = 0, flushing = false;
  function flush(unload) {
    clearTimeout(flushTimer);
    const pending = Object.keys(outbox.set).length + Object.keys(outbox.del).length || outbox.xp != null;
    if (!USER || flushing || !pending) return;
    flushing = true;
    const sent = JSON.parse(JSON.stringify(outbox));
    const body = JSON.stringify({ set: Object.entries(sent.set).map(([k, v]) => [...k.split('|'), v]), del: Object.keys(sent.del).map((k) => k.split('|')), xp: sent.xp });
    fetch(`${BASE}/api/progress`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body, keepalive: !!unload, credentials: 'same-origin' })
      .then((r) => { if (!r.ok) throw new Error(r.status); })
      .then(() => {   // drop only what was sent (newer changes made meanwhile stay queued)
        for (const [k, v] of Object.entries(sent.set)) if (JSON.stringify(outbox.set[k]) === JSON.stringify(v)) delete outbox.set[k];
        for (const k of Object.keys(sent.del)) delete outbox.del[k];
        if (outbox.xp === sent.xp) outbox.xp = null;
        writeJSON(OUTBOX, outbox); setSync('ok');
      })
      .catch(() => { setSync('offline'); flushTimer = setTimeout(flush, 15000); })   // keep it queued and try again
      .finally(() => { flushing = false; });
  }
  function setSync(mode) { MC.sync = mode; const el = document.querySelector('.nav .who'); if (el) el.dataset.sync = mode; }
  const save = (change) => {
    writeJSON(KEY, state);
    if (!USER || !change) return;
    if (change.xp != null) outbox.xp = change.xp;
    if (change.set) { outbox.set[change.set.key] = change.set.val; delete outbox.del[change.set.key]; }
    if (change.del) { outbox.del[change.del] = 1; delete outbox.set[change.del]; }
    writeJSON(OUTBOX, outbox);
    clearTimeout(flushTimer); flushTimer = setTimeout(flush, 400);
  };
  if (USER) {
    applyOutbox(); writeJSON(KEY, state);
    addEventListener('pagehide', () => flush(true));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(true); });
    setTimeout(flush, 50);
  }
  const k3 = (w, p, id) => `${w}|${p}|${id}`;

  MC.store = {
    get: (w, p, id) => ((state.weeks[w] || {})[p] || {})[id] || null,
    set(w, p, id, val) { (state.weeks[w] = state.weeks[w] || {}); (state.weeks[w][p] = state.weeks[w][p] || {}); state.weeks[w][p][id] = val; save({ set: { key: k3(w, p, id), val } }); },
    del(w, p, id) { if (state.weeks[w] && state.weeks[w][p]) { delete state.weeks[w][p][id]; save({ del: k3(w, p, id) }); } },
    count: (w, p) => Object.values((state.weeks[w] || {})[p] || {}).filter((v) => v && v.done).length,
    countWeek: (w) => Object.keys(state.weeks[w] || {}).reduce((n, p) => n + MC.store.count(w, p), 0),
    xp: () => state.xp,
    addXP(n) { state.xp += n; save({ xp: state.xp }); renderNav(); },
  };

  const LEVELS = [[0, 'Rookie', '🌱'], [80, 'Explorer', '🧭'], [200, 'Problem Solver', '🧩'], [400, 'Contest Climber', '🧗'], [700, 'Gauss Hero', '🦸'], [1100, 'CJMC Champion', '🏆'],
    [1700, 'Pascal Pro', '🚀'], [2500, 'Cayley Crusher', '💎'], [3500, 'Euclid Legend', '👑']];
  MC.level = (xp = state.xp) => LEVELS.reduce((best, l) => (xp >= l[0] ? l : best), LEVELS[0]);

  /** Mark a lesson task done (once) and pay out XP. Returns true the first time. */
  MC.award = function (week, page, id, xp, extra) {
    const prev = MC.store.get(week, page, id);
    if (prev && prev.done) return false;
    MC.store.set(week, page, id, Object.assign({ done: 1 }, extra || {}));
    MC.store.addXP(xp);
    MC.toast(`+${xp} XP ⭐`);
    return true;
  };

  /* ---------------------------------------------------------------------- fx */
  const particles = [];
  let fxRunning = false;
  MC.confetti = function (n = 90, x = innerWidth / 2, y = innerHeight / 3) {
    let c = $('#fx');
    if (!c) { c = h('canvas', { id: 'fx' }); document.body.append(c); }
    c.width = innerWidth; c.height = innerHeight;
    const colors = ['#ff8a3d', '#f5b82e', '#17b26a', '#3b82f6', '#8b5cf6', '#e5484d'];
    for (let i = 0; i < n; i++) particles.push({ x, y, vx: (Math.random() - 0.5) * 13, vy: Math.random() * -13 - 3, r: 4 + Math.random() * 5, c: colors[i % colors.length], a: Math.random() * 6, va: (Math.random() - 0.5) * 0.4, t: 0 });
    if (fxRunning) return;
    fxRunning = true;
    const ctx = c.getContext('2d');
    (function tick() {
      ctx.clearRect(0, 0, c.width, c.height);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.vy += 0.36; p.x += p.vx; p.y += p.vy; p.a += p.va; p.t++;
        if (p.y > c.height + 20 || p.t > 200) { particles.splice(i, 1); continue; }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore();
      }
      if (particles.length) requestAnimationFrame(tick); else { fxRunning = false; ctx.clearRect(0, 0, c.width, c.height); }
    })();
  };

  let toastTimer;
  MC.toast = function (msg) {
    let t = $('.toast');
    if (!t) { t = h('div', { class: 'toast' }); document.body.append(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  };

  MC.badge = function (emoji, title, text) {
    const pop = h('div', { class: 'badge-pop', onclick: () => pop.remove() },
      h('div', {}, h('div', { class: 'big' }, emoji), h('h2', {}, title), h('p', {}, text), h('button', { class: 'btn go' }, 'Awesome!')));
    document.body.append(pop);
    MC.confetti(160);
  };

  /* ---------------------------------------------------------------------- nav */
  let skillList = null, navPct = 0;
  MC.setSkillBar = (list) => { skillList = list; renderNav(); };
  MC.setProgress = (pct) => { navPct = pct; const b = $('.nav-progress'); if (b) b.style.width = pct + '%'; };
  function renderNav() {
    const host = $('#mc-nav');
    if (!host) return;
    const d = document.body.dataset;
    const [, name, icon] = MC.level();
    // two tracks share this engine: the contest lab (/week/…) and normal school study (/study/…)
    const study = d.track === 'study';
    host.replaceChildren(
      h('div', { class: 'nav' },
        h('a', { href: BASE + (study ? '/study/' : '/') }, study ? '📚 Study' : '🧪 Math Lab'),
        d.week ? h('span', { class: 'crumb' }, '› ', h('a', { href: `${BASE}/${study ? 'study' : 'week'}/${d.week}/` }, d.weekTitle || d.week)) : null,
        h('span', { class: 'spacer' }),
        skillList ? h('div', { class: 'skillbar', title: 'Skill badges' }, skillList.map((s) => h('span', { class: s.done ? 'done' : '', style: { '--c': s.color }, title: s.label }, s.emoji))) : null,
        whoChip(),
        // contest level names (Gauss Hero…) make no sense for school study: show just the points there
        h('span', { class: 'xp', title: study ? 'Your points' : 'Your level' }, study ? '⭐ ' : `${icon} ${name} · `, h('b', {}, `${state.xp} XP`)),
        h('div', { class: 'nav-progress', style: { width: navPct + '%' } })));
  }
  MC.renderNav = renderNav;

  /** Who is signed in (or a "Sign in" link). Hidden entirely when the server has no accounts set up. */
  function whoChip() {
    if (!SESSION.enabled) return null;
    if (SESSION.dbDown) return h('span', { class: 'who warn', title: 'The account database is not reachable, so progress is only saved on this device' }, '⚠️ offline');
    if (!USER) return h('a', { class: 'who signin', href: `${BASE}/login?next=${encodeURIComponent(location.pathname + location.search)}`, title: 'Sign in to keep your progress on every device' }, '🔑 Sign in');
    const parent = USER.role === 'parent';
    return h('span', { class: 'who', 'data-sync': MC.sync || 'ok' },
      parent ? h('a', { href: `${BASE}/parent/`, title: 'Parent view' }, '👪') : null,
      h('span', { class: 'who-name', title: parent ? 'Parent profile' : 'Your profile' }, `${parent ? '' : '🙂 '}${USER.name}`),
      h('button', { type: 'button', class: 'who-out', title: 'Sign out', onclick: signOut }, '⎋'));
  }
  function signOut() {
    flush(true);
    fetch(`${BASE}/api/logout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', credentials: 'same-origin' })
      .finally(() => { location.href = `${BASE}/login`; });
  }

  /* ------------------------------------------------- progress meters (home/hub) */
  function paintMeters() {
    $$('.week-card[data-week]').forEach((card) => meter(card, MC.store.countWeek(card.dataset.week), +card.dataset.total, "Not started — let's go!"));
    $$('.page-card[data-page-slug]').forEach((card) => meter(card, MC.store.count(card.dataset.week, card.dataset.pageSlug), +card.dataset.total, 'Start here →'));
  }
  function meter(card, done, total, empty) {
    const bar = $('.meter', card), label = $('[data-label]', card);
    if (!total) { if (bar) bar.style.display = 'none'; if (label) label.textContent = ''; return; }
    $('i', bar).style.width = Math.min(100, Math.round((done / total) * 100)) + '%';
    label.textContent = done ? (done >= total ? `✅ All ${total} done!` : `${done} / ${total} done`) : empty;
  }

  /* ------------------------------------------------------------ guided steps */
  /**
   * cfg = { week, page='lesson', id, xp=10, finale:'html', onStep(i), steps:[
   *    { q:'html', type:'number', answer: 4 | [4, 4.0], tol, nudge, hint, ok }
   *    { q, type:'choice', choices:['a','b'], answer: 1, ok }
   *    { q, type:'action', btn:'Check my build', check: () => true | 'message', ok }
   * ]}
   * A step only appears once the previous one is solved — you have to think, not just click Next.
   */
  MC.guided = function (root, cfg) {
    const page = cfg.page || 'lesson';
    const answerOf = (s) => (typeof s.answer === 'function' ? s.answer() : s.answer);   // answers may depend on live lab state
    const wrap = h('div', { class: 'guided' });
    root.append(wrap);
    let peeked = false;
    const blocks = cfg.steps.map((s, i) => makeStep(s, i));
    blocks.forEach((b) => wrap.append(b.el));
    const win = h('div', { class: 'win', style: { display: 'none' } });
    wrap.append(win);
    blocks[0].open();

    function next(i, usedPeek) {
      if (usedPeek) peeked = true;
      if (cfg.onStep) cfg.onStep(i);
      if (i + 1 < blocks.length) { blocks[i + 1].open(); return; }
      win.style.display = ''; win.innerHTML = MC.fmt(cfg.finale || '🎉 Nice work!');
      if (cfg.id) {
        if (MC.award(cfg.week, page, cfg.id, peeked ? 4 : cfg.xp || 10, { peeked })) { if (!peeked) MC.confetti(70); }
      }
      if (cfg.onDone) cfg.onDone();
    }

    function makeStep(s, i) {
      const el = h('div', { class: 'step locked' });
      const controls = h('div', { class: 'controls' });
      const fb = h('div', { class: 'fb' });
      el.append(h('div', { class: 'q', html: `<span class="n">${i + 1}</span>${MC.fmt(s.q)}` }), controls, fb);
      let wrong = 0;

      const solved = (peek) => {
        el.classList.remove('current'); el.classList.add('done');
        controls.replaceChildren();
        fb.className = 'fb ok';
        const okText = typeof s.ok === 'function' ? s.ok() : s.ok;
        fb.innerHTML = (peek ? '👀 ' : '✅ ') + MC.fmt(okText || (s.type === 'number' ? `Answer: ${[].concat(answerOf(s))[0]}` : ''));
        next(i, peek);
      };
      const miss = (msg) => {
        wrong++; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
        fb.className = 'fb bad';
        fb.innerHTML = '🤔 ' + MC.fmt(msg || (wrong === 1 ? s.nudge || 'Not quite — have another go.' : s.hint || 'Look at the hint in the picture above, then try again.'));
        if (wrong >= 3 && !$('.peek', controls)) {
          controls.append(h('button', { class: 'btn ghost small peek', onclick: () => solved(true) }, 'Show me this step'));
        }
      };

      if (s.type === 'choice') {
        s.choices.forEach((c, ci) => {
          const b = h('button', { class: 'choice', html: MC.fmt(c) });
          b.onclick = () => {
            if (ci === s.answer) { b.classList.add('right'); solved(false); }
            else { b.classList.add('wrong'); b.disabled = true; miss(s.wrongMsgs && s.wrongMsgs[ci]); }
          };
          controls.append(b);
        });
      } else if (s.type === 'action') {
        controls.append(h('button', {
          class: 'btn small', onclick: () => {
            const r = s.check();
            if (r === true) solved(false); else miss(typeof r === 'string' ? r : s.nudge || 'Not yet — keep building!');
          },
        }, s.btn || 'Check'));
      } else {
        const input = h('input', { type: 'text', class: 'ans', placeholder: s.placeholder || 'your answer', inputmode: 'decimal', autocomplete: 'off' });
        const go = () => {
          const v = MC.parseNum(input.value);
          const ok = [].concat(answerOf(s)).some((a) => MC.near(v, a, s.tol == null ? 0.011 : s.tol));
          if (ok) solved(false); else if (input.value.trim() === '') { input.focus(); } else { input.select(); miss(); }
        };
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
        controls.append(input, ...(s.unit ? [h('span', { class: 'muted' }, s.unit)] : []), h('button', { class: 'btn small', onclick: go }, 'Check'));
      }
      return {
        el,
        open() {
          el.classList.remove('locked'); el.classList.add('current');
          const inp = $('input', el);
          if (inp && i > 0) inp.focus({ preventScroll: true });   // first step: don't steal focus on page load
        },
      };
    }
    return { wrap };
  };

  /* --------------------------------------------------------------------- quiz */
  const DIFF = { easy: 'Easy', medium: 'Medium', 'medium-hard': 'Medium–Hard', hard: 'Hard' };
  const diffClass = (d) => (d === 'easy' ? 'easy' : d === 'hard' ? 'hard' : 'medium');
  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  MC.quiz = function (root, data) {
    const week = document.body.dataset.week, page = document.body.dataset.pageSlug;
    const qs = data.questions;
    const groups = data.groups && data.groups.length ? data.groups : [{ id: 'all', label: 'Questions', emoji: '📝' }];
    qs.forEach((q) => { q.group = q.skill && data.groups ? q.skill : groups[0].id; });
    const inGroup = (g) => qs.filter((q) => q.group === g.id);
    const sess = {};   // in-progress state per question id (wrong picks, hints) so you can hop around
    let gi = 0, qi = 0, timer = null;
    const hashId = location.hash.slice(1);
    const hit = qs.find((q) => q.id === hashId);
    if (hit) { gi = groups.findIndex((g) => g.id === hit.group); qi = inGroup(groups[gi]).indexOf(hit); }

    const header = h('section', { class: 'hero' },
      h('div', { class: 'eyebrow' }, data.eyebrow || ''), h('h1', {}, data.title || 'Practice'),
      data.intro ? h('p', { html: MC.fmt(data.intro) }) : null);
    const tabs = h('div', { class: 'skilltabs' });
    const qnav = h('div', { class: 'qnav' });
    const card = h('div', { class: 'qcard' });
    root.append(header, tabs, qnav, card);

    const rec = (q) => MC.store.get(week, page, q.id) || {};
    const S = (q) => (sess[q.id] = sess[q.id] || { picked: null, wrong: [], hints: 0, start: Date.now() });

    function paintTabs() {
      tabs.replaceChildren(...groups.map((g, i) => {
        const list = inGroup(g);
        const done = list.filter((q) => rec(q).done).length;
        return h('button', { class: 'skilltab' + (i === gi ? ' on' : ''), style: { '--c': g.color || 'var(--navy)' }, onclick: () => { gi = i; qi = firstOpen(g); show(); } },
          g.emoji ? h('span', {}, g.emoji) : null, h('span', {}, g.label), h('small', {}, `${done}/${list.length}`));
      }));
      if (groups.length === 1) tabs.style.display = 'none';
    }
    const firstOpen = (g) => { const i = inGroup(g).findIndex((q) => !rec(q).done); return i < 0 ? 0 : i; };

    function paintNav() {
      const list = inGroup(groups[gi]);
      qnav.replaceChildren(...list.map((q, i) => {
        const r = rec(q);
        return h('button', { class: `qpill d-${diffClass(q.difficulty)}` + (i === qi ? ' on' : '') + (r.done ? ' solved' : r.revealed ? ' peeked' : ''), title: `${q.source || ''} — ${DIFF[q.difficulty] || ''}`, onclick: () => { qi = i; show(); } }, r.done ? '✓' : String(i + 1));
      }));
    }

    function show() {
      paintTabs(); paintNav(); renderCard();
      const q = inGroup(groups[gi])[qi];
      if (q) history.replaceState(null, '', '#' + q.id);
    }

    function stars(q) {
      const s = S(q);
      return Math.max(1, 3 - (s.hints > 0 ? 1 : 0) - (s.wrong.length > 0 ? 1 : 0));
    }

    function renderCard() {
      clearInterval(timer);
      const q = inGroup(groups[gi])[qi];
      card.replaceChildren();
      if (!q) { card.append(h('p', {}, 'Nothing here yet.')); return; }
      const g = groups[gi], r = rec(q), s = S(q);
      const finished = !!(r.done || r.revealed);
      card.style.borderTop = `6px solid ${g.color || 'var(--navy)'}`;

      // head
      const timerEl = h('span', { class: 'timer', title: 'Contest pace: about 2 minutes a question' }, '');
      card.append(h('div', { class: 'qhead' },
        h('span', { class: 'src' }, q.source || ''), h('span', { class: `tag ${diffClass(q.difficulty)}` }, DIFF[q.difficulty] || ''),
        q.skillLabel ? h('span', { class: 'tag' }, q.skillLabel) : null, timerEl));
      if (q.title) card.append(h('h3', { class: 'qtitle' }, q.title));
      card.append(h('div', { class: 'qtext', html: MC.fmt(q.text) }));
      if (q.figure) {
        const f = h('div', { class: 'figure' });
        if (typeof q.figure === 'string') f.innerHTML = q.figure;
        else if (MC.widgets[q.figure.type]) MC.widgets[q.figure.type](f, q.figure, { q });
        card.append(f);
      }

      // choices
      const optBox = h('div', { class: 'choices' });
      const checkBtn = h('button', { class: 'btn go', disabled: true }, 'Check my answer');
      q.choices.forEach((c, i) => {
        const struck = s.wrong.includes(i);
        const b = h('button', {
          class: 'opt' + (struck ? ' wrong' : '') + (finished && i === q.answer ? ' right' : '') + (s.picked === i ? ' picked' : ''),
          disabled: finished || struck, html: `<span class="letter">${'ABCDE'[i]}</span><span>${MC.fmt(c)}</span>`,
        });
        b.onclick = () => { s.picked = i; $$('.opt', optBox).forEach((o, j) => o.classList.toggle('picked', j === i)); checkBtn.disabled = false; };
        optBox.append(b);
      });
      card.append(optBox);
      if (!finished) checkBtn.disabled = s.picked == null;

      // hints
      const hintBox = h('div', { class: 'hints' });
      const hints = q.hints || [];
      const hintBtn = h('button', { class: 'btn ghost' }, '');
      const paintHints = () => {
        hintBox.replaceChildren(...hints.slice(0, s.hints).map((t, i) => h('div', { class: 'hint', html: `<b>Hint ${i + 1}:</b> ${MC.fmt(t)}` })));
        hintBtn.textContent = `💡 Need a hint? (${hints.length - s.hints} left)`;
        hintBtn.style.display = s.hints >= hints.length || finished ? 'none' : '';
      };
      hintBtn.onclick = () => { s.hints++; paintHints(); };
      paintHints();

      const verdict = h('div');
      if (!finished) {
        card.append(h('div', { class: 'tip' }, '✏️ Do it on paper first — then pick your answer.'));
        const row = h('div', { class: 'row' }, checkBtn, hints.length ? hintBtn : null);
        card.append(row, hintBox, verdict);
        const tick = () => { timerEl.textContent = '⏱ ' + fmtTime(Math.floor((Date.now() - s.start) / 1000)); };
        tick(); timer = setInterval(tick, 1000);
        const giveUp = h('button', { class: 'btn ghost small' }, '👀 Show me the solution');
        giveUp.onclick = () => {
          MC.store.set(week, page, q.id, { revealed: 1, attempts: s.wrong.length, hints: s.hints });
          show();
        };
        const reveal = () => { if (s.wrong.length >= 2 && !$('.giveup', row)) { giveUp.classList.add('giveup'); row.append(giveUp); } };
        reveal();

        checkBtn.onclick = () => {
          if (s.picked == null) return;
          if (s.picked === q.answer) {
            const st = stars(q), first = !rec(q).done;
            MC.store.set(week, page, q.id, { done: 1, stars: st, attempts: s.wrong.length + 1, hints: s.hints, time: Math.floor((Date.now() - s.start) / 1000) });
            if (first) MC.store.addXP(st * 10);
            MC.confetti(40 + st * 30);
            show();
          } else {
            const wrongPick = s.picked;
            s.wrong.push(wrongPick); s.picked = null;
            renderCard();
            const v = $('.verdict-slot', card);
            const msg = (q.traps && q.traps[wrongPick]) || 'Not quite. Re-read the question: what exactly is it asking for? Try a hint, or work it again on paper.';
            v.className = 'verdict bad shake'; v.innerHTML = `<b>${'ABCDE'[wrongPick]} isn’t it.</b> ${MC.fmt(msg)}`;
          }
        };
        verdict.className = 'verdict-slot';
      } else {
        const stat = r.done
          ? h('div', { class: 'verdict good' }, h('div', { class: 'stars' }, '⭐'.repeat(r.stars || 1) + '☆'.repeat(3 - (r.stars || 1))),
            `Correct! ${r.attempts > 1 ? `You got it on try ${r.attempts}.` : 'First try!'}${r.hints ? ` (${r.hints} hint${r.hints > 1 ? 's' : ''})` : ''}${r.time ? ` · ⏱ ${fmtTime(r.time)}` : ''}`)
          : h('div', { class: 'verdict bad' }, `The answer is ${'ABCDE'[q.answer]}. Read the solution, then press “Try again” later to earn the stars yourself.`);
        card.append(stat);
        const sol = h('div', { class: 'solution' }, h('h3', {}, 'How to crack it'),
          h('ol', {}, (q.solution || []).map((t) => h('li', { html: MC.fmt(t) }))));
        if (q.idea) sol.append(h('div', { class: 'keyidea', html: '🔑 ' + MC.fmt(q.idea) }));
        if (q.explorer && MC.widgets[q.explorer.type]) {
          const ex = h('div', { class: 'lab', style: { marginTop: '14px' } }, h('div', { class: 'lab-title' }, '🔬 Play with it'));
          MC.widgets[q.explorer.type](ex, q.explorer, { q });
          sol.append(ex);
        }
        card.append(sol);
      }

      // footer
      const list = inGroup(groups[gi]);
      const foot = h('div', { class: 'qfoot' });
      if (finished) {
        foot.append(h('button', { class: 'btn ghost', onclick: () => { MC.store.del(week, page, q.id); delete sess[q.id]; show(); } }, '↺ Try again'));
        const nextI = list.findIndex((x, i) => i > qi && !rec(x).done);
        const nextG = groups.findIndex((x, i) => i > gi && inGroup(x).some((y) => !rec(y).done));
        if (nextI >= 0) foot.append(h('button', { class: 'btn go', onclick: () => { qi = nextI; show(); window.scrollTo({ top: 0, behavior: 'smooth' }); } }, 'Next question →'));
        else if (nextG >= 0) foot.append(h('button', { class: 'btn go', onclick: () => { gi = nextG; qi = firstOpen(groups[gi]); show(); window.scrollTo({ top: 0, behavior: 'smooth' }); } }, `On to ${groups[nextG].label} →`));
        else if (qs.every((x) => rec(x).done || x.optional)) foot.append(h('span', { class: 'win' }, '🏆 Everything done here — amazing work!'));
      }
      card.append(foot);
    }

    show();
  };

  /* ------------------------------------------------------------------- boot */
  function reveal() {
    if (!('IntersectionObserver' in window)) return;
    const items = $$('.rv');
    if (!items.length) return;
    document.documentElement.classList.add('reveal-ready');
    const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    items.forEach((el) => io.observe(el));
  }
  function boot() {
    renderNav();
    paintMeters();
    reveal();
    // one gentle reminder per visit, so a child does not play a whole week signed out by accident
    try {
      if (SESSION.enabled && !USER && !SESSION.dbDown && document.body.dataset.page !== 'login' && !sessionStorage.getItem('mc.nudged')) {
        sessionStorage.setItem('mc.nudged', '1'); setTimeout(() => MC.toast('🔑 Tap “Sign in” so your stars follow you everywhere'), 900);
      }
    } catch (e) { /* storage blocked: skip the reminder */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
