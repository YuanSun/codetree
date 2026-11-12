/* Week 9 — small figures (facts table) and the explorers that open after a homework question is solved. */
(function () {
  'use strict';
  const { h } = MC;
  const range = (label, min, max, value, onInput, unit) => {
    const out = h('b', {}), inp = h('input', { type: 'range', min, max, step: 1, value });
    const sync = () => { out.textContent = `${inp.value}${unit || ''}`; };
    inp.oninput = () => { sync(); onInput(+inp.value); }; sync();
    return h('div', { class: 'slider', style: { display: 'grid', gridTemplateColumns: '150px 1fr 90px', gap: '10px', alignItems: 'center' } }, h('span', {}, label), inp, out);
  };
  const box = (el, ...kids) => el.append(h('div', { class: 'explorer-box' }, ...kids));

  MC.widgets.facts = (el, cfg) => el.append(h('table', { class: 'ex-table' }, cfg.rows.map(([a, b]) => h('tr', {}, h('td', {}, a), h('td', {}, h('b', {}, b))))));

  MC.widgets.bagdays = (el) => {
    const out = h('div', { class: 'readout' }), blocks = h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '3px', margin: '8px 0' } });
    let kg = 3.5;
    const draw = () => {
      const days = kg / 0.25;
      blocks.replaceChildren(...Array.from({ length: Math.round(days) }, (_, i) => h('span', { style: { width: '26px', height: '26px', borderRadius: '6px', background: '#8fbaff', display: 'grid', placeItems: 'center', fontSize: '12px', fontWeight: 800 } }, i + 1)));
      out.replaceChildren(h('span', { class: 'pill' }, `One bag = ${kg} kg`), h('span', { class: 'pill good' }, `${kg} ÷ 0.25 = ${kg} × 4 = ${days} days`));
    };
    box(el, h('p', { html: '<b>Each blue square = 0.25 kg = one day.</b> Change the bag size:' }), range('Kilograms in one bag', 1, 12, 7, (v) => { kg = v / 2; draw(); }, ' half-kg'), blocks, out);
    draw();
  };

  MC.widgets.treats = (el) => {
    const out = h('div', { class: 'readout' }), meter = h('div', { style: { height: '22px', background: '#e9e7ff', borderRadius: '11px', overflow: 'hidden', margin: '8px 0' } }, h('i', { style: { display: 'block', height: '100%', background: '#17b26a', transition: 'width .2s' } }));
    const draw = (c) => {
      const t = 2 * (30 - c) + 4 * c;
      meter.firstChild.style.width = Math.min(100, t) + '%'; meter.firstChild.style.background = t === 100 ? '#17b26a' : '#f59e0b';
      out.replaceChildren(h('span', { class: 'pill' }, `🐔 ${c} chickens × 4 = ${4 * c}`), h('span', { class: 'pill' }, `🦤 ${30 - c} emus × 2 = ${2 * (30 - c)}`), h('span', { class: 'pill ' + (t === 100 ? 'good' : 'hot') }, `total ${t} ${t === 100 ? '✅ exactly 100!' : t < 100 ? 'treats — too few' : 'treats — too many'}`));
    };
    box(el, h('p', { html: '<b>Start with 0 chickens (60 treats) and swap emus for chickens one at a time.</b> Each swap adds 2 treats:' }), range('Chickens', 0, 30, 0, draw), meter, out);
    draw(0);
  };

  MC.widgets.ballprice = (el) => {
    const out = h('div', { class: 'readout' });
    const draw = (b) => {
      const s = 100 - b, t = 2 * b + 3 * s;
      out.replaceChildren(h('span', { class: 'pill' }, `⚽ ball $${b} → 👕 shirt $${s}`), h('span', { class: 'pill' }, `2 balls + 3 shirts = $${t}`), h('span', { class: 'pill ' + (t === 262 ? 'good' : 'hot') }, t === 262 ? '✅ matches $262!' : t > 262 ? `$${t - 262} too much — try a dearer ball` : `$${262 - t} too little — try a cheaper ball`));
    };
    box(el, h('p', { html: '<b>Guess the ball price:</b> the shirt must make $100 with it. Every extra dollar on the ball takes a dollar off the total of cart 2.' }), range('Ball price', 0, 100, 50, draw, ' $'), out);
    draw(50);
  };

  MC.widgets.vendcombos = (el) => {
    const rows = [];
    for (let c = 0; c <= 13; c++) for (let e = 0; e <= 15; e++) if (3 * c + 2.5 * e === 40) rows.push([c, e]);
    box(el, h('p', { html: '<b>Chicken + egg sales must be $40</b> ($61 − $21 for cheese). Cheese sold = $21 ÷ $3 = 7. Every way that works:' }),
      h('table', { class: 'ex-table' }, h('tr', {}, ['Chicken sold', 'Egg sold', 'Sandwiches left'].map((t) => h('th', {}, t))), rows.map(([c, e]) => h('tr', {}, h('td', {}, c), h('td', {}, e), h('td', {}, 35 - c - e)))),
      h('p', { html: `Two ways fit and they leave <b>${rows.map(([c, e]) => 35 - c - e).join(' and ')}</b> sandwiches — only “the number of remaining sandwiches” tells them apart.` }));
  };
})();
