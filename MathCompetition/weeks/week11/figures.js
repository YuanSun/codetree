/* Week 11 — Views & Surface Area.
 * A tiny 3D toolkit (isometric cubes, flat views, boxes) + the labs / figures used by BOTH the lesson and the practice quiz.
 * Conventions (same as the slides): a "stack plan" lists heights row by row, BACK row first, LEFT column first.
 *   FRONT view = tallest stack of each column, left to right.   RIGHT view = tallest stack of each row, FRONT row on the left. */
(function () {
  'use strict';
  const { h, svg } = MC;
  const INK = '#1d2150', MUTED = '#666d96', LINE = '#c8cdf0', GREEN = '#0c7a47', RED = '#b3261e', GOLD = '#f2b84b';
  const PAL = { top: '#eef2fb', left: '#c8d5f0', right: '#98aedb' };         // lightest = top, light = front (left face), dark = right face
  const HI = { top: '#fff6d6', left: '#ffe08a', right: '#f2b84b' };            // highlighted cubes
  const WAT = { top: '#cdeaff', left: '#86c4f7', right: '#56a3e6' };           // water
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const T = (x, y, text, o = {}) => svg('text', Object.assign({ x, y, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, fill: INK, 'font-family': 'Nunito, sans-serif' }, o), text);
  const R = (x, y, w, hh, o = {}) => svg('rect', Object.assign({ x, y, width: w, height: hh, fill: '#fff', stroke: INK, 'stroke-width': 2 }, o));
  const L = (x1, y1, x2, y2, o = {}) => svg('line', Object.assign({ x1, y1, x2, y2, stroke: INK, 'stroke-width': 2, 'stroke-linecap': 'round' }, o));
  const POLY = (pts, o = {}) => svg('polygon', Object.assign({ points: pts.map((p) => p.map((n) => +n.toFixed(2)).join(',')).join(' '), fill: '#fff', stroke: INK, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }, o));
  const note = (html, cls = '') => h('div', { class: 'w11-note ' + cls, html: MC.fmt(html) });
  const row = (...k) => h('div', { class: 'w11-row' }, ...k);
  const chip = (text, on, fn, extra) => h('button', Object.assign({ class: 'w11-chip' + (on ? ' on' : ''), onclick: fn }, extra || {}), text);

  if (!document.getElementById('w11-style')) {
    document.head.append(h('style', { id: 'w11-style' }, `
      .w11{margin:6px 0}
      .w11-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:8px 0}
      .w11-split{display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start;justify-content:center;margin:8px 0}
      .w11-split>*{flex:0 1 auto;min-width:0}
      .w11-chip{font:inherit;font-weight:800;border:3px solid var(--line);background:#fff;border-radius:12px;padding:6px 14px;cursor:pointer;color:var(--navy);min-width:44px}
      .w11-chip.on{border-color:var(--navy-2);background:#e6e9ff}
      .w11-chip:disabled{opacity:.4;cursor:not-allowed}
      .w11-note{background:#f6f5ff;border-radius:12px;padding:10px 14px;margin:8px 0;font-weight:700;line-height:1.45}
      .w11-note.good{background:#d8f2e4;color:#0c5f3a}.w11-note.warn{background:#fff3d6;color:#7a4b00}.w11-note.bad{background:#ffe4e1;color:#8c1d14}
      .w11-big{font-family:var(--head);font-size:24px;color:var(--navy)}
      .w11-lbl{font-weight:800;color:var(--navy);font-size:13px;text-align:center}
      .w11-sub{font-weight:700;color:#666d96;font-size:12px;text-align:center}
      .w11-plan{display:grid;grid-template-columns:auto auto auto;gap:2px 6px;align-items:center;justify-items:center}
      .w11-plan table{border-collapse:collapse}
      .w11-plan td{border:2px solid var(--navy);width:44px;height:44px;text-align:center;font-weight:900;font-size:20px;color:var(--navy);background:#fff;padding:0}
      .w11-plan td.edit{width:62px;height:56px}
      .w11-plan .side{font-weight:800;font-size:11px;color:#666d96;writing-mode:vertical-rl}
      .w11-plan .top,.w11-plan .bot{grid-column:2;font-weight:800;font-size:11px;color:#666d96;letter-spacing:.06em}
      .w11-cellbtns{display:flex;align-items:center;justify-content:center;gap:2px}
      .w11-cellbtns button{width:20px;height:20px;border-radius:50%;border:2px solid var(--line);background:#fff;font-weight:900;font-size:13px;line-height:1;padding:0;cursor:pointer;color:var(--navy)}
      .w11-cellbtns button:disabled{opacity:.3;cursor:not-allowed}
      .w11-cellbtns b{min-width:16px;font-size:20px}
      .w11-grid td,.w11-grid th{border:2px solid var(--line);padding:5px 9px;text-align:center;font-weight:800}
      .w11-grid{border-collapse:collapse;margin:8px auto}
      .w11-slider{display:grid;grid-template-columns:130px 1fr 80px;gap:10px;align-items:center;margin:6px 0;font-weight:800;color:var(--navy)}
      .w11-slider input{width:100%}
      .w11-slider b{text-align:left}
      .w11-pairs{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}
      .w11-pairs span{border-radius:10px;padding:6px 10px;font-weight:800;font-size:14px;border:2px solid var(--navy);background:#fff}
      .w11-vdraw{display:inline-block;touch-action:manipulation;cursor:pointer;user-select:none}
      .w11-seq{font-family:var(--head);font-size:22px;color:var(--navy);margin:6px 0}
      @media (max-width:560px){.w11-slider{grid-template-columns:96px 1fr 64px}}
    `));
  }

  const slider = (label, min, max, step, val, onInput, fmt) => {
    const out = h('b', {}), inp = h('input', { type: 'range', min, max, step, value: val });
    const sync = () => { out.textContent = fmt ? fmt(+inp.value) : String(inp.value); };
    inp.addEventListener('input', () => { sync(); onInput(+inp.value); }); sync();
    return { row: h('label', { class: 'w11-slider' }, h('span', {}, label), inp, out), inp, sync };
  };

  /* =============================================================== 3D toolkit */
  const CS = Math.cos(Math.PI / 6), SN = 0.5;
  const proj = (u, a, b, z) => [(b - a) * CS * u, (a + b) * SN * u - z * u];     // a = toward the viewer's LEFT-front, b = toward the right
  const planVox = (plan) => { const v = []; plan.forEach((r, a) => r.forEach((n, b) => { for (let z = 0; z < n; z++) v.push([a, b, z]); })); return v; };
  const frontView = (plan) => plan[0].map((_, c) => Math.max(...plan.map((r) => r[c])));
  const rightView = (plan) => plan.map((r) => Math.max(...r)).reverse();         // front row first (= on the left)
  const total = (plan) => sum(plan.map(sum));
  const zeros = (r, c) => Array.from({ length: r }, () => Array(c).fill(0));

  /** Isometric picture of unit cubes: voxels = [[a,b,z],…]. o.u = cube size, o.tint(v) -> true highlights a cube, o.xray = see-through. */
  function isoSvg(voxels, o = {}) {
    const u = o.u || 30, pad = o.pad == null ? 8 : o.pad;
    if (!voxels.length) return svg('svg', { viewBox: '0 0 80 40', style: 'width:80px;display:block' }, T(40, 24, '(empty)', { 'font-size': 12, fill: MUTED }));
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const [a, b, z] of voxels) for (const da of [0, 1]) for (const db of [0, 1]) for (const dz of [0, 1]) {
      const [x, y] = proj(u, a + da, b + db, z + dz); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    const W = x1 - x0 + 2 * pad, H = y1 - y0 + 2 * pad, g = svg('g', { transform: `translate(${(pad - x0).toFixed(2)},${(pad - y0).toFixed(2)})` });
    const P = (a, b, z) => proj(u, a, b, z), sw = u >= 22 ? 1.7 : 1.2, op = o.xray ? { 'fill-opacity': 0.4 } : {};
    for (const v of voxels.slice().sort((p, q) => (p[0] + p[1] + p[2]) - (q[0] + q[1] + q[2]) || p[2] - q[2])) {
      const [a, b, z] = v, pal = o.tint && o.tint(v) ? HI : PAL, st = Object.assign({ stroke: INK, 'stroke-width': sw, 'stroke-linejoin': 'round' }, op);
      g.append(
        POLY([P(a, b, z + 1), P(a, b + 1, z + 1), P(a + 1, b + 1, z + 1), P(a + 1, b, z + 1)], Object.assign({ fill: pal.top }, st)),
        POLY([P(a + 1, b, z), P(a + 1, b + 1, z), P(a + 1, b + 1, z + 1), P(a + 1, b, z + 1)], Object.assign({ fill: pal.left }, st)),
        POLY([P(a, b + 1, z), P(a + 1, b + 1, z), P(a + 1, b + 1, z + 1), P(a, b + 1, z + 1)], Object.assign({ fill: pal.right }, st)));
    }
    return svg('svg', { viewBox: `0 0 ${W.toFixed(1)} ${H.toFixed(1)}`, style: `width:100%;max-width:${Math.round(W * (o.k || 1))}px;height:auto;display:block;margin:4px auto` }, g);
  }

  /** One solid box l (left face, along b) × w (right face, along a) × hgt, optional unit grid, dimension labels and water. */
  function isoBox(l, w, hgt, o = {}) {
    const u = o.u || 26, pad = o.labels ? 54 : 18, P = (a, b, z) => proj(u, a, b, z);
    const corners = [[0, 0, 0], [w, 0, 0], [0, l, 0], [w, l, 0], [0, 0, hgt], [w, 0, hgt], [0, l, hgt], [w, l, hgt]].map((c) => P(...c));
    const x0 = Math.min(...corners.map((c) => c[0])) - pad, x1 = Math.max(...corners.map((c) => c[0])) + pad;
    const y0 = Math.min(...corners.map((c) => c[1])) - pad, y1 = Math.max(...corners.map((c) => c[1])) + pad;
    const g = svg('g', { transform: `translate(${(-x0).toFixed(2)},${(-y0).toFixed(2)})` });
    const grid = (A, B, C, D, n1, n2) => {      // faces A-B-C-D, n1 cells along A→B, n2 along B→C
      for (let i = 1; i < n1; i++) { const t = i / n1; g.append(L(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, D[0] + (C[0] - D[0]) * t, D[1] + (C[1] - D[1]) * t, { stroke: INK, 'stroke-width': 0.8, opacity: 0.45 })); }
      for (let j = 1; j < n2; j++) { const t = j / n2; g.append(L(B[0] + (C[0] - B[0]) * t, B[1] + (C[1] - B[1]) * t, A[0] + (D[0] - A[0]) * t, A[1] + (D[1] - A[1]) * t, { stroke: INK, 'stroke-width': 0.8, opacity: 0.45 })); }
    };
    const box = (pal, hh, alpha, strokeW) => {
      const left = [P(w, 0, 0), P(w, l, 0), P(w, l, hh), P(w, 0, hh)], right = [P(0, l, 0), P(w, l, 0), P(w, l, hh), P(0, l, hh)], top = [P(0, 0, hh), P(0, l, hh), P(w, l, hh), P(w, 0, hh)];
      const st = { stroke: INK, 'stroke-width': strokeW, 'stroke-linejoin': 'round', 'fill-opacity': alpha };
      g.append(POLY(top, Object.assign({ fill: pal.top }, st)), POLY(left, Object.assign({ fill: pal.left }, st)), POLY(right, Object.assign({ fill: pal.right }, st)));
      return { left, right, top };
    };
    const f = box(PAL, hgt, o.water != null ? 0.35 : 1, 1.8);
    if (o.grid && o.water == null) {
      grid(f.left[0], f.left[1], f.left[2], f.left[3], l, hgt); grid(f.right[0], f.right[1], f.right[2], f.right[3], w, hgt); grid(f.top[0], f.top[1], f.top[2], f.top[3], l, w);
    }
    if (o.water != null) {                       // draw the water as an inner box, then re-outline the glass
      const d = Math.max(0, Math.min(hgt, o.water));
      if (d > 0) box(WAT, d, 0.85, 1.4);
      g.append(POLY([P(w, 0, 0), P(w, l, 0), P(w, l, hgt), P(w, 0, hgt)], { fill: 'none', stroke: INK, 'stroke-width': 1.8 }), POLY([P(0, l, 0), P(w, l, 0), P(w, l, hgt), P(0, l, hgt)], { fill: 'none', stroke: INK, 'stroke-width': 1.8 }), POLY([P(0, 0, hgt), P(0, l, hgt), P(w, l, hgt), P(w, 0, hgt)], { fill: 'none', stroke: INK, 'stroke-width': 1.8 }));
    }
    const lab = o.labels || {};
    if (lab.l) { const m = [(P(w, 0, 0)[0] + P(w, l, 0)[0]) / 2 - 14, (P(w, 0, 0)[1] + P(w, l, 0)[1]) / 2 + 18]; g.append(T(m[0], m[1], lab.l, { 'font-size': 13 })); }
    if (lab.w) { const m = [(P(w, l, 0)[0] + P(0, l, 0)[0]) / 2 + 22, (P(w, l, 0)[1] + P(0, l, 0)[1]) / 2 + 16]; g.append(T(m[0], m[1], lab.w, { 'font-size': 13 })); }
    if (lab.h) { const m = [P(w, 0, 0)[0] - 18, (P(w, 0, 0)[1] + P(w, 0, hgt)[1]) / 2 + 4]; g.append(T(m[0], m[1], lab.h, { 'font-size': 13, 'text-anchor': 'end' })); }
    const W = x1 - x0, H = y1 - y0;
    return svg('svg', { viewBox: `0 0 ${W.toFixed(1)} ${H.toFixed(1)}`, style: `width:100%;max-width:${Math.round(W * (o.k || 1))}px;height:auto;display:block;margin:4px auto` }, g);
  }

  /** A holder that shows the flat picture AND (when /static/js/view3d.js is loaded) a real 3D viewer you can turn with your finger.
   *  scene = {voxels|boxes, tint, labels, grid, xray}; o = {flat: () => svg, start3d, v3: view3d options, tip}. Call again on every redraw. */
  function showSolid(holder, scene, o = {}) {
    let st = holder._w3;
    if (!st) {
      st = holder._w3 = { three: !!(o.start3d && MC.view3d), viewer: null, flat: h('div'), stage: h('div') };
      const set = (on) => { st.three = on; st.bf.classList.toggle('on', !on); st.b3.classList.toggle('on', on); render(); };
      st.bf = chip('🖼 Flat picture', false, () => set(false)); st.b3 = chip('🧊 Turn it in 3D', false, () => set(true), { 'data-3d': '1' });
      st.bar = h('div', { class: 'v3d-switch' }, st.bf, st.b3);
      if (!MC.view3d) st.bar.style.display = 'none';
      holder.replaceChildren(st.bar, st.flat, st.stage);
      st.render = render;
      st.bf.classList.toggle('on', !st.three); st.b3.classList.toggle('on', st.three);
    }
    st.scene = scene; st.o = o;
    st.render();
    return st;
    function render() {
      const { scene: sc, o: op } = st;
      st.flat.style.display = st.three ? 'none' : ''; st.stage.style.display = st.three ? '' : 'none';
      if (!st.three) { if (op.flat) MC.fill(st.flat, op.flat()); return; }
      if (!st.viewer) st.viewer = MC.view3d(st.stage, Object.assign({ height: 300, views: true }, op.v3 || {}));
      st.viewer.set(sc);
    }
  }
  const dimLabels = (l, w, hh, txt) => [
    { at: [l / 2, -0.35, w + 0.4], text: txt ? txt.l : `${l}` }, { at: [l + 0.4, -0.35, w / 2], text: txt ? txt.w : `${w}` }, { at: [-0.4, hh / 2, w + 0.4], text: txt ? txt.h : `${hh}` }];

  /** The flat FRONT / RIGHT picture: cols = heights left→right. */
  function viewSvg(cols, o = {}) {
    const cell = o.cell || 26, maxH = o.maxH || Math.max(1, ...cols), n = cols.length, pad = 6, lab = o.label ? 20 : 0;
    const W = n * cell + pad * 2, H = maxH * cell + pad * 2 + lab, kids = [];
    for (let c = 0; c < n; c++) for (let k = 0; k < maxH; k++) {
      const on = k < cols[c];
      kids.push(R(pad + c * cell, pad + (maxH - 1 - k) * cell, cell, cell, { fill: on ? (o.fill || PAL.left) : '#fff', stroke: on ? INK : '#e1e4fb', 'stroke-width': on ? 1.6 : 1 }));
    }
    if (o.label) kids.push(T(W / 2, H - 5, o.label, { 'font-size': 12 }));
    return svg('svg', { viewBox: `0 0 ${W} ${H}`, style: `width:${W}px;max-width:100%;height:auto;display:block;margin:2px auto` }, ...kids);
  }
  const viewBlock = (cols, label, sub, o = {}) => h('div', {}, viewSvg(cols, Object.assign({ maxH: o.maxH }, o)), h('div', { class: 'w11-lbl' }, label), sub ? h('div', { class: 'w11-sub' }, sub) : null);

  /** Stack plan (top view with heights): static, or editable with − / + buttons (onChange(r, c, delta)). */
  function planTable(plan, o = {}) {
    const rows = plan.length, cols = plan[0].length, cells = [];
    const tbl = h('table', {}, ...plan.map((rw, r) => h('tr', {}, ...rw.map((n, c) => {
      const td = h('td', { class: o.edit ? 'edit' : '' });
      if (o.edit) {
        const val = h('b', {}, String(n)), minus = h('button', { type: 'button', 'aria-label': 'one fewer', onclick: () => o.edit(r, c, -1) }, '−'), plus = h('button', { type: 'button', 'aria-label': 'one more', onclick: () => o.edit(r, c, +1) }, '+');
        td.append(h('div', { class: 'w11-cellbtns' }, minus, val, plus)); cells.push({ r, c, val, minus, plus });
      } else td.textContent = String(n);
      return td;
    }))));
    const wrap = h('div', { class: 'w11-plan' }, h('div'), h('div', { class: 'top' }, 'BACK'), h('div'), h('div', { class: 'side' }, 'LEFT'), tbl, h('div', { class: 'side' }, 'RIGHT'), h('div'), h('div', { class: 'bot' }, 'FRONT'), h('div'));
    return { el: wrap, cells, rows, cols };
  }

  /** How many of the cubes can you actually see in the picture? (ray test along the viewing direction) */
  function seenCount(vox) {
    const key = (a, b, z) => a + ',' + b + ',' + z, set = new Set(vox.map((v) => key(...v))), offs = [0.1, 0.3, 0.5, 0.7, 0.9];
    let seen = 0;
    for (const [a, b, z] of vox) {
      const faces = [(s, t) => [a + s, b + t, z + 1], (s, t) => [a + 1, b + s, z + t], (s, t) => [a + s, b + 1, z + t]];
      let vis = false;
      outer: for (const f of faces) for (const s of offs) for (const t of offs) {
        const p = f(s, t); let free = true;
        for (let k = 0.02; k < 10; k += 0.05) { if (set.has(key(Math.floor(p[0] + k), Math.floor(p[1] + k), Math.floor(p[2] + k)))) { free = false; break; } }
        if (free) { vis = true; break outer; }
      }
      if (vis) seen++;
    }
    return seen;
  }
  const joints = (p) => { let j = 0; const R_ = p.length, C_ = p[0].length; for (let r = 0; r < R_; r++) for (let c = 0; c < C_; c++) { if (p[r][c] > 1) j += p[r][c] - 1; if (c + 1 < C_) j += Math.min(p[r][c], p[r][c + 1]); if (r + 1 < R_) j += Math.min(p[r][c], p[r + 1][c]); } return j; };
  const exposed = (p) => { let s = 0; const R_ = p.length, C_ = p[0].length, at = (r, c) => (r < 0 || c < 0 || r >= R_ || c >= C_ ? 0 : p[r][c]); for (let r = 0; r < R_; r++) for (let c = 0; c < C_; c++) { if (p[r][c]) s += 2; for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) s += Math.max(0, p[r][c] - at(r + dr, c + dc)); } return s; };
  /** the fewest-cube plan that still shows these views (cols L→R, rows FRONT→back); returns a plan with the BACK row first.
   *  Pair every column with a row of the same height (one cube does both jobs); a column or row left over gets its own cubes on a line that is tall enough. */
  function minPlan(fv, rv) {
    const nr = rv.length, nc = fv.length, g = zeros(nr, nc), colUsed = Array(nc).fill(false), rowUsed = Array(nr).fill(false);
    for (let c = 0; c < nc; c++) { const r = rv.findIndex((v, i) => !rowUsed[i] && v === fv[c]); if (r >= 0) { g[r][c] = fv[c]; colUsed[c] = true; rowUsed[r] = true; } }
    for (let c = 0; c < nc; c++) if (!colUsed[c]) { const r = rv.findIndex((v) => v >= fv[c]); g[r][c] = Math.max(g[r][c], fv[c]); }
    for (let r = 0; r < nr; r++) if (!rowUsed[r]) { const c = fv.findIndex((v) => v >= rv[r]); g[r][c] = Math.max(g[r][c], rv[r]); }
    return g.reverse();
  }
  const maxPlan = (fv, rv) => rv.map((rr) => fv.map((fc) => Math.min(fc, rr))).reverse();   // rows come out BACK first
  const sameArr = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

  /* ============================================================ stack builder (views / ceiling / glue) */
  /** cfg: {rows, cols, max, plan, mode:'views'|'ceiling'|'glue', target:{front,right}, presets:[{label,plan}], u} — returns {get, set} */
  MC.widgets.stackbuilder = (el, cfg) => {
    const rows = cfg.rows || (cfg.plan || []).length || 3, cols = cfg.cols || (cfg.plan && cfg.plan[0].length) || 3, max = cfg.max || 4, mode = cfg.mode || 'views';
    let plan = (cfg.plan || zeros(rows, cols)).map((r) => r.slice()), xray = false, best = { most: null, fewest: null };
    const iso = h('div'), views = h('div', { class: 'w11-split' }), out = h('div'), tableMount = h('div');
    const pt = planTable(plan, { edit: (r, c, d) => { plan[r][c] = Math.max(0, Math.min(max, plan[r][c] + d)); draw(); } });
    tableMount.append(pt.el);
    const tools = row();
    const xr = chip('👓 X-ray', false, () => { xray = !xray; xr.classList.toggle('on', xray); draw(); });
    if (mode === 'views') tools.append(xr);
    (cfg.presets || []).forEach((p) => tools.append(chip(p.label, false, () => { plan = p.plan.map((r) => r.slice()); draw(); })));
    if (mode === 'ceiling') {
      tools.append(chip('▲ Fill as high as both views allow', false, () => { plan = maxPlan(cfg.target.front, cfg.target.right); draw(); }), chip('▼ Fewest cubes', false, () => { plan = minPlan(cfg.target.front, cfg.target.right); draw(); }),
        chip('↺ Clear', false, () => { plan = zeros(rows, cols); draw(); }));
    }
    const tgt = mode === 'ceiling' ? h('div', { class: 'w11-split' }, viewBlock(cfg.target.front, 'FRONT view', 'must look like this', { maxH: max }), viewBlock(cfg.target.right, 'RIGHT view', 'front is on the left', { maxH: max, fill: PAL.right })) : null;
    el.append(h('div', { class: 'w11' }, tgt, h('div', { class: 'w11-split' }, iso, tableMount), mode !== 'glue' ? views : null, tools, out));
    function draw() {
      const vox = planVox(plan), n = vox.length, fv = frontView(plan), rv = rightView(plan);
      pt.cells.forEach(({ r, c, val, minus, plus }) => { val.textContent = String(plan[r][c]); minus.disabled = plan[r][c] <= 0; plus.disabled = plan[r][c] >= max; });
      showSolid(iso, { voxels: vox, xray }, { flat: () => isoSvg(vox, { u: cfg.u || 30, xray, k: 1.15 }), start3d: cfg.start3d !== false,
        v3: mode === 'glue' ? { explode: true, count: true, countHint: 'Tap every face you can see to mark it — then turn the solid over (or pull the cubes apart) to find the rest.' } : {} });
      if (mode !== 'glue') MC.fill(views, viewBlock(fv, 'FRONT view', 'tallest stack in each column', { maxH: max }), viewBlock(rv, 'RIGHT view', 'front row is on the left', { maxH: max, fill: PAL.right }));
      if (mode === 'views') {
        const seen = seenCount(vox);
        MC.fill(out, note(`**${n}** cubes in all. You can see **${seen}** of them in the picture${n - seen ? ` — **${n - seen}** are hidden behind taller stacks!` : ' — none are hidden.'}`, n - seen ? 'warn' : ''));
      } else if (mode === 'ceiling') {
        const okF = sameArr(fv, cfg.target.front), okR = sameArr(rv, cfg.target.right);
        if (okF && okR) { best.most = Math.max(best.most == null ? 0 : best.most, n); best.fewest = Math.min(best.fewest == null ? 99 : best.fewest, n); }
        const msg = okF && okR ? `✅ Both views match with **${n}** cubes.` : `${okF ? '✅' : '❌'} front view · ${okR ? '✅' : '❌'} right view — **${n}** cubes so far.`;
        MC.fill(out, note(msg, okF && okR ? 'good' : ''), best.most == null ? null : note(`Most cubes you found: **${best.most}** · Fewest: **${best.fewest}**`));
      } else {
        const j = joints(plan), ex = exposed(plan);
        MC.fill(out, note(`**${n}** cubes × 6 faces = **${6 * n}** faces. **${j}** glued joints hide **2** faces each → **${2 * j}** hidden.`),
          note(`Surface area = ${6 * n} − ${2 * j} = **${6 * n - 2 * j}** square units. ${6 * n - 2 * j === ex ? `(Counting every face that shows gives **${ex}** too ✅)` : ''}`, 'good'), cfg.extra ? note(cfg.extra) : null);
      }
    }
    draw();
    return { get: () => plan.map((r) => r.slice()), set: (p) => { plan = p.map((r) => r.slice()); draw(); } };
  };

  /* ============================================================ the stack (figure) */
  MC.widgets.stack = (el, cfg) => {
    const plan = cfg.plan, vox0 = cfg.voxels || planVox(plan), holder = h('div');
    const kids = cfg.iso === false ? [] : [holder];
    if (kids.length) showSolid(holder, { voxels: vox0, tint: cfg.tint }, { flat: () => isoSvg(vox0, { u: cfg.u || 30, k: cfg.k || 1.1, tint: cfg.tint }), start3d: false });
    const side = [];
    if (cfg.table) side.push(planTable(plan).el);
    if (cfg.views) side.push(h('div', { class: 'w11-split' }, viewBlock(frontView(plan), 'FRONT view'), viewBlock(rightView(plan), 'RIGHT view', 'front on the left', { fill: PAL.right })));
    el.append(h('div', { class: 'w11' }, h('div', { class: 'w11-split' }, kids.length || cfg.caption ? h('div', {}, ...kids, cfg.caption ? h('div', { class: 'w11-sub' }, cfg.caption) : null) : null, ...side)));
  };

  /* ============================================================ draw a view yourself */
  /** cfg:{n, maxH, fill, label}. Tap a square to make that column that tall; tap its top square again to make it shorter. Returns {get, set, el}. */
  MC.widgets.viewdraw = (el, cfg) => {
    const n = cfg.n, maxH = cfg.maxH, cell = cfg.cell || 34, pad = 6, hs = Array(n).fill(0), W = n * cell + pad * 2, H = maxH * cell + pad * 2;
    const g = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'w11-vdraw', style: `width:${W}px;max-width:100%;height:auto` });
    const rects = [];
    for (let c = 0; c < n; c++) for (let k = 0; k < maxH; k++) {
      const r = R(pad + c * cell, pad + (maxH - 1 - k) * cell, cell, cell, { fill: '#fff', stroke: '#c8cdf0', 'stroke-width': 1.2, 'data-c': c, 'data-k': k });
      r.addEventListener('click', () => { hs[c] = hs[c] === k + 1 ? k : k + 1; paint(); }); g.append(r); rects.push([c, k, r]);
    }
    const paint = () => rects.forEach(([c, k, r]) => { const on = k < hs[c]; r.setAttribute('fill', on ? (cfg.fill || PAL.left) : '#fff'); r.setAttribute('stroke', on ? INK : '#c8cdf0'); r.setAttribute('stroke-width', on ? 1.8 : 1.2); });
    const wrap = h('div', { class: 'w11' }, g, h('div', { class: 'w11-sub' }, cfg.label || 'Tap the squares to draw the view'));
    el.append(wrap);
    return { el: wrap, get: () => hs.slice(), set: (a) => { a.forEach((v, i) => { hs[i] = v; }); paint(); }, g };
  };

  /* ============================================================ walk around the table */
  const SIDES = [
    { id: 'front', name: 'the front', hint: 'the picture’s left is the table’s LEFT column' },
    { id: 'back', name: 'the back', hint: 'you face the other way, so left and right swap: the picture’s left is the table’s RIGHT column' },
    { id: 'right', name: 'the right', hint: 'you face the table’s left side; your left hand points to the FRONT row, so the front row is on the left of the picture' },
    { id: 'left', name: 'the left', hint: 'you face the table’s right side; your left hand points to the BACK row, so the back row is on the left of the picture' },
  ];
  /** what someone standing at `side` of a grid (rows BACK→FRONT as drawn, cols left→right) sees, left to right */
  function seenFrom(grid, side) {
    const R_ = grid.length, C_ = grid[0].length, colMax = (c) => Math.max(...grid.map((r) => r[c])), rowMax = (r) => Math.max(...grid[r]);
    if (side === 'front') return Array.from({ length: C_ }, (_, c) => colMax(c));
    if (side === 'back') return Array.from({ length: C_ }, (_, c) => colMax(C_ - 1 - c));
    if (side === 'right') return Array.from({ length: R_ }, (_, i) => rowMax(R_ - 1 - i));
    return Array.from({ length: R_ }, (_, i) => rowMax(i));
  }
  /** the table seen from above, heights in the squares, a grey circle (the person) on one side with an arrow toward the table */
  function mapSvg(grid, side, nums, backFront) {
    const R_ = grid.length, C_ = grid[0].length, cell = 56, pad = 46, W = C_ * cell + pad * 2, H = R_ * cell + pad * 2, g = svg('g');
    grid.forEach((rw, r) => rw.forEach((n, c) => {
      g.append(R(pad + c * cell, pad + r * cell, cell, cell, { fill: n ? '#eef2fb' : '#fff', stroke: INK, 'stroke-width': 2 }), T(pad + c * cell + cell / 2, pad + r * cell + cell / 2 + 9, String(n), { 'font-size': 26, fill: n ? INK : '#c4c8e6' }));
      if (nums) g.append(T(pad + c * cell + 9, pad + r * cell + 14, String(nums[r][c]), { 'font-size': 11, 'text-anchor': 'middle', fill: MUTED }));
    }));
    const mid = { front: [W / 2, H - 16, 0, -1], back: [W / 2, 16, 0, 1], right: [W - 16, H / 2, -1, 0], left: [16, H / 2, 1, 0] }[side], [cx, cy, dx, dy] = mid;
    const tipx = cx + dx * 36, tipy = cy + dy * 36;
    g.append(svg('circle', { cx, cy, r: 13, fill: '#b6b9d6', stroke: INK, 'stroke-width': 2 }), L(cx + dx * 18, cy + dy * 18, tipx, tipy, { 'stroke-width': 3 }),
      L(tipx, tipy, tipx - dx * 8 + dy * 6, tipy - dy * 8 + dx * 6, { 'stroke-width': 3 }), L(tipx, tipy, tipx - dx * 8 - dy * 6, tipy - dy * 8 - dx * 6, { 'stroke-width': 3 }));
    if (backFront !== false) g.append(T(W / 2, 20, 'BACK', { 'font-size': 11, fill: MUTED }), T(W / 2, H - 6, 'FRONT', { 'font-size': 11, fill: MUTED }));
    return svg('svg', { viewBox: `0 0 ${W} ${H}`, style: `width:${W}px;max-width:100%;height:auto;background:#fff;border:3px solid #e1e4fb;border-radius:14px` }, g);
  }
  /** figure only: the table and where the person stands (no answer shown). cfg:{grid, nums, side, backFront} */
  MC.widgets.tablemap = (el, cfg) => { el.append(h('div', { class: 'w11' }, mapSvg(cfg.grid, cfg.side || 'right', cfg.nums, cfg.backFront))); };
  /** figure only: two flat views side by side. cfg:{front, right} */
  MC.widgets.viewpair = (el, cfg) => { el.append(h('div', { class: 'w11 w11-split' }, viewBlock(cfg.front, 'FRONT view'), viewBlock(cfg.right, 'RIGHT view', '(front is on the left)', { fill: PAL.right }))); };
  /** cfg:{grid (rows back→front), nums (cell labels, optional), side, sides:[…], backFront:true, circleSide}. */
  MC.widgets.viewer = (el, cfg) => {
    const grid = cfg.grid;
    let side = cfg.side || 'front'; const sides = cfg.sides || ['front', 'back', 'right', 'left'];
    const map = h('div'), pic = h('div'), say = h('div');
    const bar = row(...sides.map((s) => chip('🧍 from ' + SIDES.find((x) => x.id === s).name, s === side, () => { side = s; draw(); }, { 'data-side': s })));
    el.append(h('div', { class: 'w11' }, bar, h('div', { class: 'w11-split' }, map, pic), say));
    function draw() {
      [...bar.children].forEach((b, i) => b.classList.toggle('on', sides[i] === side));
      MC.fill(map, mapSvg(grid, side, cfg.nums, cfg.backFront));
      const seen = seenFrom(grid, side);
      MC.fill(pic, viewBlock(seen, 'what you see', 'left → right', { maxH: Math.max(...grid.flat()), fill: side === 'front' || side === 'back' ? PAL.left : PAL.right }));
      MC.fill(say, note(`From **${SIDES.find((x) => x.id === side).name}**: ${SIDES.find((x) => x.id === side).hint}. You see **${seen.join(', ')}** from left to right.`));
    }
    draw();
    return { get: () => seenFrom(grid, side), setSide: (s) => { side = s; draw(); } };
  };

  /* ============================================================ layer by layer */
  /** cfg:{plan} — slide the number of layers; each layer's cubes are counted. */
  MC.widgets.layers = (el, cfg) => {
    const plan = cfg.plan, H = Math.max(...plan.flat()), vox = planVox(plan), per = Array.from({ length: H }, (_, z) => vox.filter((v) => v[2] === z).length);
    const iso = h('div'), out = h('div');
    const s = slider('Layers shown', 1, H, 1, H, (v) => draw(v), (v) => `${v} of ${H}`);
    el.append(h('div', { class: 'w11' }, s.row, iso, out));
    function draw(k) {
      const shown = vox.filter((v) => v[2] < k), top = (v) => v[2] === k - 1;
      showSolid(iso, { voxels: shown, tint: top }, { flat: () => isoSvg(shown, { u: cfg.u || 30, k: 1.1, tint: top }), start3d: true });
      const so = sum(per.slice(0, k));
      MC.fill(out, note(`Layer ${k} (gold) has **${per[k - 1]}** cube${per[k - 1] === 1 ? '' : 's'}. Layers 1 to ${k} together: ${per.slice(0, k).join(' + ')} = **${so}**.`, k === H ? 'good' : ''),
        k === H ? note(`Bottom up: ${per.join(' + ')} = **${sum(per)}** cubes. No cube is left out — even the hidden ones.`) : null);
    }
    draw(H);
  };

  /* ============================================================ plus-shaped cross → fill the 3×3×3 */
  MC.widgets.cross = (el) => {
    const cross = [[1, 1, 1], [0, 1, 1], [2, 1, 1], [1, 0, 1], [1, 2, 1], [1, 1, 0], [1, 1, 2]], has = (a, b, z) => cross.some((v) => v[0] === a && v[1] === b && v[2] === z);
    const names = ['bottom layer', 'middle layer', 'top layer'], added = [false, false, false];
    const iso = h('div'), out = h('div'), btns = row();
    const fillOf = (z) => { const v = []; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) if (!has(a, b, z)) v.push([a, b, z]); return v; };
    const missing = [0, 1, 2].map((z) => fillOf(z).length);
    [0, 1, 2].forEach((z) => btns.append(chip(`Fill the ${names[z]}`, false, () => { added[z] = !added[z]; btns.children[z].classList.toggle('on', added[z]); draw(); }, { 'data-layer': z })));
    el.append(h('div', { class: 'w11' }, iso, btns, out));
    function draw() {
      const extra = [0, 1, 2].flatMap((z) => (added[z] ? fillOf(z) : [])), vox = cross.concat(extra), isNew = (v) => !has(...v);
      showSolid(iso, { voxels: vox, tint: isNew }, { flat: () => isoSvg(vox, { u: 34, k: 1.1, tint: isNew, xray: false }), start3d: true });
      const n = sum(added.map((x, z) => (x ? missing[z] : 0)));
      MC.fill(out, note(`Each layer of the big cube has 9 spots. George already has: bottom **1**, middle **5**, top **1**. Missing: bottom **${missing[0]}**, middle **${missing[1]}**, top **${missing[2]}**.`),
        note(`Cubes you added so far: **${n}**${added.every(Boolean) ? ` → 7 + ${n} = **${7 + n}** = 3 × 3 × 3 ✅` : ''}`, added.every(Boolean) ? 'good' : ''));
    }
    draw();
  };

  /** figure: one solid box, optionally with water. cfg:{l,w,h,u,labels:false|true,water} */
  MC.widgets.box = (el, cfg) => {
    const lab = cfg.labels === false ? undefined : { l: `${cfg.l} cm`, w: `${cfg.w} cm`, h: `${cfg.h} cm` };
    const holder = h('div');
    el.append(h('div', { class: 'w11' }, holder));
    const flat = () => isoBox(cfg.l, cfg.w, cfg.h, { u: cfg.u || 24, labels: lab, water: cfg.water, k: 1.2 });
    if (cfg.water != null) MC.fill(holder, flat());           // water is only drawn in the flat picture
    else showSolid(holder, { boxes: [{ a: cfg.w, b: cfg.l, z: cfg.h }], labels: lab ? dimLabels(cfg.l, cfg.w, cfg.h, { l: `${cfg.l} cm`, w: `${cfg.w} cm`, h: `${cfg.h} cm` }) : null }, { flat, start3d: false });
  };

  /* ============================================================ the box: three pairs of faces */
  MC.widgets.boxsa = (el, cfg) => {
    let l = cfg.l || 5, w = cfg.w || 3, hh = cfg.h || 4, grid = false;
    const view = h('div'), out = h('div');
    const sl = slider('Length l', 1, 8, 1, l, (v) => { l = v; draw(); }, (v) => v + ' cm'), sw = slider('Width w', 1, 8, 1, w, (v) => { w = v; draw(); }, (v) => v + ' cm'), sh = slider('Height h', 1, 8, 1, hh, (v) => { hh = v; draw(); }, (v) => v + ' cm');
    const gb = chip('▦ Show the 1 cm squares', false, () => { grid = !grid; gb.classList.toggle('on', grid); draw(); });
    el.append(h('div', { class: 'w11' }, sl.row, sw.row, sh.row, gb, view, out));
    function draw() {
      showSolid(view, { boxes: [{ a: w, b: l, z: hh }], grid, labels: dimLabels(l, w, hh, { l: `l = ${l}`, w: `w = ${w}`, h: `h = ${hh}` }) },
        { flat: () => isoBox(l, w, hh, { u: 20, grid, labels: { l: `l = ${l}`, w: `w = ${w}`, h: `h = ${hh}` }, k: 1.2 }), start3d: true,
          v3: { count: true, countHint: 'Tap a face to add its area. A box has 6 faces — find them all (turn it over for the bottom!).' } });
      const a = l * w, b = l * hh, c = w * hh, sa = 2 * (a + b + c);
      MC.fill(out, h('div', { class: 'w11-pairs' },
        h('span', { style: 'background:#eef2fb', html: `top & bottom: 2 × ${l} × ${w} = <b>${2 * a}</b>` }), h('span', { style: 'background:#c8d5f0', html: `front & back: 2 × ${l} × ${hh} = <b>${2 * b}</b>` }), h('span', { style: 'background:#98aedb', html: `left & right: 2 × ${w} × ${hh} = <b>${2 * c}</b>` })),
        note(`Surface area = ${2 * a} + ${2 * b} + ${2 * c} = **${sa} cm²** (square units).   Volume = ${l} × ${w} × ${hh} = **${l * w * hh} cm³** (cubic units).`, 'good'));
    }
    draw();
    return { get: () => ({ l, w, h: hh }) };
  };

  /* ============================================================ scaling a cube (edge ×k) */
  MC.widgets.scale = (el, cfg) => {
    let k = cfg.k || 2; const view = h('div'), out = h('div');
    const s = slider('Edge', 1, 5, 1, k, (v) => { k = v; draw(); }, (v) => v + ' cm');
    el.append(h('div', { class: 'w11' }, s.row, view, out));
    function draw() {
      showSolid(view, { boxes: [{ a: k, b: k, z: k }], grid: true }, { flat: () => isoBox(k, k, k, { u: Math.round(110 / (k + 1)), grid: true, k: 1.2 }), start3d: true });
      const rowsHtml = [1, 2, 3, 4, 5].map((e) => `<tr style="${e === k ? 'background:#e6e9ff' : ''}"><td>${e}</td><td>${e}×</td><td>6 × ${e}² = <b>${6 * e * e}</b></td><td>${e}³ = <b>${e ** 3}</b></td></tr>`).join('');
      MC.fill(out, note(`A cube with edge **${k}** is made of ${k}×${k}×${k} = **${k ** 3}** little cubes. Each face is ${k}×${k} = ${k * k} squares. Surface area = 6 × ${k * k} = **${6 * k * k}**.`, 'good'),
        h('table', { class: 'w11-grid', html: `<tr><th>edge</th><th>lengths</th><th>surface area</th><th>volume</th></tr>${rowsHtml}` }),
        note(`Compared with edge 1: lengths **×${k}**, surface area **×${k * k}** (= ${k}²), volume **×${k ** 3}** (= ${k}³).`));
    }
    draw();
  };

  /* ============================================================ stretch the sides (volume factor) */
  MC.widgets.stretch = (el, cfg) => {
    const dims = cfg.dims || [5, 3, 2], v0 = dims[0] * dims[1] * dims[2], opts = [[0.25, '¼'], [0.5, '½'], [1, '1'], [2, '2'], [3, '3'], [4, '4']], f = [1, 1, 1], names = ['length', 'width', 'height'];
    const view = h('div', { class: 'w11-split' }), out = h('div'), rows = names.map((nm, i) => row(h('b', { style: 'min-width:70px' }, nm), ...opts.map(([v, t]) => chip('×' + t, v === 1, () => { f[i] = v; paint(); }, { 'data-dim': i, 'data-f': v }))));
    el.append(h('div', { class: 'w11' }, h('div', { class: 'w11-sub' }, `Start: a ${dims.join(' × ')} box, volume ${v0}`), ...rows, view, out));
    function paint() {
      rows.forEach((r, i) => [...r.querySelectorAll('button')].forEach((b) => b.classList.toggle('on', +b.dataset.f === f[i])));
      const nd = dims.map((d, i) => d * f[i]), u = 12;
      MC.fill(view, h('div', {}, isoBox(dims[0], dims[1], dims[2], { u, k: 1 }), h('div', { class: 'w11-lbl' }, 'before')), h('div', {}, isoBox(nd[0], nd[1], nd[2], { u, k: 1 }), h('div', { class: 'w11-lbl' }, 'after')));
      const fac = f[0] * f[1] * f[2];
      MC.fill(out, note(`Volume factor = ${f.map((x) => opts.find((o) => o[0] === x)[1]).join(' × ')} = **${+fac.toFixed(3)}**. New volume = ${v0} × ${+fac.toFixed(3)} = **${+(v0 * fac).toFixed(2)}**.`, 'good'));
    }
    paint();
    return { get: () => f.slice() };
  };

  /* ============================================================ tilt the box (water volume stays) */
  /** cfg:{dims:[p,q,r], depth} — the box stands first on its p×q face with the water `depth` deep. */
  MC.widgets.tilt = (el, cfg) => {
    const [p, q, r] = cfg.dims, V = p * q * cfg.depth, stands = [[p, q, r], [p, r, q], [q, r, p]];
    let cur = 0; const view = h('div'), out = h('div'), bar = row(...stands.map((s, i) => chip(`stand on the ${s[0]} × ${s[1]} face`, i === 0, () => { cur = i; draw(); }, { 'data-stand': i })));
    el.append(h('div', { class: 'w11' }, bar, view, out));
    function draw() {
      [...bar.children].forEach((b, i) => b.classList.toggle('on', i === cur));
      const [a, b, hg] = stands[cur], base = a * b, d = V / base;
      MC.fill(view, isoBox(b, a, hg, { u: 20, water: d, labels: { l: `${b}`, w: `${a}`, h: `${hg}` }, k: 1.1 }));
      MC.fill(out, note(`Water volume = base × depth = ${p} × ${q} × ${cfg.depth} = **${V}** (it never changes — the box is closed).`),
        note(`Standing on ${a} × ${b} (area ${base}): depth = ${V} ÷ ${base} = **${+d.toFixed(3)}**.`, 'good'));
    }
    draw();
  };

  /* ============================================================ cut a corner off a cube */
  MC.widgets.cutcorner = (el) => {
    const order = [[2, 2, 2], [2, 0, 2], [0, 2, 2], [0, 0, 2], [2, 2, 0], [2, 0, 0], [0, 2, 0], [0, 0, 0]];
    let k = 1; const view = h('div'), out = h('div'), s = slider('Corners cut out', 0, 8, 1, k, (v) => { k = v; draw(); }, (v) => `${v} of 8`);
    el.append(h('div', { class: 'w11' }, s.row, view, out));
    function draw() {
      const gone = order.slice(0, k), vox = [];
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) for (let z = 0; z < 3; z++) if (!gone.some((c) => c[0] === a && c[1] === b && c[2] === z)) vox.push([a, b, z]);
      showSolid(view, { voxels: vox }, { flat: () => isoSvg(vox, { u: 36, k: 1.1 }), start3d: true });
      MC.fill(out, note(`The cube had **6** faces. Every cut-out corner **adds 3 new faces** (the 3 little squares inside the notch) and the 3 old faces just get a notch — they are still **one face each**.`),
        note(`${k} cut${k === 1 ? '' : 's'}: 6 + 3 × ${k} = **${6 + 3 * k}** faces.${k === 8 ? ' All 8 corners → **30** faces ✅' : ''}`, k === 8 ? 'good' : ''));
    }
    draw();
  };

  /* ============================================================ Kangaroo 2020 Q19: which side was the side view from? */
  MC.widgets.topside = (el, cfg) => {
    const mask = cfg.mask, sv = cfg.side, N = mask.length, cell = 44, pad = 10, W = N * cell + pad * 2;
    const opts = [['bottom edge', 'cols', sv], ['top edge', 'cols', sv.slice().reverse()], ['left edge', 'rows', sv], ['right edge', 'rows', sv.slice().reverse()]];
    if (cfg.figureOnly) {
      const g0 = svg('g'); for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) g0.append(R(pad + c * cell, pad + r * cell, cell, cell, { fill: mask[r][c] === '#' ? '#c8d5f0' : '#fff', stroke: INK, 'stroke-width': 1.6 }));
      el.append(h('div', { class: 'w11 w11-split' }, h('div', {}, svg('svg', { viewBox: `0 0 ${W} ${W}`, style: `width:${W}px;max-width:100%;height:auto;background:#fff;border:3px solid #e1e4fb;border-radius:14px` }, g0), h('div', { class: 'w11-lbl' }, 'view from above'), h('div', { class: 'w11-sub' }, 'shaded = has cubes')), viewBlock(sv, 'view from one side', 'we do not know which side', { maxH: Math.max(...sv) })));
      return;
    }
    let cur = 1; const view = h('div'), out = h('div'), bar = row(...opts.map((o, i) => chip('side view taken from the ' + o[0], i === cur, () => { cur = i; draw(); }, { 'data-opt': i })));
    el.append(h('div', { class: 'w11' }, h('div', { class: 'w11-split' }, viewBlock(sv, 'the side view', 'read left → right', { maxH: Math.max(...sv) })), bar, view, out));
    function draw() {
      [...bar.children].forEach((b, i) => b.classList.toggle('on', i === cur));
      const [nm, axis, hs] = opts[cur], g = svg('g'); let tot = 0;
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const on = mask[r][c] === '#', hv = hs[axis === 'cols' ? c : r];
        g.append(R(pad + c * cell, pad + r * cell, cell, cell, { fill: on ? '#c8d5f0' : '#fff', stroke: INK, 'stroke-width': 1.6 }));
        if (on) { g.append(T(pad + c * cell + cell / 2, pad + r * cell + cell / 2 + 7, String(hv), { 'font-size': 20 })); tot += hv; }
      }
      MC.fill(view, svg('svg', { viewBox: `0 0 ${W} ${W}`, style: `width:${W}px;max-width:100%;height:auto;display:block;margin:6px auto;background:#fff;border:3px solid #e1e4fb;border-radius:14px` }, g));
      const totals = opts.map((o) => mask.reduce((s2, rw, r) => s2 + [...rw].reduce((s3, ch, c) => s3 + (ch === '#' ? o[2][o[1] === 'cols' ? c : r] : 0), 0), 0));
      MC.fill(out, note(`Side view from the **${nm}**: every shaded square gets the biggest height its line of sight allows → total **${tot}** cubes.`, tot === Math.max(...totals) ? 'good' : ''),
        note(`All four possible sides give: ${opts.map((o, i) => `${o[0]} **${totals[i]}**`).join(' · ')}. The largest is **${Math.max(...totals)}**.`));
    }
    draw();
  };

  MC.w11 = { planVox, frontView, rightView, seenCount, joints, exposed, minPlan, maxPlan, seenFrom, isoSvg, isoBox, viewSvg, minPlanTotal: (fv, rv) => total(minPlan(fv, rv)) };
})();
