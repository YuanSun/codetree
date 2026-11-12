/* CJMC 2021 (Gray Jay) — figures rebuilt as SVG/HTML. Registered in MC.widgets; `figure` shows in the question, `explorer` after solving. */
(function () {
  'use strict';
  const { h, svg } = MC;
  const INK = '#1d2150', MUTED = '#666d96', LINE = '#c8cdf0';
  const S = (w, hgt, ...kids) => svg('svg', { viewBox: `0 0 ${w} ${hgt}`, style: 'width:100%;max-width:' + Math.min(w * 1.3, 640) + 'px;display:block;margin:6px auto;background:#fff;border:3px solid #e1e4fb;border-radius:14px' }, ...kids);
  const T = (x, y, text, o = {}) => svg('text', Object.assign({ x, y, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, fill: INK, 'font-family': 'Nunito, sans-serif' }, o), text);
  const P = (pts, o = {}) => svg('polygon', Object.assign({ points: pts.map((p) => p.join(',')).join(' '), fill: '#fff', stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }, o));
  const L = (x1, y1, x2, y2, o = {}) => svg('line', Object.assign({ x1, y1, x2, y2, stroke: INK, 'stroke-width': 2, 'stroke-linecap': 'round' }, o));
  const R = (x, y, w, hh, o = {}) => svg('rect', Object.assign({ x, y, width: w, height: hh, fill: '#fff', stroke: INK, 'stroke-width': 2 }, o));
  const C = (cx, cy, r, o = {}) => svg('circle', Object.assign({ cx, cy, r, fill: '#fff', stroke: INK, 'stroke-width': 2 }, o));
  const wrap = (el, node) => el.append(node);

  /* ---- Q3: bar chart with negative values ---- */
  MC.widgets.bars = (el, cfg) => {
    const W = 420, H = 300, x0 = 60, y0 = 20, y1 = H - 40, min = -8, max = 12, Y = (v) => y0 + ((max - v) / (max - min)) * (y1 - y0), bw = 44, gap = (W - x0 - 20 - bw * cfg.values.length) / cfg.values.length;
    const kids = [];
    for (let v = min; v <= max; v += 2) { kids.push(L(x0, Y(v), W - 10, Y(v), { stroke: v === 0 ? INK : LINE, 'stroke-width': v === 0 ? 2.5 : 1 })); kids.push(T(x0 - 8, Y(v) + 5, v, { 'text-anchor': 'end', fill: MUTED, 'font-size': 12 })); }
    kids.push(T(16, (y0 + y1) / 2, cfg.title || 'Water level (mm)', { transform: `rotate(-90 16 ${(y0 + y1) / 2})`, fill: MUTED, 'font-size': 13 }));
    cfg.values.forEach((v, i) => {
      const x = x0 + gap / 2 + i * (bw + gap);
      kids.push(R(x, Math.min(Y(v), Y(0)), bw, Math.abs(Y(v) - Y(0)), { fill: '#b9bfd6', 'stroke-width': 2.5 }));
      kids.push(T(x + bw / 2, v >= 0 ? Y(0) + 18 : Y(0) - 8, cfg.labels[i], { 'font-size': 12 }));
    });
    wrap(el, S(W, H, ...kids));
  };

  /* ---- Q5: the fold-and-cut sequence ---- */
  const arrow = (d) => svg('path', { d, fill: 'none', stroke: INK, 'stroke-width': 2.5, 'marker-end': 'url(#ah)' });
  MC.widgets.folds = (el) => {
    const defs = svg('defs', {}, svg('marker', { id: 'ah', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto' }, svg('path', { d: 'M0 0L10 5L0 10z', fill: INK })));
    const dash = { 'stroke-dasharray': '5 4', 'stroke-width': 1.5 };
    wrap(el, S(640, 210, defs,
      T(60, 16, '1. fold top down', { 'font-size': 12 }), R(30, 28, 60, 120), L(30, 88, 90, 88, dash), arrow('M52 70 Q44 90 56 112'),
      T(160, 96, '⇒', { 'font-size': 26 }),
      T(260, 16, '2. fold left over', { 'font-size': 12 }), R(220, 58, 60, 60), L(250, 58, 250, 118, dash), arrow('M232 80 Q252 66 272 80'),
      T(340, 96, '⇒', { 'font-size': 26 }),
      T(430, 16, '3. fold top down', { 'font-size': 12 }), R(410, 58, 30, 60), L(410, 88, 440, 88, dash), arrow('M422 74 Q418 88 424 102'),
      T(500, 96, '⇒', { 'font-size': 26 }),
      T(580, 16, '4. cut the corner', { 'font-size': 12 }), R(560, 58, 30, 30), P([[560, 88], [575, 88], [560, 73]], { fill: '#8b90a8' }),
      T(320, 190, 'Open the paper again: what does it look like?', { 'font-size': 14, fill: MUTED })));
  };

  /* ---- Q8: the dissected square (9 x 9 units) ---- */
  const SQ = [[0, 0, 5, 'w'], [5, 0, 4, 'd'], [0, 5, 4, 'd'], [4, 5, 2, 'l'], [4, 7, 2, 'l'], [7, 4, 2, 'l'], [6, 6, 3, 'w'], [5, 4, 1, 'w'], [6, 4, 1, 'w'], [6, 5, 1, 'w']];
  MC.widgets.squares = (el, cfg) => {
    const u = 30, ox = 40, oy = 34, fill = { w: '#fff', d: '#9aa0b8', l: '#dde0ee' };
    const kids = SQ.map(([x, y, s, k]) => R(ox + x * u, oy + y * u, s * u, s * u, { fill: fill[k] }));
    kids.push(T(ox + 2.5 * u, 22, '5'), T(ox + 7 * u, 22, '4'), T(ox + 2 * u, oy + 9 * u + 20, '4'), T(ox + 5 * u, oy + 9 * u + 20, '2'), T(ox + 7.5 * u, oy + 9 * u + 20, '3'),
      T(ox + 9 * u + 16, oy + 5 * u + 5, '2'), T(ox + 6.5 * u + 11, oy + 5.65 * u, '1', { 'font-size': 12 }));
    if (cfg && cfg.count) SQ.forEach(([x, y, s]) => { if (s === 2) kids.push(T(ox + (x + 1) * u, oy + (y + 1) * u + 5, '2×2', { 'font-size': 12, fill: '#b3261e' })); });
    wrap(el, S(340, 340, ...kids));
  };

  /* ---- Q10: nine identical isosceles triangles around one vertex (three fans of 20°, 20°, 80°) ---- */
  MC.widgets.fan = (el) => {
    const rad = (d) => (d * Math.PI) / 180, u = (a, len) => [Math.cos(rad(a)) * len, -Math.sin(rad(a)) * len], leg = 130, base = 2 * leg * Math.sin(rad(10));
    const cx = 200, cy = 190, pt = ([x, y]) => [cx + x, cy + y], kids = [];
    for (let f = 0; f < 3; f++) {
      const a0 = 90 + f * 120;
      kids.push(P([[cx, cy], pt(u(a0, leg)), pt(u(a0 + 20, leg))], { fill: '#e6e9ff' }), P([[cx, cy], pt(u(a0 + 20, leg)), pt(u(a0 + 40, leg))], { fill: '#d8f2e4' }),
        P([[cx, cy], pt(u(a0 + 40, leg)), pt(u(a0 + 120, base))], { fill: '#fff0c9' }));
    }
    kids.push(C(cx, cy, 3.5, { fill: INK }), T(200, 380, 'Not drawn to scale — an aid only', { 'font-size': 12, fill: MUTED }));
    wrap(el, S(400, 390, ...kids));
  };

  /* ---- Q11: the vending machine ---- */
  MC.widgets.vending = (el) => {
    el.append(h('table', { class: 'ex-table' },
      h('tr', {}, ['🥪 Sandwich', 'At the start', 'Price each'].map((t) => h('th', {}, t))),
      h('tr', {}, h('td', {}, 'Chicken'), h('td', {}, '13'), h('td', {}, '$3')),
      h('tr', {}, h('td', {}, 'Cheese'), h('td', {}, '14'), h('td', {}, '$3')),
      h('tr', {}, h('td', {}, 'Egg'), h('td', {}, '15'), h('td', {}, '$2.50')),
      h('tr', {}, h('td', {}, h('b', {}, 'Total')), h('td', {}, h('b', {}, '42')), h('td', {}, ''))));
  };
  MC.widgets.vendcombos = (el) => {
    const rows = [];
    for (let c = 0; c <= 13; c++) for (let e = 0; e <= 15; e++) if (3 * c + 2.5 * e === 40) rows.push([c, e]);
    el.append(h('p', { html: '<b>Chicken + egg sales must be $40</b> ($61 − $21 for cheese). Cheese sold = $21 ÷ $3 = 7, so 7 cheese are left. All the ways:' }),
      h('table', { class: 'ex-table' }, h('tr', {}, ['Chicken sold', 'Egg sold', 'Sandwiches left in total'].map((t) => h('th', {}, t))),
        rows.map(([c, e]) => h('tr', {}, h('td', {}, c), h('td', {}, e), h('td', {}, 42 - 7 - c - e)))),
      h('p', { html: `Two combinations fit, and they leave <b>${rows.map(([c, e]) => 35 - c - e).join(' and ')}</b> sandwiches — so “the number of remaining sandwiches” settles it.` }));
  };

  /* ---- Q13: right triangle with points on its sides ---- */
  MC.widgets.tri13 = (el) => {
    const s = 20, Cc = [40, 260], A = [Cc[0] + 9 * s, Cc[1]], B = [Cc[0], Cc[1] - 12 * s], pAB = (k) => [A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k];
    const D = [A[0] - 3 * s, Cc[1]], E = [A[0] - 6 * s, Cc[1]], Fp = pAB(1 / 3), G = pAB(2 / 3);
    wrap(el, S(300, 290, P([A, B, Cc], { fill: '#fff' }), P([D, Fp, G, E], { fill: '#d8f2e4', 'stroke-width': 2.5 }), L(Cc[0], Cc[1] - 14, Cc[0] + 14, Cc[1] - 14), L(Cc[0] + 14, Cc[1] - 14, Cc[0] + 14, Cc[1]),
      T(A[0] + 14, A[1] + 4, 'A'), T(B[0] - 4, B[1] - 8, 'B'), T(Cc[0] - 12, Cc[1] + 4, 'C'), T(D[0], D[1] + 18, 'D'), T(E[0], E[1] + 18, 'E'), T(Fp[0] + 12, Fp[1], 'F'), T(G[0] + 12, G[1], 'G'),
      T((A[0] + Cc[0]) / 2 + 30, Cc[1] + 36, '9 cm', { fill: MUTED }), T(Cc[0] - 26, (B[1] + Cc[1]) / 2, '12 cm', { fill: MUTED })));
  };

  /* ---- Q14: the unrolled trunk — where do the two creepers cross? ---- */
  MC.widgets.creep = (el) => {
    const W = 360, H = 300, x0 = 30, y0 = 20, w = W - 60, hh = H - 50, X = (a) => x0 + a * w, Y = (t) => y0 + (1 - t) * hh, kids = [R(x0, y0, w, hh, { fill: '#fbf7ee', 'stroke-width': 2 })];
    const segs = (list, color) => list.forEach(([a, t, b, s]) => kids.push(L(X(a), Y(t), X(b), Y(s), { stroke: color, 'stroke-width': 3 })));
    segs([0, 1, 2, 3, 4].map((i) => [0, i / 5, 1, (i + 1) / 5]), '#17b26a');          // golden hop: 5 turns clockwise
    segs([0, 1, 2].map((j) => [1, j / 3, 0, (j + 1) / 3]), '#ef6f9a');                // tea rose: 3 turns the other way
    let n = 0;
    for (let k = 1; k <= 7; k++) { const t = k / 8, a = ((5 * t) % 1 + 1) % 1; n++; kids.push(C(X(a), Y(t), 8, { fill: '#ffc83d' }), T(X(a), Y(t) + 4, k, { 'font-size': 11 })); }
    kids.push(T(W / 2, H - 8, 'trunk cut open and laid flat (left edge = right edge)', { 'font-size': 12, fill: MUTED }), T(14, y0 + 14, '🌿', { 'font-size': 14 }));
    el.append(h('p', { html: '<b>Unroll the trunk.</b> The green creeper makes 5 diagonal runs, the pink one 3 runs the other way. They meet when their turns add up to a whole number: 5 + 3 = 8 meetings from ground to branch — but the first is the ground and the last is the branch.' }),
      S(W, H, ...kids), h('p', { html: `Dots in between the ground and the branch: <b>${n}</b>.` }));
  };

  /* ---- Q15: the hexagon puzzle ---- */
  const HEX = {
    white: { 0: [0, 1, 2, 3], 1: [0, 2, 3], 2: [0, 1, 2, 3], 3: [-2, -1, 0, 1, 2, 3], 4: [-2, 2, 3, 4], 5: [-3, -2, 1, 2, 3, 4], 6: [-3, -2, 2, 3, 4], 7: [-3, -2, -1, 3], 8: [-3, -2, -1, 0], 9: [-3, -2, -1, 0, 1], 10: [-3, -2, -1, 0] },
    shaded: { 1: [-1, 1], 2: [-3, -2, -1], 4: [-1, 0, 1], 5: [-1, 0], 6: [-1, 0, 1], 7: [0, 1, 2, 4], 8: [1, 2, 3, 4], 9: [3, 4], 10: [3, 4], 11: [3, 4] },
    blue: [6, 2, 2, 3, 2, 5, 7, 3], green: [0, 0, 5, 5, 3, 2, 2, 3, 3, 3, 4], products: [0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1],
  };
  const hexGrid = (el, solved) => {
    const X0 = 410, Y0 = 215, DX = 70, DY = 60.6, Rr = 38, cx = (r, j) => X0 + 35 * r + DX * j, cy = (r) => Y0 + DY * r;
    const hexPts = (x, y) => Array.from({ length: 6 }, (_, k) => [x + Rr * Math.cos(((30 + 60 * k) * Math.PI) / 180), y + Rr * Math.sin(((30 + 60 * k) * Math.PI) / 180)]);
    const kids = [], lines = [], ones = new Set((solved || []).map(([r, j]) => r + ',' + j));
    HEX.blue.forEach((sum, i) => { const j = i - 3; lines.push(L(cx(-0.9, j), cy(-0.9), cx(11, j), cy(11), { stroke: '#3b6cf0', 'stroke-width': 2, 'stroke-opacity': 0.45 })); kids.push(T(cx(-1.6, j), cy(-1.6) + 6, sum, { fill: '#1d4ed8', 'font-size': 24 })); });
    HEX.green.forEach((sum, g) => { lines.push(L(X0 + 70 * g + 35 * 2.4, cy(-2.4), X0 + 70 * g - 35 * 11, cy(11), { stroke: '#17b26a', 'stroke-width': 2, 'stroke-opacity': 0.45 })); kids.push(T(X0 + 70 * g + 35 * 2.9, cy(-2.9) + 6, sum, { fill: '#0c7a47', 'font-size': 24 })); });
    Object.entries(HEX.shaded).forEach(([r, js]) => js.forEach((j) => kids.push(P(hexPts(cx(+r, j), cy(+r)), { fill: '#4a3f8f', stroke: '#2b2460', 'stroke-width': 2 }))));
    Object.entries(HEX.white).forEach(([r, js]) => js.forEach((j) => {
      kids.push(P(hexPts(cx(+r, j), cy(+r)), { fill: '#fff', stroke: INK, 'stroke-width': 2.5 }));
      if (solved) kids.push(T(cx(+r, j), cy(+r) + 8, ones.has(r + ',' + j) ? '1' : '0', { 'font-size': 24, fill: ones.has(r + ',' + j) ? '#0c7a47' : '#b3261e' }));
    }));
    // row products sit just left of each row's first hexagon (white or shaded), joined by a dashed line
    HEX.products.forEach((pr, r) => {
      const js = [...(HEX.white[r] || []), ...(HEX.shaded[r] || [])], left = cx(r, Math.min(...js)) - 44;
      kids.push(L(left - 150, cy(r), left, cy(r), { stroke: '#b3261e', 'stroke-dasharray': '6 5', 'stroke-width': 1.5 }), T(left - 168, cy(r) + 8, pr, { fill: '#b3261e', 'font-size': 26, 'font-style': 'italic', 'text-anchor': 'end' }));
    });
    el.append(S(1250, 925, ...kids, ...lines),
      h('p', { class: 'muted', html: '<b style="color:#1d4ed8">Blue</b> numbers: sum along each ↘ diagonal · <b style="color:#0c7a47">green</b> numbers: sum along each ↗ diagonal · <b style="color:#b3261e">red</b>: product of each row. Dark hexagons are only decoration.' }));
  };
  MC.widgets.hexpuzzle = (el) => hexGrid(el, null);
  MC.widgets.hexsolved = (el, cfg) => { el.append(h('p', { html: 'The one and only way to fill the white hexagons (green 1, red 0). The product of a row is 1 only if the whole row is 1s:' })); hexGrid(el, cfg.ones); };
})();
