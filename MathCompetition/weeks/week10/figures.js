/* Homework Week 10 (CJMC 2024 B04, B05, C02, C05) — figures and "play with it" explorers (same widgets as the CJMC 2024 unit).
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
