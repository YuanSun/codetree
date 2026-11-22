/* MC.view3d — a small interactive 3D viewer (Canvas 2D, no libraries) for cube stacks and boxes.
 *
 *   const v = MC.view3d(el, { voxels: [[a,b,z],…] | boxes: [{a:w, b:l, z:h}], height: 300, … });
 *   v.set({ voxels, boxes, tint, grid })      replace the solid, keep the camera
 *   v.view('front'|'right'|'top'|'corner'|…)  fly the camera to a standard view
 *
 * Coordinates are the ones the isometric pictures use: a = toward the viewer's front-left, b = toward the right, z = up.
 * Drag to turn it (it keeps gliding), pinch / ± to zoom, double-tap to reset. Optional tools (cfg): views, xray,
 * explode (pull the cubes apart), count (tap faces to mark them — surface area by hand). Respects reduced motion.
 */
(function () {
  'use strict';
  const MC = (window.MC = window.MC || {});
  const { h } = MC;
  const PAL = { top: [238, 242, 251], a: [200, 213, 240], b: [152, 174, 219] };   // the same three tones as the flat pictures
  const HI = { top: [255, 246, 214], a: [255, 224, 138], b: [242, 184, 75] };
  const MARK = { top: [180, 240, 205], a: [120, 220, 165], b: [60, 190, 130] };
  const INK = '#1d2150';
  const VIEWS = {   // yaw, pitch (radians): the camera sits at (sin yaw cos p, sin p, cos yaw cos p) in (b, up, a)
    front: [0, 0, 'FRONT'], right: [Math.PI / 2, 0, 'RIGHT'], back: [Math.PI, 0, 'BACK'], left: [-Math.PI / 2, 0, 'LEFT'],
    top: [0, 1.553, 'TOP'], bottom: [0, -1.553, 'BOTTOM'], corner: [Math.PI / 4, 0.6155, 'CORNER'],
  };
  const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
  const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
  const cross = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
  const LIGHT = norm([0.45, 1, 0.75]);
  // face directions: [da, db, dz, axis, tangent u, tangent v] in WORLD (x=b, y=z, zz=a)
  const DIRS = [
    { n: [0, 0, 1], axis: 'a', s: 1 }, { n: [0, 0, -1], axis: 'a', s: -1 },     // ±a  (world zz)
    { n: [1, 0, 0], axis: 'b', s: 1 }, { n: [-1, 0, 0], axis: 'b', s: -1 },     // ±b  (world x)
    { n: [0, 1, 0], axis: 'top', s: 1 }, { n: [0, -1, 0], axis: 'top', s: -1 },  // ±z  (world y)
  ];

  MC.view3d = function (el, cfg = {}) {
    let scene = { voxels: [], boxes: [], tint: null, grid: false };
    let yaw = Math.PI / 4, pitch = 0.6155, zoom = 1, explode = 1, xray = false, auto = !reduced() && cfg.auto !== false;
    let vyaw = 0, vpitch = 0, fly = null, faces = [], marked = new Set(), dirty = true, W = 0, H = 0, dpr = 1, live = true, activeView = 'corner';
    const state = { dragging: false, moved: 0, last: null, pointers: new Map(), pinch: 0, idleSince: 0 };

    const canvas = h('canvas', { class: 'v3d-canvas', tabindex: '0', role: 'img', 'aria-label': cfg.label || '3D view of the solid. Drag to turn it.' });
    const stage = h('div', { class: 'v3d-stage', style: { height: (cfg.height || 300) + 'px' } }, canvas);
    const hint = h('div', { class: 'v3d-hint' }, '👆 Drag to turn it');
    stage.append(hint); setTimeout(() => hint.classList.add('gone'), 5000);
    const bar = h('div', { class: 'v3d-bar' }), info = h('div', { class: 'v3d-info', role: 'status' });
    const root = h('div', { class: 'v3d' }, stage, bar, info);
    el.append(root);
    const ctx = canvas.getContext('2d');

    /* ---------------------------------------------------------------- the toolbar */
    const chip = (label, fn, title) => { const b = h('button', { type: 'button', class: 'v3d-chip', title: title || '', onclick: fn }, label); return b; };
    const viewChips = {};
    if (cfg.views !== false) {
      const g = h('div', { class: 'v3d-group' }, h('span', { class: 'v3d-cap' }, 'Look from'));
      for (const k of cfg.viewList || ['front', 'right', 'top', 'corner']) { viewChips[k] = chip(k === 'corner' ? '🧊 corner' : VIEWS[k][2].toLowerCase(), () => api.view(k)); viewChips[k].dataset.view = k; g.append(viewChips[k]); }
      bar.append(g);
    }
    const spin = chip(auto ? '⏸ Spin' : '▶ Spin', () => { auto = !auto; spin.textContent = auto ? '⏸ Spin' : '▶ Spin'; dirty = true; }, 'Turn it slowly by itself');
    const zin = chip('＋', () => { zoom = Math.min(3, zoom * 1.2); dirty = true; }, 'Zoom in'), zout = chip('－', () => { zoom = Math.max(0.45, zoom / 1.2); dirty = true; }, 'Zoom out');
    const g2 = h('div', { class: 'v3d-group' }, spin, zout, zin);
    if (cfg.xray) { const x = chip('👓 X-ray', () => { xray = !xray; x.classList.toggle('on', xray); dirty = true; }, 'See through the cubes'); g2.append(x); }
    bar.append(g2);
    let exploder = null;
    if (cfg.explode) {
      const out = h('b', {}, '1×');
      const inp = h('input', { type: 'range', min: 1, max: 2.4, step: 0.05, value: 1, 'aria-label': 'Pull the cubes apart' });
      inp.addEventListener('input', () => { explode = +inp.value; out.textContent = explode <= 1.01 ? 'together' : 'apart'; dirty = true; api.onExplode && api.onExplode(explode); });
      out.textContent = 'together';
      exploder = h('label', { class: 'v3d-group v3d-explode' }, h('span', { class: 'v3d-cap' }, '💥 Pull apart'), inp, out);
      bar.append(exploder);
    }
    let countUI = null;
    if (cfg.count) {
      countUI = h('div', { class: 'v3d-count' });
      bar.append(chip('↺ Clear marks', () => { marked.clear(); dirty = true; updateCount(); }, 'Unmark everything'));
      root.append(countUI);
    }

    /* ---------------------------------------------------------------- building the faces */
    function build() {
      faces = [];
      const vox = scene.voxels, has = new Set(vox.map((v) => v.join(',')));
      const sepa = explode > 1.015 || xray;                        // pulled apart / see-through: every cube shows all six faces
      const k = explode;
      for (const v of vox) {
        const [a, b, z] = v, tinted = scene.tint ? scene.tint(v) : false;
        const shift = k === 1 ? null : [b + 0.5, z + 0.5, a + 0.5].map((c, n) => (c - sceneCentre[n]) * (k - 1));   // the whole cube moves out, not its faces separately
        for (const d of DIRS) {
          const nb = [a + (d.n[2]), b + d.n[0], z + d.n[1]];
          if (!sepa && has.has(nb.join(','))) continue;
          const area = 1;
          faces.push(mk([b + 0.5 + d.n[0] * 0.5, z + 0.5 + d.n[1] * 0.5, a + 0.5 + d.n[2] * 0.5], d, 1, 1, area, `v${a},${b},${z},${d.axis}${d.s}`, tinted, shift));
        }
      }
      for (const bx of scene.boxes) {                            // a box is one face per side (unit squares when the grid is on)
        const A = bx.a, B = bx.b, Z = bx.z;                      // sizes along a, b, z
        const c = [B / 2, Z / 2, A / 2];
        for (const d of DIRS) {
          const size = d.axis === 'a' ? [B, Z] : d.axis === 'b' ? [A, Z] : [B, A];      // the face's own two lengths
          const centre = [c[0] + d.n[0] * B / 2, c[1] + d.n[1] * Z / 2, c[2] + d.n[2] * A / 2];
          if (scene.grid) {
            for (let i = 0; i < size[0]; i++) for (let j = 0; j < size[1]; j++) faces.push(mk(offset(centre, d, size, i, j), d, 1, 1, size[0] * size[1], `b${d.axis}${d.s}`, false, null, true));
          } else faces.push(mk(centre, d, size[0], size[1], size[0] * size[1], `b${d.axis}${d.s}`, false, null));
        }
      }
      if (cfg.count) updateCount();
    }
    // the two tangent unit vectors of a face
    function tangents(d) { return d.axis === 'a' ? [[1, 0, 0], [0, 1, 0]] : d.axis === 'b' ? [[0, 0, 1], [0, 1, 0]] : [[1, 0, 0], [0, 0, 1]]; }
    function offset(centre, d, size, i, j) { const [t1, t2] = tangents(d); return centre.map((c, n) => c + t1[n] * (i + 0.5 - size[0] / 2) + t2[n] * (j + 0.5 - size[1] / 2)); }
    function mk(centre, d, w, hh, area, key, tint, shift, cell) {
      const [t1, t2] = tangents(d);
      const cen = shift ? centre.map((c, n) => c + shift[n]) : centre;
      const p = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => cen.map((c, n) => c + t1[n] * x * w / 2 + t2[n] * y * hh / 2));
      return { p, c: cen, n: d.n, axis: d.axis, area, key, tint, cell: !!cell };
    }
    let sceneCentre = [0, 0, 0], radius = 1;
    function fit() {
      const pts = [];
      for (const [a, b, z] of scene.voxels) pts.push([b, z, a], [b + 1, z + 1, a + 1]);
      for (const bx of scene.boxes) pts.push([0, 0, 0], [bx.b, bx.z, bx.a]);
      if (!pts.length) pts.push([0, 0, 0], [1, 1, 1]);
      const lo = [0, 1, 2].map((i) => Math.min(...pts.map((p) => p[i]))), hi = [0, 1, 2].map((i) => Math.max(...pts.map((p) => p[i])));
      sceneCentre = lo.map((l, i) => (l + hi[i]) / 2);
      radius = Math.max(1, Math.hypot(...hi.map((x, i) => x - lo[i])) / 2);
    }

    /* ---------------------------------------------------------------- drawing */
    function camera() {
      const cp = Math.cos(pitch), c = [Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp];
      const r = norm([c[2], 0, -c[0]]), u = cross(c, r);
      return { c, r, u };
    }
    function resize() {
      const rect = stage.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = Math.max(120, Math.round(rect.width)); H = Math.max(120, Math.round(rect.height));
      canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      dirty = true;
    }
    function project(P, cam, scale, D) {
      const q = [P[0] - sceneCentre[0], P[1] - sceneCentre[1], P[2] - sceneCentre[2]];
      const depth = dot(q, cam.c), k = D / (D - depth);
      return [W / 2 + dot(q, cam.r) * k * scale, H / 2 - dot(q, cam.u) * k * scale, depth];
    }
    const shade = (col, f) => `rgb(${col.map((x) => Math.max(0, Math.min(255, Math.round(x * f)))).join(',')})`;
    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const reff = radius * (explode > 1.015 ? explode : 1), cam = camera(), D = reff * 5.5, scale = (Math.min(W, H) / (reff * 2.35)) * zoom;
      const eye = cam.c.map((x, i) => x * D + sceneCentre[i]);
      // ground shadow, only when looking down on it
      if (cam.c[1] > 0.12 && scene.voxels.length + scene.boxes.length) {
        let yMin = Infinity; for (const f of faces) for (const p of f.p) yMin = Math.min(yMin, p[1]);
        ctx.beginPath();
        for (let i = 0; i <= 28; i++) { const t = (i / 28) * Math.PI * 2, s = project([sceneCentre[0] + Math.cos(t) * radius * 1.05, yMin - 0.01, sceneCentre[2] + Math.sin(t) * radius * 1.05], cam, scale, D); i ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]); }
        ctx.fillStyle = 'rgba(29,33,80,.10)'; ctx.fill();
      }
      const list = [];
      for (const f of faces) {
        const toEye = [eye[0] - f.c[0], eye[1] - f.c[1], eye[2] - f.c[2]];
        const facing = dot(f.n, toEye) > 0;
        if (!facing && !xray) continue;
        f.sp = f.p.map((p) => project(p, cam, scale, D));
        f.sx = f.sp.reduce((s, p) => s + p[0], 0) / 4; f.sy = f.sp.reduce((s, p) => s + p[1], 0) / 4;
        f.dist = Math.hypot(...toEye); f.facing = facing;
        list.push(f);
      }
      list.sort((p, q) => q.dist - p.dist);
      const lw = Math.max(1, 1.6 * Math.min(1.4, zoom));
      for (const f of list) {
        const isMarked = marked.has(f.key), base = (isMarked ? MARK : f.tint ? HI : PAL)[f.axis];
        const lit = 0.74 + 0.36 * Math.max(0, dot(f.n, LIGHT)) * (f.facing ? 1 : 0.6);
        ctx.beginPath(); f.sp.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
        ctx.globalAlpha = xray ? (f.facing ? 0.55 : 0.25) : 1;
        ctx.fillStyle = shade(base, lit); ctx.fill();
        ctx.globalAlpha = xray ? 0.85 : 1;
        ctx.strokeStyle = INK; ctx.lineWidth = f.cell ? lw * 0.5 : lw; ctx.lineJoin = 'round'; ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // labels on boxes (dimensions) — drawn on top, anchored to the edges
      if (scene.labels) for (const lab of scene.labels) {
        const s = project(lab.at, cam, scale, D);
        ctx.font = '800 13px Nunito, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const tw = ctx.measureText(lab.text).width + 12;
        ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(s[0] - tw / 2, s[1] - 11, tw, 22, 8) : ctx.rect(s[0] - tw / 2, s[1] - 11, tw, 22); ctx.fill(); ctx.stroke();
        ctx.fillStyle = INK; ctx.fillText(lab.text, s[0], s[1] + 1);
      }
      state.drawn = list;
      // which standard view are we in? (lights its button)
      let best = null;
      const wrap = (x) => Math.abs(((x + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      for (const [k, [vy, vp]] of Object.entries(VIEWS)) {
        if (Math.abs(pitch - vp) > 0.05) continue;
        if (Math.abs(vp) > 1 || wrap(yaw - vy) < 0.05) { best = k; break; }
      }
      if (best !== activeView) { activeView = best; for (const [k, b] of Object.entries(viewChips)) b.classList.toggle('on', k === best); api.onView && api.onView(best); }
    }

    /* ---------------------------------------------------------------- the loop */
    let last = 0;
    function frame(t) {
      if (!live) return;
      requestAnimationFrame(frame);
      const dt = Math.min(0.05, (t - last) / 1000 || 0.016); last = t;
      if (fly) {
        fly.t = Math.min(1, fly.t + dt / 0.5); const e = 1 - Math.pow(1 - fly.t, 3);
        yaw = fly.y0 + (fly.y1 - fly.y0) * e; pitch = fly.p0 + (fly.p1 - fly.p0) * e; zoom = fly.z0 + (fly.z1 - fly.z0) * e;
        if (fly.t >= 1) fly = null; dirty = true;
      } else if (!state.dragging) {
        if (Math.abs(vyaw) > 0.0002 || Math.abs(vpitch) > 0.0002) { yaw += vyaw; pitch = Math.max(-1.553, Math.min(1.553, pitch + vpitch)); vyaw *= 0.93; vpitch *= 0.93; dirty = true; }
        else if (auto && performance.now() - state.idleSince > 1200) { yaw += dt * 0.35; dirty = true; }
      }
      if (!dirty || !W) return;
      dirty = false; build2(); draw();
    }
    let builtFor = '';
    function build2() { const key = `${explode}|${xray}|${scene.grid}|${scene.v}`; if (key !== builtFor) { builtFor = key; build(); } }
    if (typeof IntersectionObserver !== 'undefined') new IntersectionObserver((es) => { const on = es[0].isIntersecting; if (on && !live) { live = true; requestAnimationFrame(frame); } else if (!on) live = false; }).observe(stage);
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(stage); else addEventListener('resize', resize);

    /* ---------------------------------------------------------------- input */
    const stopAuto = () => { state.idleSince = performance.now(); hint.classList.add('gone'); };
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId); state.pointers.set(e.pointerId, [e.clientX, e.clientY]);
      state.dragging = true; state.moved = 0; state.last = [e.clientX, e.clientY]; vyaw = vpitch = 0; fly = null; stopAuto();
      if (state.pointers.size === 2) { const [p, q] = [...state.pointers.values()]; state.pinch = Math.hypot(p[0] - q[0], p[1] - q[1]); }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!state.pointers.has(e.pointerId)) return;
      state.pointers.set(e.pointerId, [e.clientX, e.clientY]);
      if (state.pointers.size >= 2) { const [p, q] = [...state.pointers.values()]; const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (state.pinch) { zoom = Math.max(0.45, Math.min(3, zoom * d / state.pinch)); dirty = true; } state.pinch = d; state.moved = 99; return; }
      const dx = e.clientX - state.last[0], dy = e.clientY - state.last[1]; state.last = [e.clientX, e.clientY]; state.moved += Math.abs(dx) + Math.abs(dy);
      yaw -= dx * 0.0095; pitch = Math.max(-1.553, Math.min(1.553, pitch + dy * 0.0095)); vyaw = -dx * 0.0095; vpitch = dy * 0.0095; dirty = true; stopAuto();
    });
    const up = (e) => {
      const was = state.pointers.has(e.pointerId); state.pointers.delete(e.pointerId); state.pinch = 0;
      if (!state.pointers.size) { state.dragging = false; state.idleSince = performance.now(); }
      if (was && e.type === 'pointerup' && state.moved < 6 && cfg.count) tap(e);
    };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('dblclick', () => api.view('corner'));
    canvas.addEventListener('wheel', (e) => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); zoom = Math.max(0.45, Math.min(3, zoom * Math.exp(-e.deltaY * 0.01))); dirty = true; stopAuto(); }, { passive: false });
    canvas.addEventListener('keydown', (e) => {
      const m = { ArrowLeft: [-0.12, 0], ArrowRight: [0.12, 0], ArrowUp: [0, -0.12], ArrowDown: [0, 0.12] }[e.key];
      if (m) { e.preventDefault(); yaw += m[0]; pitch = Math.max(-1.553, Math.min(1.553, pitch + m[1])); dirty = true; stopAuto(); }
    });
    window.addEventListener('pointerup', () => { if (!state.pointers.size) state.dragging = false; });

    /* ---------------------------------------------------------------- counting faces (surface area) */
    function tap(e) {
      const rect = canvas.getBoundingClientRect(), x = e.clientX - rect.left, y = e.clientY - rect.top;
      const inside = (poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
      for (let i = (state.drawn || []).length - 1; i >= 0; i--) {          // nearest first
        const f = state.drawn[i];
        if (!f.facing || !inside(f.sp)) continue;
        if (marked.has(f.key)) marked.delete(f.key); else marked.add(f.key);
        dirty = true; updateCount(); return;
      }
    }
    function updateCount() {
      if (!countUI) return;
      build2();
      const unit = new Map(); for (const f of faces) unit.set(f.key, f.area);      // each tappable face once (a gridded side is many cells but one face)
      let total = 0, got = 0; for (const [k, area] of unit) { total += area; if (marked.has(k)) got += area; }
      const done = total > 0 && got === total;
      countUI.className = 'v3d-count' + (done ? ' good' : '');
      MC.fill(countUI, h('span', { html: `Faces marked: <b>${got}</b> of <b>${total}</b> square units` }),
        h('span', { class: 'v3d-sub' }, done ? `✅ Every face counted → surface area = ${total}` : (cfg.countHint || 'Tap a face to mark it. Turn the solid over to reach the hidden ones!')));
      if (done && !state.celebrated && marked.size) { state.celebrated = true; MC.confetti && MC.confetti(60); }
      if (!done) state.celebrated = false;
      api.onCount && api.onCount({ got, total, done });
    }

    /* ---------------------------------------------------------------- public API */
    const api = {
      el: root,
      set(next) {
        if (next && next.xray != null) xray = !!next.xray;
        scene = Object.assign({ voxels: [], boxes: [], tint: null, grid: false, labels: null }, next || {});
        const sig = JSON.stringify([scene.voxels, scene.boxes]); if (sig !== api._sig) { marked.clear(); api._sig = sig; }
        scene.v = sig.length + ':' + (xray ? 1 : 0) + ':' + (scene.grid ? 1 : 0) + ':' + (scene.tint ? JSON.stringify(scene.voxels.map(scene.tint)) : '');
        fit(); builtFor = ''; dirty = true; if (cfg.count) updateCount();
      },
      view(name) {
        const v = VIEWS[name]; if (!v) return; stopAuto(); auto = false; spin.textContent = '▶ Spin';
        let y1 = v[0]; while (y1 - yaw > Math.PI) y1 -= Math.PI * 2; while (y1 - yaw < -Math.PI) y1 += Math.PI * 2;
        fly = { t: 0, y0: yaw, y1, p0: pitch, p1: v[1], z0: zoom, z1: 1 }; vyaw = vpitch = 0;
      },
      get camera() { return { yaw, pitch, zoom }; },
      get stage() { return stage; },
      faces: () => (state.drawn || []).filter((f) => f.facing && !f.cell).map((f) => ({ x: f.sx, y: f.sy, key: f.key, area: f.area, marked: marked.has(f.key) })),
      marked: () => marked.size,
      destroy() { live = false; root.remove(); },
    };
    api.set(cfg);
    canvas.__v3d = api;                                   // handy for tests and the console
    new Promise((r) => r()).then(() => { resize(); requestAnimationFrame(frame); });
    return api;
  };

  if (!document.getElementById('v3d-style')) {
    document.head.append(h('style', { id: 'v3d-style' }, `
      .v3d{margin:6px 0}
      .v3d-stage{position:relative;border-radius:18px;overflow:hidden;background:radial-gradient(120% 90% at 50% 20%,#ffffff 0%,#eef0ff 55%,#dfe3fb 100%);box-shadow:inset 0 0 0 3px #d9dcf5;touch-action:none}
      .v3d-canvas{display:block;width:100%;height:100%;cursor:grab;outline:none;touch-action:none}
      .v3d-canvas:active{cursor:grabbing}
      .v3d-canvas:focus-visible{box-shadow:inset 0 0 0 4px #ff8a3d}
      .v3d-hint{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);background:rgba(29,33,80,.82);color:#fff;font-weight:800;font-size:13px;padding:6px 14px;border-radius:999px;pointer-events:none;transition:opacity .5s}
      .v3d-hint.gone{opacity:0}
      .v3d-bar{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;margin:10px 0 4px}
      .v3d-group{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
      .v3d-cap{font-weight:800;font-size:12px;color:#666d96;text-transform:uppercase;letter-spacing:.06em}
      .v3d-chip{font:inherit;font-weight:800;font-size:14px;border:3px solid #c8cdf0;background:#fff;border-radius:12px;padding:5px 12px;cursor:pointer;color:#1d2150;min-height:40px}
      .v3d-chip:hover{border-color:#8b93e8}.v3d-chip.on{border-color:#4a54d8;background:#e6e9ff}
      .v3d-explode input{width:130px}
      .v3d-count{display:flex;flex-wrap:wrap;gap:4px 14px;align-items:baseline;background:#f6f5ff;border-radius:12px;padding:10px 14px;margin:6px 0;font-weight:700}
      .v3d-count b{font-family:var(--head,inherit);font-size:20px;color:#1d2150}
      .v3d-count.good{background:#d8f2e4;color:#0c5f3a}.v3d-sub{font-size:14px;color:#666d96}.v3d-count.good .v3d-sub{color:#0c5f3a}
      .v3d-switch{display:flex;gap:6px;margin:4px 0}
      @media (max-width:560px){.v3d-chip{padding:5px 9px}}
    `));
  }
})();
