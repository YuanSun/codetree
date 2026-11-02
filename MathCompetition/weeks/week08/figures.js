/* Week 8 figures & explorers used by questions (registered into MC.widgets). */
(function () {
  'use strict';
  const { h, svg } = MC;

  /* ----- grocery receipt (Gauss 2023 G7 Q10) ----- */
  MC.widgets.receipt = (root, spec) => {
    root.append(h('div', { class: 'receipt' }, spec.items.map(([n, p]) => h('div', {}, h('span', {}, n), h('span', {}, '$' + p.toFixed(2))))));
  };

  /* ----- simple bar chart (cumulative means) ----- */
  MC.widgets.barchart = (root, spec) => {
    const W = 380, H = 240, L = 44, B = 44, T = 14, R = 14;
    const data = spec.data, max = spec.ymax || 8;
    const bw = (W - L - R) / data.length;
    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', style: 'max-width:420px', role: 'img', 'aria-label': spec.alt || 'bar chart' });
    const y = (v) => H - B - (v / max) * (H - B - T);
    for (let v = 0; v <= max; v += spec.step || 2) {
      s.append(svg('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), stroke: '#dfe4fb', 'stroke-dasharray': v ? '4 4' : '0' }));
      s.append(svg('text', { x: L - 8, y: y(v) + 5, 'text-anchor': 'end', 'font-size': 13, fill: '#6b7194' }, v));
    }
    data.forEach((v, i) => {
      const x = L + i * bw + bw * 0.16;
      s.append(svg('rect', { x, y: y(v), width: bw * 0.68, height: H - B - y(v), fill: spec.color || '#8b5cf6', rx: 4, opacity: 0.9 }));
      s.append(svg('text', { x: x + bw * 0.34, y: y(v) - 5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, fill: '#1f2766' }, v));
      s.append(svg('text', { x: x + bw * 0.34, y: H - B + 18, 'text-anchor': 'middle', 'font-size': 14, fill: '#1c2145' }, i + 1));
    });
    s.append(svg('text', { x: (W + L) / 2, y: H - 6, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, fill: '#6b7194' }, spec.xlabel || ''));
    s.append(svg('text', { x: 12, y: (H - B) / 2 + 10, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, fill: '#6b7194', transform: `rotate(-90 12 ${(H - B) / 2 + 10})` }, spec.ylabel || ''));
    root.append(s);
  };

  /* ----- Betty & Ann in the park (Gauss 2017 G7 Q20) ----- */
  MC.widgets.park = (root, spec) => {
    const X0 = 50, Y0 = 34, SC = 0.5;                 // 600 m x 400 m  ->  300 x 200 px
    const px = ([mx, my]) => [X0 + mx * SC, Y0 + my * SC];
    // distance walked clockwise from the top-left corner -> point on the boundary (metres)
    const clockwise = (d) => { d = ((d % 2000) + 2000) % 2000;
      if (d < 600) return [d, 0]; if (d < 1000) return [600, d - 600]; if (d < 1600) return [600 - (d - 1000), 400]; return [0, 400 - (d - 1600)]; };

    const s = svg('svg', { viewBox: '0 0 420 290', width: '100%', style: 'max-width:440px', role: 'img', 'aria-label': 'Rectangular park, 600 m by 400 m, with points P to T on the bottom edge' });
    s.append(svg('rect', { x: X0, y: Y0, width: 600 * SC, height: 400 * SC, fill: '#eafaf2', stroke: '#1f2766', 'stroke-width': 3, rx: 4 }));
    ['P', 'Q', 'R', 'S', 'T'].forEach((n, i) => {
      const [x, y] = px([(i + 1) * 100, 400]);
      s.append(svg('circle', { cx: x, cy: y, r: 3.5, fill: '#1f2766' }), svg('text', { x, y: y + 18, 'text-anchor': 'middle', 'font-size': 14, 'font-style': 'italic', 'font-weight': 800, fill: '#1f2766' }, n));
    });
    s.append(svg('text', { x: X0, y: Y0 - 10, 'font-size': 13, 'font-weight': 800, fill: '#6b7194' }, 'Start'));
    s.append(svg('text', { x: X0 + 150, y: Y0 + 200 + 48, 'text-anchor': 'middle', 'font-size': 13, fill: '#6b7194' }, '600 m'));
    s.append(svg('text', { x: X0 + 308, y: Y0 + 105, 'font-size': 13, fill: '#6b7194' }, '400 m'));
    s.append(svg('text', { x: X0 + 90, y: Y0 + 18, 'font-size': 13, 'font-weight': 800, fill: '#e5484d' }, 'Betty →'));
    s.append(svg('text', { x: X0 + 8, y: Y0 + 90, 'font-size': 13, 'font-weight': 800, fill: '#3b82f6' }, 'Ann ↓'));
    const bDot = svg('circle', { r: 9, fill: '#e5484d', stroke: '#fff', 'stroke-width': 2 });
    const aDot = svg('circle', { r: 9, fill: '#3b82f6', stroke: '#fff', 'stroke-width': 2 });
    const place = (dB, dA) => { const [bx, by] = px(clockwise(dB)); const [ax, ay] = px(clockwise(2000 - dA)); bDot.setAttribute('cx', bx); bDot.setAttribute('cy', by); aDot.setAttribute('cx', ax); aDot.setAttribute('cy', ay); };
    place(0, 0);
    s.append(bDot, aDot);
    root.append(s);
    if (!spec.interactive) return;

    // ----- interactive part: pick a speed ratio and watch where they first meet
    const names = ['the bottom-left corner', 'P', 'Q', 'R', 'S', 'T', 'the bottom-right corner'];
    const out = h('div', { class: 'readout' });
    const inB = h('input', { type: 'number', min: 1, max: 30, value: 9, class: 'ans', style: { width: '80px' } });
    const inA = h('input', { type: 'number', min: 1, max: 30, value: 4, class: 'ans', style: { width: '80px' } });
    let raf = 0;
    const run = () => {
      const sb = MC.clamp(+inB.value || 1, 1, 30), sa = MC.clamp(+inA.value || 1, 1, 30);
      const meetB = (2000 * sb) / (sb + sa), meetA = 2000 - meetB;       // distances when they first meet
      cancelAnimationFrame(raf);
      const t0 = performance.now(), dur = 3200;
      out.replaceChildren(h('span', { class: 'pill' }, `Betty : Ann = ${sb} : ${sa}`));
      const tick = (now) => {
        const t = Math.min(1, (now - t0) / dur);
        place(meetB * t, meetA * t);
        if (t < 1) { raf = requestAnimationFrame(tick); return; }
        let where;
        if (meetA <= 400) where = 'on the left side';
        else if (meetA >= 1000) where = 'on the right side';
        else { const k = Math.floor((meetA - 400) / 100); where = `between ${names[k]} and ${names[k + 1]}`; }
        const good = meetA > 600 && meetA < 700;
        out.replaceChildren(
          h('span', { class: 'pill' }, `Betty : Ann = ${sb} : ${sa}`),
          h('span', { class: 'pill' }, `Ann walked ${Math.round(meetA)} m, Betty ${Math.round(meetB)} m`),
          h('span', { class: 'pill ' + (good ? 'good' : 'hot') }, `They meet ${where} ${good ? '✅ (between Q and R)' : '— not between Q and R'}`));
      };
      raf = requestAnimationFrame(tick);
    };
    const preset = (a, b) => h('button', { class: 'btn ghost small', onclick: () => { inB.value = a; inA.value = b; run(); } }, `${a} : ${b}`);
    root.append(
      h('div', { class: 'row', style: { marginTop: '10px' } }, 'Betty', inB, 'Ann', inA, h('button', { class: 'btn go small', onclick: run }, '▶ Go')),
      h('div', { class: 'row', style: { marginTop: '8px' } }, h('span', { class: 'muted' }, 'Try the answer choices:'), preset(5, 3), preset(9, 4), preset(11, 6), preset(12, 5), preset(17, 7)),
      out);
  };
})();
