/* CJMC 2024 (Canada Jay) — figures and "play with it" explorers rebuilt as SVG/HTML.
 * Registered in MC.widgets; a question's `figure` shows in the question, its `explorer` appears after solving. */
(function () {
  'use strict';
  const { h, svg } = MC;
  const INK = '#1d2150', MUTED = '#666d96', LINE = '#c8cdf0', GREEN = '#0c7a47', RED = '#b3261e', BLUE = '#2f55d4', ORANGE = '#f2601c';
  const S = (w, hgt, ...kids) => svg('svg', { viewBox: `0 0 ${w} ${hgt}`, style: 'width:100%;max-width:' + Math.min(w * 1.3, 640) + 'px;display:block;margin:6px auto;background:#fff;border:3px solid #e1e4fb;border-radius:14px' }, ...kids);
  const T = (x, y, text, o = {}) => svg('text', Object.assign({ x, y, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, fill: INK, 'font-family': 'Nunito, sans-serif' }, o), text);
  const P = (pts, o = {}) => svg('polygon', Object.assign({ points: pts.map((p) => p.join(',')).join(' '), fill: '#fff', stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }, o));
  const L = (x1, y1, x2, y2, o = {}) => svg('line', Object.assign({ x1, y1, x2, y2, stroke: INK, 'stroke-width': 2, 'stroke-linecap': 'round' }, o));
  const R = (x, y, w, hh, o = {}) => svg('rect', Object.assign({ x, y, width: w, height: hh, fill: '#fff', stroke: INK, 'stroke-width': 2 }, o));
  const C = (cx, cy, r, o = {}) => svg('circle', Object.assign({ cx, cy, r, fill: '#fff', stroke: INK, 'stroke-width': 2 }, o));
  const PATH = (d, o = {}) => svg('path', Object.assign({ d, fill: 'none', stroke: INK, 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, o));

  // a few shared styles for the little labs (the quiz page has no per-unit CSS)
  if (!document.getElementById('c24-style')) {
    document.head.append(h('style', { id: 'c24-style' }, `
      .c24-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:8px 0}
      .c24-chip{font:inherit;font-weight:800;border:3px solid var(--line);background:#fff;border-radius:12px;padding:6px 14px;cursor:pointer;color:var(--navy);min-width:44px}
      .c24-chip.on{border-color:var(--navy-2);background:#e6e9ff}
      .c24-chip:disabled{opacity:.4;cursor:not-allowed}
      .c24-note{background:#f6f5ff;border-radius:12px;padding:10px 14px;margin:8px 0;font-weight:700}
      .c24-note.good{background:#d8f2e4;color:#0c5f3a}.c24-note.warn{background:#fff3d6;color:#7a4b00}.c24-note.bad{background:#ffe4e1;color:#8c1d14}
      .c24-big{font-family:var(--head);font-size:26px;color:var(--navy)}
      .c24-grid td,.c24-grid th{border:2px solid var(--line);padding:5px 9px;text-align:center;font-weight:800}
      .c24-grid{border-collapse:collapse;margin:8px auto}
      .c24-step{display:inline-flex;align-items:center;gap:8px}
      .c24-step button{width:36px;height:36px;border-radius:50%;border:3px solid var(--line);background:#fff;font-size:20px;font-weight:900;cursor:pointer;color:var(--navy)}
      .c24-step b{min-width:28px;text-align:center;font-size:22px}
    `));
  }
  const note = (html, cls = '') => h('div', { class: 'c24-note ' + cls, html });
  const row = (...k) => h('div', { class: 'c24-row' }, ...k);
  const slider = (min, max, step, val, on) => { const i = h('input', { type: 'range', min, max, step, value: val }); i.addEventListener('input', () => on(+i.value)); return i; };
  const catmull = (pts, X, Y) => { // smooth path through normalised points (x,y in 0..1)
    const p = pts.map(([x, y]) => [X(x), Y(y)]); let d = `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i - 1] || p[i], b = p[i], c = p[i + 1], e = p[i + 2] || c;
      d += ` C${(b[0] + (c[0] - a[0]) / 6).toFixed(1)} ${(b[1] + (c[1] - a[1]) / 6).toFixed(1)} ${(c[0] - (e[0] - b[0]) / 6).toFixed(1)} ${(c[1] - (e[1] - b[1]) / 6).toFixed(1)} ${c[0].toFixed(1)} ${c[1].toFixed(1)}`;
    }
    return d;
  };

  /* ---------------------------------------------------------------- A01: count the key presses */
  MC.widgets.keycount = (el) => {
    const groups = [['Numbers 1 to 9', '9 numbers × 1 key', 9], ['Numbers 10 to 99', '90 numbers × 2 keys', 180], ['The number 100', '1 number × 3 keys', 3], ['The commas', '99 commas (one between each pair of numbers)', 99]];
    let shown = 0;
    const body = h('div'), btn = h('button', { class: 'btn small' }, 'Count the next group ▶');
    const draw = () => {
      let run = 0;
      const rows = groups.slice(0, shown).map(([a, b, n]) => { run += n; return h('tr', {}, h('td', {}, a), h('td', {}, b), h('td', {}, '= ' + n), h('td', {}, run)); });
      MC.fill(body, note('Check the idea on Bob’s example, <b>1 to 11</b>: 9 one-digit keys + 2 numbers × 2 keys (10 and 11) = 13, plus <b>10 commas</b> = <b>23</b> ✓ — it works!'),
        shown ? h('table', { class: 'ex-table' }, h('tr', {}, ['Group', 'How many keys', 'Keys', 'Running total'].map((t) => h('th', {}, t))), rows) : null,
        shown === groups.length ? note(`Total: <b>${run}</b> key presses. Notice the commas alone are 99 — one fewer than the 100 numbers.`, 'good') : null);
      btn.disabled = shown === groups.length; btn.textContent = shown === groups.length ? 'All counted ✓' : 'Count the next group ▶';
    };
    btn.onclick = () => { shown++; draw(); };
    el.append(body, row(btn, h('button', { class: 'btn small ghost', onclick: () => { shown = 0; draw(); } }, 'Start over')));
    draw();
  };

  /* ---------------------------------------------------------------- A02: speed graph */
  const SPEED = [[0, 70], [0.5, 80], [1, 80], [1.5, 100], [2, 60], [2.5, 60]]; // hours after 8:00, km/h
  MC.widgets.speed = (el, cfg) => {
    const X = (t) => 70 + t * 140, Y = (v) => 205 - v * 1.7, kids = [];
    for (let v = 20; v <= 100; v += 20) kids.push(L(60, Y(v), 430, Y(v), { stroke: '#e6e8f7', 'stroke-width': 1 }), T(56, Y(v) + 4, v + ' km/h', { 'text-anchor': 'end', 'font-size': 11, fill: MUTED }));
    ['8:00', '8:30', '9:00', '9:30', '10:00', '10:30'].forEach((lab, i) => kids.push(L(X(i / 2), 205, X(i / 2), 210), T(X(i / 2), 226, lab, { 'font-size': 11, fill: MUTED })));
    kids.push(L(60, 205, 440, 205, { 'stroke-width': 2.5 }), L(60, 205, 60, 20, { 'stroke-width': 2.5 }), T(30, 14, 'speed', { 'font-size': 12, fill: MUTED }), T(430, 244, 'time', { 'font-size': 12, fill: MUTED }));
    if (cfg.solved) {
      const t0 = 0.5, t1 = 1.75; // 8:30 … 9:45 (the line comes back down to 80 at 9:45)
      kids.push(L(60, Y(80), 430, Y(80), { stroke: GREEN, 'stroke-dasharray': '6 4', 'stroke-width': 2 }), T(436, Y(80) - 4, '80', { fill: GREEN, 'font-size': 12, 'text-anchor': 'start' }),
        R(X(t0), 192, X(t1) - X(t0), 8, { fill: '#17b26a', stroke: 'none', rx: 3 }), T((X(t0) + X(t1)) / 2, 188, '≥ 80 km/h for 75 min', { fill: GREEN, 'font-size': 12 }),
        R(X(0), 196 + 0, 1, 1, { fill: 'none', stroke: 'none' }));
    }
    kids.push(PATH(SPEED.map(([t, v], i) => (i ? 'L' : 'M') + X(t) + ' ' + Y(v)).join(' '), { stroke: BLUE, 'stroke-width': 3 }));
    SPEED.forEach(([t, v]) => kids.push(C(X(t), Y(v), 4, { fill: BLUE, stroke: '#fff', 'stroke-width': 1.5 })));
    el.append(S(470, 252, ...kids));
    if (cfg.solved) el.append(h('table', { class: 'ex-table' },
      h('tr', {}, h('td', {}, '8:00 → 8:30'), h('td', {}, 'speeds up from 70 to 80'), h('td', {}, 'only just reaches 80 at 8:30')),
      h('tr', {}, h('td', {}, '8:30 → 9:00'), h('td', {}, 'steady 80'), h('td', {}, '30 min ✔')),
      h('tr', {}, h('td', {}, '9:00 → 9:30'), h('td', {}, '80 up to 100'), h('td', {}, '30 min ✔')),
      h('tr', {}, h('td', {}, '9:30 → 10:00'), h('td', {}, '100 down to 60 (40 km/h in 30 min)'), h('td', {}, 'drops 20 in the first 15 min → ✔ until 9:45 (15 min)')),
      h('tr', { class: 'ex-right' }, h('td', {}, h('b', {}, 'Total')), h('td', {}, '75 min at 80 or faster'), h('td', {}, h('b', {}, '75 ÷ 150 = 50 %')))));
  };

  /* ---------------------------------------------------------------- A03: combine the blocks */
  MC.widgets.blocks = (el) => {
    const out = h('div');
    const draw = (b) => {
      const small = 100 - b, ok = small % 3 === 0, big = b + small / 3;
      MC.fill(out,
        h('div', { class: 'c24-big', html: `Start: <b style="color:${BLUE}">${b}</b> big + <b style="color:${ORANGE}">${small}</b> small = 100 blocks` }),
        ok ? h('div', {}, h('p', { html: `Combine all ${small} small blocks, 3 at a time → <b>${small / 3}</b> new big blocks.` }),
          h('div', { class: 'c24-big', html: `Big blocks at the end: ${b} + ${small / 3} = <b>${big}</b>` }),
          big === 40 ? note('🎯 That is exactly 40 — so she started with <b>' + b + '</b> big blocks.', 'good') : note(big < 40 ? 'Too few at the end (we need 40). Start with more big blocks.' : 'Too many at the end (we need 40). Start with fewer big blocks.', 'warn'))
          : note(`${small} small blocks can’t all be combined (it is not a multiple of 3), so the story says this start is impossible.`, 'bad'));
    };
    el.append(h('p', { html: 'Slide the number of <b>big blocks she started with</b>. The rest of the 100 are small ones.' }), slider(0, 100, 1, 50, draw), out);
    draw(50);
  };

  /* ---------------------------------------------------------------- A04: town + pipes */
  const BUILD = [['House', 120, 40], ['House', 260, 40], ['House', 400, 40], ['House', 540, 40], ['Store', 260, 268], ['Store', 400, 268]];
  const UTIL = [['Power', 150, 154, '#e0a100'], ['Water', 330, 154, '#2f55d4'], ['Gas', 520, 154, '#d1440f']];
  const house = (name, x, y, o = {}) => [P([[x - 24, y + 12], [x - 24, y + 34], [x + 24, y + 34], [x + 24, y + 12], [x, y]], Object.assign({ fill: '#fff' }, o)), T(x, y + 28, name, { 'font-size': 12 })];
  const townSVG = (active) => {
    const kids = [];
    UTIL.forEach(([, ux, uy, col], k) => { if (active.includes(k)) BUILD.forEach(([, bx, by]) => kids.push(L(ux, by < 100 ? uy : uy + 34, bx, by < 100 ? by + 34 : by + 12, { stroke: col, 'stroke-width': 2.5, 'stroke-opacity': 0.85 }))); });
    BUILD.forEach(([n, x, y]) => kids.push(...house(n, x, y)));
    UTIL.forEach(([n, x, y, col]) => kids.push(...house(n, x, y, { fill: active.includes(UTIL.findIndex((u) => u[0] === n)) ? col + '33' : '#fff' })));
    return S(660, 320, ...kids);
  };
  MC.widgets.town = (el, cfg) => { el.append(townSVG(cfg.pipes || [])); };
  MC.widgets.pipes = (el) => {
    const active = [], holder = h('div'), msg = h('div'), btns = UTIL.map(([n, , , col], k) => h('button', { class: 'c24-chip', style: { borderColor: col }, onclick: () => { const i = active.indexOf(k); if (i >= 0) active.splice(i, 1); else active.push(k); draw(); } }, '🔧 ' + n));
    const draw = () => {
      btns.forEach((b, k) => b.classList.toggle('on', active.includes(k)));
      MC.fill(holder, townSVG(active));
      const n = active.length * 6;
      MC.fill(msg, note(active.length ? `<b>${active.length}</b> utilit${active.length > 1 ? 'ies' : 'y'} connected × <b>6</b> buildings (4 houses + 2 stores) = <b>${n}</b> pipes` : 'Tap a utility to connect it to every house and store.', n === 18 ? 'good' : ''));
    };
    el.append(row(...btns), holder, msg); draw();
  };

  /* ---------------------------------------------------------------- A05: Aunt Mary's candies */
  MC.widgets.candy = (el) => {
    const out = h('div');
    const draw = (g) => {
      const before = [27 - g, 39 - g, 31 - g], tot = before.reduce((a, b) => a + b, 0);
      MC.fill(out, h('table', { class: 'ex-table' }, h('tr', {}, ['', 'Now', 'Aunt Mary gave', 'Before'].map((t) => h('th', {}, t))),
        ['Ana', 'Brenda', 'Carla'].map((n, i) => h('tr', {}, h('td', {}, n), h('td', {}, [27, 39, 31][i]), h('td', {}, '− ' + g), h('td', {}, before[i]))),
        h('tr', { class: tot === 67 ? 'ex-right' : '' }, h('td', {}, h('b', {}, 'Total')), h('td', {}, '97'), h('td', {}, '− ' + 3 * g), h('td', {}, h('b', {}, tot)))),
        tot === 67 ? note('🎯 Before the gift they had 67 together — that matches! Each got <b>' + g + '</b>.', 'good') : note(`Before the gift they should have 67 together, but this gives ${tot}.`, tot > 67 ? 'warn' : 'bad'),
        note('Shortcut: they now have 27 + 39 + 31 = <b>97</b>. They had <b>67</b>. The gift added <b>30</b> in total, shared by <b>3</b> children → <b>10</b> each.'));
    };
    el.append(h('p', { html: 'Try different gifts. Slide <b>how many candies Aunt Mary gave each child</b>:' }), slider(0, 20, 1, 4, draw), out);
    draw(4);
  };

  /* ---------------------------------------------------------------- B01: factorial last digits */
  MC.widgets.factorials = (el) => {
    const out = h('div');
    const draw = (n) => {
      let f = 1n, run = 0n; const rows = [];
      for (let k = 1; k <= n; k++) { f *= BigInt(k); run += f; rows.push(h('tr', { class: f % 10n === 0n ? 'ex-blank' : '' }, h('td', {}, k + '!'), h('td', {}, f.toString()), h('td', {}, h('b', {}, (f % 10n).toString())), h('td', {}, (run % 10n).toString()))); }
      MC.fill(out, h('table', { class: 'ex-table' }, h('tr', {}, ['n!', 'value', 'last digit', 'last digit of the sum so far'].map((t) => h('th', {}, t))), rows),
        n >= 5 ? note('From <b>5!</b> on, every factorial has both a 2 and a 5 among its factors (2 × 5 = 10) → it ends in <b>0</b>. Adding a number that ends in 0 never changes the last digit.', 'warn') : null,
        n >= 5 ? note('So only <b>1! + 2! + 3! + 4! = 1 + 2 + 6 + 24 = 33</b> matters → last digit <b>3</b>.', 'good') : note('Keep sliding to see what happens from 5! onward →'));
    };
    el.append(h('p', { html: 'Slide <b>n</b> and watch the last digits:' }), slider(1, 10, 1, 4, draw), out);
    draw(4);
  };

  /* ---------------------------------------------------------------- B02: overlap */
  MC.widgets.overlap = (el) => {
    const holder = h('div'), msg = h('div');
    const draw = (x) => {
      const u = 4, total = 105, math = 70, phys = 42, either = math + phys - x, over = Math.max(0, either - total);
      const physStart = math - x;
      MC.fill(holder, S(460, 170,
        R(20, 22, total * u, 28, { fill: 'none', stroke: MUTED, 'stroke-dasharray': '6 4' }), T(20 + (total * u) / 2, 14, 'The school: 105 students', { fill: MUTED, 'font-size': 12 }),
        R(20, 60, math * u, 28, { fill: '#9db4ff' }), T(20 + (math * u) / 2, 79, 'Math club: 70', { 'font-size': 13 }),
        R(20 + physStart * u, 100, phys * u, 28, { fill: '#ffd28a' }), T(20 + (physStart + phys / 2) * u, 119, 'Physics club: 42', { 'font-size': 13 }),
        x ? R(20 + physStart * u, 60, x * u, 68, { fill: '#17b26a', 'fill-opacity': 0.35, stroke: GREEN, 'stroke-dasharray': '4 3' }) : null,
        over ? R(20 + total * u, 100, over * u, 28, { fill: '#ffb3ab', stroke: RED }) : null,
        T(230, 156, x ? `Both clubs: ${x}` : 'No student is in both clubs', { fill: GREEN, 'font-size': 13 })));
      MC.fill(msg, note(`Students in at least one club: 70 + 42 − ${x} = <b>${either}</b>`), over ? note(`That is ${over} more than the school has (105)! The clubs <b>must</b> overlap more.`, 'bad') : x === 7 ? note('🎯 Exactly 105 — the school is completely used. Any smaller overlap would not fit, so the smallest possible overlap is <b>7</b>.', 'good') : note(`Fits (${either} ≤ 105), but it is not the smallest overlap that fits.`, 'warn'));
    };
    el.append(h('p', { html: 'Slide <b>how many students are in both clubs</b>. The two clubs must still fit inside the school of 105.' }), slider(0, 42, 1, 0, draw), holder, msg);
    draw(0);
  };

  /* ---------------------------------------------------------------- B03: two prime dice */
  MC.widgets.dicegrid = (el) => {
    const pr = [2, 3, 5, 7, 11, 13];
    let mode = 'even';
    const holder = h('div'), msg = h('div');
    const draw = () => {
      let even = 0, ee = 0, oo = 0;
      const rows = pr.map((a) => h('tr', {}, h('th', {}, a), pr.map((b) => {
        const sum = a + b, isEven = sum % 2 === 0; if (isEven) { even++; if (a === 2) ee++; else oo++; }
        const hot = mode === 'even' ? isEven : !isEven;
        return h('td', { style: { background: hot ? (mode === 'even' ? '#bfeed3' : '#ffd9d4') : '#fff', color: hot ? INK : '#9aa0c0' } }, sum);
      })));
      MC.fill(holder, h('table', { class: 'c24-grid' }, h('tr', {}, h('th', { html: 'die 1 ↓ &nbsp; die 2 →' }), pr.map((b) => h('th', {}, b))), rows));
      MC.fill(msg, note(mode === 'even' ? `Even sums (green): <b>${even}</b> of 36 cells = <b>[[13/18]]</b> after simplifying.` : `Odd sums (pink): <b>${36 - even}</b> of 36 = [[5/18]]. Even + odd must make 1, so [[13/18]] + [[5/18]] = 1 ✓`, 'good'),
        mode === 'even' ? note(`Why: the sum is even when <b>both</b> numbers are even or <b>both</b> are odd. Only the prime <b>2</b> is even.<br>both even: 1 × 1 = <b>1</b> way · both odd: 5 × 5 = <b>25</b> ways → 26 ways.`) : null);
      msg.querySelectorAll('.c24-note').forEach((n) => { n.innerHTML = MC.fmt(n.innerHTML); });
    };
    el.append(row(...['even', 'odd'].map((m) => h('button', { class: 'c24-chip' + (m === mode ? ' on' : ''), onclick: (e) => { mode = m; [...e.target.parentNode.children].forEach((c) => c.classList.toggle('on', c === e.target)); draw(); } }, m === 'even' ? 'Show EVEN sums' : 'Show ODD sums'))), holder, msg);
    draw();
  };

  /* ---------------------------------------------------------------- B04: runners on a square track */
  const trackXY = (p) => { p = ((p % 800) + 800) % 800; if (p < 200) return [0, p]; if (p < 400) return [p - 200, 200]; if (p < 600) return [200, 200 - (p - 400)]; return [200 - (p - 600), 0]; };
  const squareBase = () => {
    const ox = 90, oy = 50, kids = [R(ox, oy, 200, 200, { fill: '#fbfbff', stroke: INK, 'stroke-width': 3 })];
    [['A', -16, -8], ['B', 16, -8], ['C', 16, 18], ['D', -16, 18]].forEach(([n, dx, dy], i) => kids.push(T(ox + [0, 200, 200, 0][i] + dx, oy + [0, 0, 200, 200][i] + dy, n, { 'font-size': 18 })));
    return { ox, oy, kids };
  };
  MC.widgets.square = (el) => {
    const { ox, oy, kids } = squareBase();
    kids.push(T(ox + 100, oy - 14, '200 m', { fill: MUTED, 'font-size': 13 }), T(ox + 100, oy + 106, 'Joy ↺ (A→D→C→B→A)', { fill: BLUE, 'font-size': 12 }), T(ox + 100, oy + 126, 'Hope ↻ (B→C→D→A→B)', { fill: ORANGE, 'font-size': 12 }));
    kids.push(C(ox, oy, 8, { fill: BLUE }), T(ox + 22, oy + 22, 'Joy', { fill: BLUE, 'font-size': 12 }), C(ox + 200, oy, 8, { fill: ORANGE }), T(ox + 176, oy + 22, 'Hope', { fill: ORANGE, 'font-size': 12 }));
    el.append(S(380, 290, ...kids));
  };
  MC.widgets.runners = (el) => {
    const { ox, oy, kids } = squareBase();
    const joy = C(ox, oy, 9, { fill: BLUE, stroke: '#fff', 'stroke-width': 2 }), hope = C(ox + 200, oy, 9, { fill: ORANGE, stroke: '#fff', 'stroke-width': 2 }), boom = T(ox + 100, oy + 112, '', { 'font-size': 22 });
    const J = T(0, 0, 'J', { fill: '#fff', 'font-size': 10 }), H = T(0, 0, 'H', { fill: '#fff', 'font-size': 10 });
    const svgEl = S(380, 290, ...kids, joy, hope, J, H, boom);
    const out = h('div'), time = h('div', { class: 'c24-big' }), clock = h('span');
    let t = 0, playing = null;
    const set = (v) => {
      t = v; const pj = 75 * t, ph = 600 - 125 * t, [jx, jy] = trackXY(pj), [hx, hy] = trackXY(ph);
      joy.setAttribute('cx', ox + jx); joy.setAttribute('cy', oy + jy); hope.setAttribute('cx', ox + hx); hope.setAttribute('cy', oy + hy);
      J.setAttribute('x', ox + jx); J.setAttribute('y', oy + jy + 3.5); H.setAttribute('x', ox + hx); H.setAttribute('y', oy + hy + 3.5);
      const gap = (((pj - ph) % 800) + 800) % 800, together = gap < 6 || gap > 794, n = t < 3 ? 0 : Math.floor((t - 3) / 4) + 1;
      boom.textContent = together ? '💥 meet!' : '';
      const mm = Math.floor(t), ss = Math.round((t - mm) * 60);
      time.innerHTML = `⏱ <b>9:0${mm}</b>${mm >= 10 ? '' : ''}`.replace('9:010', '9:10');
      MC.fill(out, note(`Time since 9:00: <b>${mm} min ${ss} s</b> · Joy ran <b>${Math.round(pj)} m</b>, Hope ran <b>${Math.round(125 * t)} m</b> · meetings so far: <b>${n}</b>`, together ? 'good' : ''));
    };
    const rng = slider(0, 10, 0.05, 0, (v) => { stop(); set(v); });
    const stop = () => { if (playing) { clearInterval(playing); playing = null; play.textContent = '▶ Play'; } };
    const play = h('button', { class: 'btn small go', onclick: () => { if (playing) return stop(); if (t >= 10) { rng.value = 0; set(0); } play.textContent = '⏸ Pause'; playing = setInterval(() => { if (!el.isConnected || t >= 10) return stop(); rng.value = Math.min(10, t + 0.05); set(+rng.value); }, 50); } }, '▶ Play');
    el.append(row(play, h('button', { class: 'c24-chip', onclick: () => { stop(); rng.value = 3; set(3); } }, 'Jump to 1st meeting'), h('button', { class: 'c24-chip', onclick: () => { stop(); rng.value = 7; set(7); } }, 'Jump to 2nd meeting')), rng, svgEl, out,
      note('<b>The trick:</b> they run <i>towards</i> each other, so every minute they get <b>75 + 125 = 200 m</b> closer. First they must cover the 600 m between them the long way round: 600 ÷ 200 = <b>3 min</b>. After that they only meet again when together they have covered one whole lap (800 m): every <b>4 min</b> → 3 + 4 = <b>7 min</b> → 9:07.'));
    set(0);
  };

  /* ---------------------------------------------------------------- B05: the star blanket */
  const starParts = (hilite) => {
    const Lc = 27, cx = 290, cy = 290, kids = [], edgeKids = [], cols = ['#e6e9ff', '#fff0c9'];
    for (let k = 0; k < 8; k++) {
      const phi = -90 + 45 * k, a1 = ((phi - 22.5) * Math.PI) / 180, a2 = ((phi + 22.5) * Math.PI) / 180;
      const u1 = [Math.cos(a1) * Lc, Math.sin(a1) * Lc], u2 = [Math.cos(a2) * Lc, Math.sin(a2) * Lc];
      const pt = (i, j) => [cx + i * u1[0] + j * u2[0], cy + i * u1[1] + j * u2[1]];
      kids.push(P([pt(0, 0), pt(5, 0), pt(5, 5), pt(0, 5)], { fill: cols[k % 2], stroke: 'none' }));
      for (let i = 0; i <= 5; i++) { kids.push(L(...pt(i, 0), ...pt(i, 5), { 'stroke-width': 1.2, stroke: '#7b82b3' })); kids.push(L(...pt(0, i), ...pt(5, i), { 'stroke-width': 1.2, stroke: '#7b82b3' })); }
      if (hilite) { edgeKids.push(L(...pt(5, 0), ...pt(5, 5), { stroke: RED, 'stroke-width': 4 }), L(...pt(0, 5), ...pt(5, 5), { stroke: RED, 'stroke-width': 4 })); }
      kids.push(P([pt(0, 0), pt(5, 0), pt(5, 5), pt(0, 5)], { fill: 'none', stroke: INK, 'stroke-width': 1.8 }));
    }
    return S(580, 580, ...kids, ...edgeKids);
  };
  MC.widgets.star = (el) => { el.append(starParts(false), h('p', { class: 'muted', style: { textAlign: 'center' }, html: 'A star made of 8 big diamonds — each big diamond is 5 × 5 small rhombi (8 × 25 = 200).' })); };
  MC.widgets.starcount = (el) => {
    const holder = h('div'), steps = h('div'), grid = h('div');
    let on = false;
    const tog = h('button', { class: 'btn small warm', onclick: () => { on = !on; tog.textContent = on ? 'Hide the outside edges' : 'Show the outside edges in red'; MC.fill(holder, starParts(on)); } }, 'Show the outside edges in red');
    MC.fill(holder, starParts(false));
    MC.fill(steps,
      note('<b>Step 1.</b> Each small rhombus has <b>4</b> sides: 200 × 4 = <b>800</b> sides. But a side between two rhombi has been counted <b>twice</b>.'),
      note('<b>Step 2.</b> Only the red edges on the <b>outside</b> belong to just one rhombus: 8 points × 2 sides × 5 small edges = <b>80</b>.'),
      note('<b>Step 3.</b> Inside edges are counted twice, outside edges once → real edges = (800 + 80) ÷ 2 = <b>440</b>.'),
      note('<b>Step 4.</b> 440 × 10 cm = 4400 cm = <b>44 m</b> ✓', 'good'));
    // tiny lab: the same idea on a w × h rectangle of squares
    const out = h('div');
    let w = 3, hh = 2;
    const drawGrid = () => {
      const direct = w * (hh + 1) + hh * (w + 1), sides = 4 * w * hh, outside = 2 * (w + hh), formula = (sides + outside) / 2, u = 26;
      const kids = [];
      for (let i = 0; i <= w; i++) kids.push(L(10 + i * u, 10, 10 + i * u, 10 + hh * u, { stroke: i === 0 || i === w ? RED : '#7b82b3', 'stroke-width': i === 0 || i === w ? 3.5 : 1.5 }));
      for (let j = 0; j <= hh; j++) kids.push(L(10, 10 + j * u, 10 + w * u, 10 + j * u, { stroke: j === 0 || j === hh ? RED : '#7b82b3', 'stroke-width': j === 0 || j === hh ? 3.5 : 1.5 }));
      MC.fill(out, svg('svg', { viewBox: `0 0 ${w * u + 20} ${hh * u + 20}`, style: `width:${Math.min(w * u + 20, 220)}px;display:block;margin:6px auto` }, ...kids),
        note(`<b>${w} × ${hh}</b> grid: sides counted ${w * hh} × 4 = ${sides} · outside edges ${outside}<br>(${sides} + ${outside}) ÷ 2 = <b>${formula}</b> edges · counting the lines directly: <b>${direct}</b> ${formula === direct ? '✓ same!' : '✗'}`));
    };
    const wS = slider(1, 6, 1, 3, (v) => { w = v; drawGrid(); }), hS = slider(1, 6, 1, 2, (v) => { hh = v; drawGrid(); });
    el.append(row(tog), holder, steps, h('div', { class: 'lab-title', style: { marginTop: '14px' } }, '🧪 Test the idea on a small grid'), h('p', { class: 'muted' }, 'Width / height:'), wS, hS, out);
    drawGrid();
  };

  /* ---------------------------------------------------------------- C01: the round-bottom flask */
  const FL = { R: 60, r: 20, cx: 110, base: 215, neck: 55 }; // pixel geometry of the flask
  FL.hj = FL.R + Math.sqrt(FL.R * FL.R - FL.r * FL.r); FL.H = FL.hj + FL.neck;
  FL.V = (hgt) => (hgt <= FL.hj ? (Math.PI * hgt * hgt * (3 * FL.R - hgt)) / 3 : (Math.PI * FL.hj * FL.hj * (3 * FL.R - FL.hj)) / 3 + Math.PI * FL.r * FL.r * (hgt - FL.hj));
  FL.VT = FL.V(FL.H);
  FL.heightAt = (frac) => { let lo = 0, hi = FL.H; for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2; if (FL.V(mid) < frac * FL.VT) lo = mid; else hi = mid; } return (lo + hi) / 2; };
  const flaskOutline = () => {
    const cy = FL.base - FL.R, yj = FL.base - FL.hj, ytop = FL.base - FL.H, a = Math.sqrt(FL.R * FL.R - FL.r * FL.r);
    return `M${FL.cx - FL.r} ${ytop} V${yj} A${FL.R} ${FL.R} 0 1 0 ${FL.cx + FL.r} ${yj} V${ytop}` + (a ? '' : '');
  };
  MC.widgets.flaskshape = (el) => {
    el.append(S(220, 240, PATH(flaskOutline(), { 'stroke-width': 3, fill: '#f4f7ff' }), L(FL.cx - FL.r, FL.base - FL.H, FL.cx + FL.r, FL.base - FL.H, { stroke: '#f4f7ff', 'stroke-width': 4 }), T(FL.cx, 232, 'a round-bottom flask', { 'font-size': 12, fill: MUTED })));
  };
  MC.widgets.flaskfill = (el) => {
    const W = 300, Hh = 240, gx = (f) => 40 + f * 220, gy = (y) => 215 - y * 190; // y is height as a fraction of the flask (0..1)
    const curve = []; for (let i = 0; i <= 120; i++) curve.push([i / 120, FL.heightAt(i / 120) / FL.H]);
    const clipId = 'fl' + Math.random().toString(36).slice(2, 7);
    const water = R(0, 0, 220, 0, { fill: '#59a6ff', 'fill-opacity': 0.75, stroke: 'none', 'clip-path': `url(#${clipId})` }), surf = L(0, 0, 0, 0, { stroke: RED, 'stroke-width': 3 });
    const flask = S(220, 240, svg('defs', {}, svg('clipPath', { id: clipId }, svg('path', { d: flaskOutline() + ' Z' }))), water, PATH(flaskOutline(), { 'stroke-width': 3 }), surf, T(FL.cx, 234, 'the flask', { 'font-size': 12, fill: MUTED }));
    const dot = C(gx(0), gy(0), 7, { fill: ORANGE, stroke: '#fff', 'stroke-width': 2 });
    const graph = S(W, Hh, L(40, 215, 270, 215, { 'stroke-width': 2.5 }), L(40, 215, 40, 18, { 'stroke-width': 2.5 }), T(24, 14, 'height', { 'font-size': 12, fill: MUTED }), T(262, 236, 'time', { 'font-size': 12, fill: MUTED }),
      PATH(catmull(curve, gx, gy), { stroke: BLUE, 'stroke-width': 3 }), dot);
    const out = h('div');
    const set = (f) => {
      const hh = FL.heightAt(f), y = FL.base - hh, w = hh <= FL.hj ? Math.sqrt(2 * FL.R * hh - hh * hh) : FL.r;
      water.setAttribute('x', 0); water.setAttribute('y', y); water.setAttribute('height', FL.base - y + 2); water.setAttribute('width', 220);
      surf.setAttribute('x1', FL.cx - w); surf.setAttribute('x2', FL.cx + w); surf.setAttribute('y1', y); surf.setAttribute('y2', y);
      dot.setAttribute('cx', gx(f)); dot.setAttribute('cy', gy(hh / FL.H));
      const ratio = w / FL.R, label = ratio < 0.5 ? ['rises FAST', 'warn'] : ratio > 0.8 ? ['rises SLOWLY', 'good'] : ['rises at a medium speed', ''];
      const where = hh > FL.hj ? 'in the narrow neck: the same width all the way → a <b>straight</b> line' : hh < FL.R ? 'in the bottom half of the ball: the surface is getting wider' : 'in the top half of the ball: the surface is getting narrower';
      MC.fill(out, note(`Water surface ≈ <b>${Math.round((2 * w / (2 * FL.R)) * 100)} %</b> as wide as the ball → the level <b>${label[0]}</b>.<br><span class="muted">${where}</span>`, label[1]));
    };
    const rng = slider(0, 1, 0.005, 0, (v) => { stop(); set(v); });
    let playing = null;
    const stop = () => { if (playing) { clearInterval(playing); playing = null; play.textContent = '▶ Pour water'; } };
    const play = h('button', { class: 'btn small go', onclick: () => { if (playing) return stop(); if (+rng.value >= 1) { rng.value = 0; set(0); } play.textContent = '⏸ Pause'; playing = setInterval(() => { if (!el.isConnected || +rng.value >= 1) return stop(); rng.value = Math.min(1, +rng.value + 0.005); set(+rng.value); }, 40); } }, '▶ Pour water');
    el.append(row(play), rng, h('div', { class: 'c24-row', style: { alignItems: 'flex-start', justifyContent: 'center' } }, h('div', { style: { flex: '1 1 200px', maxWidth: '260px' } }, flask), h('div', { style: { flex: '1 1 260px', maxWidth: '330px' } }, graph)), out,
      note('Water flows in at a <b>constant rate</b> (the same amount every second), so time is the same as “how much water”. A <b>narrow</b> flask makes the level climb fast (steep graph); a <b>wide</b> one makes it climb slowly (flat graph).'));
    set(0);
  };

  /* ---------------------------------------------------------------- C02: the ring of eight numbers */
  const RING = [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2], [0, 1]]; // c1 m1 c2 m2 c3 m3 c4 m4 (clockwise from top-left)
  const ringSVG = (vals, hot) => {
    const o = 50, g = 80, kids = [R(o, o, 2 * g, 2 * g, { fill: 'none', stroke: MUTED, 'stroke-width': 1.5 })];
    RING.forEach(([cx, cy], i) => { const corner = i % 2 === 0; kids.push(C(o + cx * g, o + cy * g, 19, { fill: vals[i] ? (corner ? '#d8f2e4' : '#fff0c9') : '#fff', stroke: hot ? hot : INK, 'stroke-width': 2.5 }), T(o + cx * g, o + cy * g + 5, vals[i] || '', { 'font-size': 18 })); });
    return S(260, 260, ...kids);
  };
  MC.widgets.ring = (el) => { el.append(ringSVG([], null)); };
  MC.widgets.ringfill = (el) => {
    const chosen = [], holder = h('div'), msg = h('div'), chips = [];
    const perms = (a) => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
    const draw = () => {
      chips.forEach((c, i) => { c.classList.toggle('on', chosen.includes(i + 1)); c.disabled = chosen.length === 4 && !chosen.includes(i + 1); });
      let vals = [], text = '', cls = '';
      if (chosen.length < 4) text = `Pick <b>4 corner numbers</b> (${chosen.length} chosen). Idea: all four sides added = every number once + each corner twice = 36 + (corners).`;
      else {
        const C4 = chosen.reduce((a, b) => a + b, 0), sum = (36 + C4) / 4;
        if (!Number.isInteger(sum)) { text = `Corners add to <b>${C4}</b> → the four sides total 36 + ${C4} = ${36 + C4}, and ${36 + C4} ÷ 4 = ${(36 + C4) / 4} — <b>not a whole number</b>, so these corners can never work.`; cls = 'bad'; }
        else {
          const mids = [1, 2, 3, 4, 5, 6, 7, 8].filter((n) => !chosen.includes(n));
          let found = null;
          for (const p of perms(chosen)) { const m = [0, 1, 2, 3].map((i) => sum - p[i] - p[(i + 1) % 4]); if ([...m].sort().join() === mids.join()) { found = [p, m]; break; } }
          if (found) { const [p, m] = found; vals = [p[0], m[0], p[1], m[1], p[2], m[2], p[3], m[3]]; text = `Corners add to ${C4} → every side adds to (36 + ${C4}) ÷ 4 = <b>${sum}</b>, and it really fits! 🎉`; cls = 'good'; }
          else { text = `Every side would have to add to <b>${sum}</b>, but the four middle numbers this forces are not the four numbers left over — no way to place these corners.`; cls = 'warn'; }
        }
      }
      MC.fill(holder, ringSVG(vals, null)); MC.fill(msg, note(text, cls));
    };
    for (let n = 1; n <= 8; n++) chips.push(h('button', { class: 'c24-chip', onclick: () => { const i = chosen.indexOf(n); if (i >= 0) chosen.splice(i, 1); else if (chosen.length < 4) chosen.push(n); draw(); } }, n));
    el.append(h('p', { html: 'Choose the 4 numbers that go in the <b>corners</b> (green). The 4 middle numbers are then forced!' }), row(...chips, h('button', { class: 'btn small ghost', onclick: () => { chosen.length = 0; draw(); } }, 'Clear')), holder, msg,
      note('<b>Why 16 is impossible:</b> the four sides total 4 × 16 = 64 = 36 + corners, so the corners would need to add to <b>28</b>. But the biggest four numbers add to 8 + 7 + 6 + 5 = 26. Try corners that add to <b>24</b> instead (e.g. 8, 7, 5, 4 or 8, 7, 6, 3): the sides add to (36 + 24) ÷ 4 = <b>15</b>.'));
    draw();
  };

  /* ---------------------------------------------------------------- C03: boxes of juice */
  MC.widgets.boxes = (el) => {
    const sizes = [4, 9, 15], n = [0, 0, 0], out = h('div'), counters = sizes.map((s, i) => { const v = h('b', {}, '0'); return { v, el: h('div', { class: 'c24-step' }, h('span', {}, `Boxes of ${s}:`), h('button', { onclick: () => { n[i] = Math.max(0, n[i] - 1); draw(); } }, '−'), v, h('button', { onclick: () => { n[i]++; draw(); } }, '+')) }; });
    const all = []; for (let a = 0; a <= 12; a++) for (let b = 0; b <= 5; b++) for (let c = 0; c <= 3; c++) if (4 * a + 9 * b + 15 * c === 50) all.push([a, b, c]);
    all.sort((x, y) => x[0] + x[1] + x[2] - (y[0] + y[1] + y[2]));
    let reveal = false;
    const draw = () => {
      counters.forEach((c, i) => { c.v.textContent = n[i]; });
      const tot = 4 * n[0] + 9 * n[1] + 15 * n[2], boxes = n[0] + n[1] + n[2];
      MC.fill(out, h('div', { class: 'c24-big', html: `${n[0]}×4 + ${n[1]}×9 + ${n[2]}×15 = <b style="color:${tot === 50 ? GREEN : tot > 50 ? RED : BLUE}">${tot}</b> bottles in <b>${boxes}</b> boxes` }),
        tot === 50 ? note(`🎯 Exactly 50 with ${boxes} boxes! Can you do it with fewer?`, 'good') : note(tot > 50 ? 'Too many bottles — she wants no leftovers.' : `Need ${50 - tot} more bottles.`, tot > 50 ? 'bad' : ''),
        reveal ? h('table', { class: 'ex-table' }, h('tr', {}, ['Boxes of 4', 'Boxes of 9', 'Boxes of 15', 'Total boxes'].map((t) => h('th', {}, t))), all.map(([a, b, c]) => h('tr', { class: a + b + c === 6 ? 'ex-right' : '' }, h('td', {}, a), h('td', {}, b), h('td', {}, c), h('td', {}, h('b', {}, a + b + c))))) : null,
        reveal ? note('These are <b>all</b> the ways to make exactly 50. The fewest boxes is <b>6</b> (two 4s, three 9s, one 15). Grabbing the biggest boxes first (15 + 15 + five 4s = 7 boxes) is not the best!', 'good') : null);
    };
    el.append(h('p', { html: 'Make <b>exactly 50 bottles</b> using as few boxes as you can:' }), row(...counters.map((c) => c.el)), out,
      row(h('button', { class: 'btn small ghost', onclick: () => { reveal = !reveal; draw(); } }, 'Show / hide every way'), h('button', { class: 'btn small ghost', onclick: () => { n.fill(0); draw(); } }, 'Reset')));
    draw();
  };

  /* ---------------------------------------------------------------- C04: the forest */
  MC.widgets.forest = (el, cfg) => {
    const s = 300, x0 = 60, y0 = 36, yB = y0 + s, kids = [];
    const A = [x0, yB], B = [x0 + s, yB], D = [x0, y0], Cn = [x0 + s, y0], G = [x0, yB - s / 5], E = [x0 + s / 2, yB], F = [x0 + s, yB - (2 * s) / 3];
    const defs = svg('defs', {}, svg('pattern', { id: 'c24-star', width: 14, height: 14, patternUnits: 'userSpaceOnUse' }, svg('text', { x: 7, y: 11, 'text-anchor': 'middle', 'font-size': 11, fill: '#19b34a' }, '✱')),
      svg('pattern', { id: 'c24-brick', width: 16, height: 10, patternUnits: 'userSpaceOnUse' }, svg('rect', { width: 16, height: 10, fill: '#fff4e6' }), svg('path', { d: 'M0 0H16M0 5H16M8 0V5M0 5V10M16 5V10', stroke: '#e6934a', 'stroke-width': 1, fill: 'none' })));
    kids.push(defs, R(x0, y0, s, s, { fill: 'url(#c24-star)', stroke: INK, 'stroke-width': 2.5 }), P([A, G, E], { fill: 'url(#c24-brick)', stroke: INK }), P([E, B, F], { fill: '#9aa0ff', stroke: INK }));
    kids.push(T(D[0] - 6, D[1] - 6, 'Dove', { 'text-anchor': 'start', 'font-size': 13 }), T(Cn[0] + 6, Cn[1] - 6, 'Crane', { 'text-anchor': 'end', 'font-size': 13 }), T(A[0] - 6, A[1] + 16, 'Albatross', { 'text-anchor': 'start', 'font-size': 13 }), T(B[0] + 6, B[1] + 16, 'Bobwhite', { 'text-anchor': 'end', 'font-size': 13 }),
      T(G[0] - 8, G[1] + 4, 'Grebe', { 'text-anchor': 'end', 'font-size': 13 }), T(E[0], E[1] + 16, 'Eagle', { 'font-size': 13 }), T(F[0] + 8, F[1] + 4, 'Finch', { 'text-anchor': 'start', 'font-size': 13 }),
      T(x0 + 70, yB - 10, 'no conifers', { 'font-size': 11, fill: '#a35a14' }), T(x0 + 238, yB - 44, 'only Sitka fir', { 'font-size': 11, fill: '#232a9c' }));
    if (cfg.solved) {
      const lab = (x, y, t, anchor = 'middle') => T(x, y, t, { fill: INK, 'font-size': 15, 'text-anchor': anchor, stroke: '#fff', 'stroke-width': 4, 'paint-order': 'stroke' });
      kids.push(lab(x0 + s / 4, yB + 34, '½'), lab(x0 + (3 * s) / 4, yB + 34, '½'), lab(x0 + 8, (G[1] + yB) / 2 + 5, '⅕', 'start'), lab(x0 + 8, (D[1] + G[1]) / 2, '⅘', 'start'), lab(x0 + s - 8, (F[1] + yB) / 2 + 5, '⅔', 'end'), lab(x0 + s - 8, (Cn[1] + F[1]) / 2, '⅓', 'end'));
    }
    el.append(S(480, 400, ...kids));
    if (cfg.solved) el.append(h('table', { class: 'ex-table' },
      h('tr', {}, h('td', {}, '🧱 no-conifer triangle'), h('td', {}, '½ × ½ × ⅕ of the big square'), h('td', {}, '= [[1/20]] of 6000 = 300')),
      h('tr', {}, h('td', {}, '🔵 only-Sitka triangle'), h('td', {}, '½ × ½ × ⅔ of the big square'), h('td', {}, '= [[1/6]] of 6000 = 1000')),
      h('tr', { class: 'ex-right' }, h('td', {}, '⭐ green stars'), h('td', {}, '6000 − 300 − 1000'), h('td', {}, h('b', {}, '4700 km²')))));
    el.querySelectorAll('td').forEach((td) => { td.innerHTML = MC.fmt(td.innerHTML); });
  };

  /* ---------------------------------------------------------------- C05: exciting numbers */
  MC.widgets.exciting = (el) => {
    const digits = [4, 5, 6, 7, 8, 9], picked = [], found = new Set(), out = h('div'), chipRow = row();
    const clues = [
      'The first 5 digits are divisible by 5, so they must end in 0 or 5. We only have 4–9, so the <b>5th digit is 5</b>.',
      'The first 2 digits must be divisible by 2 → the 2nd digit is even. Likewise the 4th (divisible by 4) and 6th (divisible by 6) digits must be even. The even digits are 4, 6, 8 — exactly 3 — so they fill the <b>2nd, 4th and 6th places</b>. The 1st and 3rd digits are the odd ones left: <b>7 and 9</b> (in some order).',
      'The first 3 digits must have a digit-sum divisible by 3: 7 + 9 + (2nd digit) = 16 + ?. Only <b>8</b> works (16 + 8 = 24) — so the <b>2nd digit is 8</b>.',
      'The first 4 digits must be divisible by 4 → look at the last two of them (3rd and 4th digit): <b>76</b> ✓ or <b>96</b> ✓ work, but 74 and 94 do not. So the <b>4th digit is 6</b> and the <b>6th digit is 4</b>.',
      'That leaves exactly two numbers: <b>789654</b> and <b>987654</b>. 987654 is the example in the question, so there is <b>1</b> more.',
    ];
    let clueN = 0; const clueBox = h('div');
    const draw = () => {
      chips.forEach((c, i) => { c.disabled = picked.includes(digits[i]) || picked.length === 6; });
      const lines = [];
      for (let n = 1; n <= picked.length; n++) { const v = +picked.slice(0, n).join(''); lines.push(h('tr', { class: v % n === 0 ? 'ex-right' : 'ex-wrong' }, h('td', {}, `first ${n} digit${n > 1 ? 's' : ''}`), h('td', {}, v), h('td', {}, `÷ ${n}`), h('td', {}, v % n === 0 ? '✔ divisible' : '✘ not divisible'))); }
      const bad = lines.some((r) => r.className === 'ex-wrong'), done = picked.length === 6 && !bad, num = picked.join('');
      if (done) found.add(num);
      MC.fill(out, h('div', { class: 'c24-big', style: { letterSpacing: '4px', margin: '6px 0' } }, picked.join(' ') || '·  ·  ·  ·  ·  ·'), lines.length ? h('table', { class: 'ex-table' }, lines) : null,
        bad ? note('One of the checks fails — press <b>Undo</b> and try another digit.', 'bad') : null,
        done ? note(`🎉 <b>${num}</b> is exciting!${num === '987654' ? ' (That’s the example from the question.)' : ''}`, 'good') : null,
        found.size ? note('Exciting numbers you have found: <b>' + [...found].join(', ') + '</b>' + (found.size === 2 ? ' — that is all of them! Not counting 987654, that leaves <b>1</b>.' : '')) : null);
    };
    const chips = digits.map((d) => h('button', { class: 'c24-chip', onclick: () => { picked.push(d); draw(); } }, d));
    chipRow.append(...chips, h('button', { class: 'btn small ghost', onclick: () => { picked.pop(); draw(); } }, '↶ Undo'), h('button', { class: 'btn small ghost', onclick: () => { picked.length = 0; draw(); } }, 'Clear'));
    const clueBtn = h('button', { class: 'btn small warm', onclick: () => { if (clueN < clues.length) clueN++; MC.fill(clueBox, clues.slice(0, clueN).map((c, i) => note(`<b>Clue ${i + 1}.</b> ` + c))); clueBtn.textContent = clueN < clues.length ? 'Another clue ▶' : 'No more clues'; clueBtn.disabled = clueN === clues.length; } }, 'Give me a clue ▶');
    el.append(h('p', { html: 'Build a 6-digit number one digit at a time. Every time you add a digit, the first <i>n</i> digits must divide by <i>n</i>.' }), chipRow, out, row(clueBtn), clueBox);
    draw();
  };
})();
