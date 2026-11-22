/* Sem 7 lesson — factor machine, level-the-bars, weighted blocks, fraction grid, clause detective, mood sorter.
 * Each lab = something to play with + a "guided" worked example where YOU do each step. */
(function () {
  'use strict';
  const { h, $, $$, gcd, shuffle } = MC;
  const WEEK = 'sem07', PAGE = 'lesson';
  const lcm = (a, b) => (a / gcd(a, b)) * b;
  const F = (s) => MC.fmt(s);
  const S = (tag, attrs, ...kids) => MC.svg(tag, attrs, ...kids);
  const primeColor = { 2: '#3b82f6', 3: '#ec6f9a', 5: '#17b26a', 7: '#f59e0b', 11: '#8b5cf6', 13: '#0ea5e9' };
  const pc = (p) => primeColor[p] || '#64748b';
  const sup = (e) => e === 1 ? '' : ({ 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' }[e] || '^' + e);
  const factor = (n) => { const f = {}; for (let p = 2; n > 1; p++) while (n % p === 0) { f[p] = (f[p] || 0) + 1; n /= p; } return f; };

  $$('.mission .ask, .mission .orig, .nova .say, .big-idea small').forEach((el) => { el.innerHTML = MC.fmt(el.innerHTML); });

  /* ------------------------------------------------------------ badges / progress */
  const SKILLS = {
    ppcm: { label: 'PPCM & PGCD', emoji: '🧬', color: '#8b5cf6', tasks: ['s7.factor', 's7.three', 's7.pair', 's7.beach'] },
    moy:  { label: 'Means',       emoji: '📊', color: '#f59e0b', tasks: ['s7.mean', 's7.two', 's7.march', 's7.game'] },
    frac: { label: 'Fractions',   emoji: '🍰', color: '#ec6f9a', tasks: ['s7.cake', 's7.juice'] },
    gram: { label: 'Subordonnées', emoji: '🔗', color: '#3b82f6', tasks: ['s7.clause', 's7.mood'] },
  };
  const BADGE_TEXT = {
    ppcm: 'Prime bricks: all of them for the PPCM, only the shared ones for the PGCD!',
    moy: 'Mean × how many = total. Missing numbers and weighted means: solved!',
    frac: 'A fraction OF a fraction is a multiplication. Fractions review done!',
    gram: 'Relative, complétive, circonstancielle — and indicatif or subjonctif. Clause detective!',
  };
  const isDone = (id) => !!(MC.store.get(WEEK, PAGE, id) || {}).done;
  function refreshSkills(announce) {
    const all = Object.values(SKILLS).flatMap((s) => s.tasks);
    MC.setProgress(Math.round((all.filter(isDone).length / all.length) * 100));
    MC.setSkillBar(Object.values(SKILLS).map((s) => ({ label: s.label, emoji: s.emoji, color: s.color, done: s.tasks.every(isDone) })));
    if (!announce) return;
    for (const [k, s] of Object.entries(SKILLS)) {
      if (s.tasks.every(isDone) && !MC.store.get(WEEK, 'lesson-meta', 'badge.' + k)) { MC.store.set(WEEK, 'lesson-meta', 'badge.' + k, { seen: 1 }); MC.badge(s.emoji, `${s.label} badge unlocked!`, BADGE_TEXT[k]); }
    }
  }
  const guided = (mount, id, cfg) => MC.guided($(mount), Object.assign({ week: WEEK, page: PAGE, id, onDone: () => refreshSkills(true) }, cfg));
  const num = (q, answer, ok, nudge, extra) => Object.assign({ q, type: 'number', answer, ok, nudge }, extra || {});
  const slider = (label, min, max, step, value, unit, onInput) => {
    const out = h('b', {}), inp = h('input', { type: 'range', min, max, step, value });
    const sync = () => { out.textContent = `${inp.value}${unit ? ' ' + unit : ''}`; };
    inp.oninput = () => { sync(); onInput(+inp.value); }; sync();
    return { row: h('div', { class: 'slider' }, h('span', {}, label), inp, out), inp, sync };
  };
  const pill = (t, cls) => h('span', { class: 'pill' + (cls ? ' ' + cls : ''), html: F(t) });
  const chipBtn = (text, on, fn, extra) => h('button', Object.assign({ class: on ? 'on' : '', onclick: fn }, extra || {}), text);

  /* a card game: show a card, tap the right button; wrong → hint, then the reason */
  function cardGame(root, cards, buttons, doneText, taskId, intro) {
    const card = h('div', { class: 'sorter-card' }), msg = h('div', { class: 'sorter-msg' }), count = h('div', { class: 'readout', style: { justifyContent: 'center' } });
    const btns = h('div', { class: 'sorter-btns' }, ...buttons.map((b) => h('button', { style: { background: b.color }, 'data-key': b.key, onclick: () => answer(b.key) }, b.label, h('small', {}, b.sub))));
    root.append(h('div', { class: 'sorter' }, count, card, btns, msg));
    let i = 0, wrongNow = 0, busy = false, mistakes = 0;
    const show = () => {
      if (i >= cards.length) {
        card.textContent = '🏆 Deck complete!'; btns.style.display = 'none'; msg.className = 'sorter-msg ok'; msg.textContent = doneText;
        count.replaceChildren(h('span', { class: 'pill good' }, `${cards.length} / ${cards.length}`));
        if (MC.award(WEEK, PAGE, taskId, 10, { mistakes })) MC.confetti(70); refreshSkills(true); return;
      }
      card.innerHTML = F(cards[i].html); card.classList.remove('deal'); void card.offsetWidth; card.classList.add('deal'); wrongNow = 0;
      count.replaceChildren(h('span', { class: 'pill' }, `Card ${i + 1} of ${cards.length}`)); msg.className = 'sorter-msg'; msg.textContent = i === 0 ? intro : '';
    };
    function answer(key) {
      if (busy || i >= cards.length) return;
      if (key === cards[i].key) { msg.className = 'sorter-msg ok'; msg.innerHTML = F('✅ ' + cards[i].why); busy = true; setTimeout(() => { i++; busy = false; show(); }, 1300); }
      else { wrongNow++; mistakes++; msg.className = 'sorter-msg bad'; msg.innerHTML = F('🤔 ' + (wrongNow > 1 ? cards[i].why : cards[i].hint)); }
    }
    show();
  }

  /* ============================================================== 1 · factor machine */
  const FM = { vals: [12, 20] };
  function labFactor() {
    const root = $('#factor-lab'), box = h('div'), out = h('div', { class: 'readout' });
    const presets = [[12, 20], [14, 16], [10, 21, 30], [48, 72], [12, 30, 42], [70, 42], [3, 5, 12]];
    const inputs = [0, 1, 2].map((i) => h('input', { type: 'number', min: 2, max: 999, placeholder: i === 2 ? 'optional' : '', 'aria-label': `number ${i + 1}`, oninput: read }));
    const bar = h('div', { class: 'chips2' }, ...presets.map((p) => chipBtn(p.join(', '), false, () => set(p))));
    root.append(bar, h('div', { class: 'chips2' }, ...inputs), box, out);
    function set(vals) { FM.vals = vals.slice(); inputs.forEach((inp, i) => { inp.value = vals[i] || ''; }); draw(); }
    function read() { FM.vals = inputs.map((i) => Math.round(+i.value)).filter((v) => v >= 2 && v <= 999); draw(); }
    function bubble(p, e) { return e ? h('span', { class: 'b', style: { '--c': pc(p) } }, p + sup(e)) : h('span', { class: 'none' }, '–'); }
    function draw() {
      const vals = FM.vals;
      [...bar.children].forEach((b, i) => b.classList.toggle('on', JSON.stringify(presets[i]) === JSON.stringify(vals)));
      if (vals.length < 2) { box.replaceChildren(h('p', { class: 'muted' }, 'Type at least two numbers (2 to 999).')); out.replaceChildren(); return; }
      const maps = vals.map(factor), ps = [...new Set(maps.flatMap((m) => Object.keys(m).map(Number)))].sort((a, b) => a - b);
      const mx = (p) => Math.max(...maps.map((m) => m[p] || 0)), mn = (p) => Math.min(...maps.map((m) => m[p] || 0));
      const tbl = h('table', { class: 'ftable' }, h('tr', {}, h('th'), ...ps.map((p) => h('th', {}, `prime ${p}`))),
        ...vals.map((v, i) => h('tr', {}, h('td', { class: 'n' }, v), ...ps.map((p) => h('td', {}, bubble(p, maps[i][p]))))),
        h('tr', { class: 'res ppcm' }, h('td', { class: 'n' }, 'PPCM'), ...ps.map((p) => h('td', {}, bubble(p, mx(p))))),
        h('tr', { class: 'res pgcd' }, h('td', { class: 'n' }, 'PGCD'), ...ps.map((p) => h('td', {}, bubble(p, mn(p))))));
      box.replaceChildren(tbl);
      const L = vals.reduce(lcm), G = vals.reduce(gcd), ex = (f) => ps.filter((p) => f(p)).map((p) => p + sup(f(p))).join(' × ') || '1';
      MC.fill(out, pill(`PPCM = ${ex(mx)} = <b>${L}</b>`, 'good'), pill(G === 1 ? 'PGCD = <b>1</b> (no shared prime)' : `PGCD = ${ex(mn)} = <b>${G}</b>`, 'good'),
        vals.length === 2 ? pill(`PPCM × PGCD = ${L} × ${G} = ${L * G} &nbsp;|&nbsp; ${vals[0]} × ${vals[1]} = ${vals[0] * vals[1]}`) : null);
    }
    set([12, 20]);
    guided('#factor-steps', 's7.factor', {
      finale: '🎉 <b>PGCD (12, 20) = 4</b> and <b>PPCM (12, 20) = 60</b>. PPCM → biggest power of every prime. PGCD → only shared primes, smallest power.',
      steps: [
        { type: 'action', q: 'Press the preset **12, 20** in the machine (or type them).', btn: 'Numbers are set', check: () => (FM.vals.length === 2 && FM.vals[0] === 12 && FM.vals[1] === 20) || 'Press the “12, 20” button, then check.', ok: '12 = 2² × 3 and 20 = 2² × 5.' },
        num('How many 2’s do **both** 12 and 20 have? (the shared power of 2)', 2, '**2** — both have 2².', 'Look at the “prime 2” column: 12 → 2², 20 → 2².'),
        num('**PGCD (12, 20)** = the shared bricks only: 2² =', 4, '**4**.', '2 × 2.'),
        num('**PPCM (12, 20)** = 2² × 3 × 5 =', 60, '**60**.', '4 × 3 × 5.'),
      ] });
  }
  function missionsFactor() {
    guided('#three-steps', 's7.three', {
      finale: '🎉 112 · 210 · 24 · 6. The same rule works for two or three numbers — try each in the machine to check.',
      steps: [
        num('**PPCM (14, 16)** — 14 = 2 × 7 and 16 = 2⁴. Biggest power of each prime:', 112, '**112** = 2⁴ × 7.', '16 × 7.'),
        num('**PPCM (10, 21, 30)** — every prime that appears (2, 3, 5, 7):', 210, '**210** = 2 × 3 × 5 × 7.', '2 × 3 × 5 × 7.'),
        num('**PGCD (48, 72)** — 48 = 2⁴ × 3 and 72 = 2³ × 3². Shared: smallest powers.', 24, '**24** = 2³ × 3.', '8 × 3.'),
        num('**PGCD (12, 30, 42)** — which primes are in ALL three?', 6, '**6** = 2 × 3.', '12 = 2²×3, 30 = 2×3×5, 42 = 2×3×7: shared 2 and 3.'),
      ] });
    guided('#pair-steps', 's7.pair', {
      finale: '🎉 For two numbers, <b>PPCM × PGCD = the product</b> of the numbers — a great way to check!',
      steps: [
        num('**PPCM (70, 42)** — 70 = 2 × 5 × 7 and 42 = 2 × 3 × 7:', 210, '**210**.', '2 × 3 × 5 × 7.'),
        num('**PGCD (70, 42)** — shared primes 2 and 7:', 14, '**14**.', '2 × 7.'),
        num('**210 × 14** =', 2940, '**2940**.', '210 × 10 = 2100, 210 × 4 = 840.'),
        num('**70 × 42** =', 2940, '**2940** — the same!', '70 × 40 = 2800, 70 × 2 = 140.'),
        { type: 'choice', q: 'So for **two** numbers, PPCM × PGCD equals their…', choices: ['sum', 'product', 'difference'], answer: 1, ok: '**product**. (Not true with three numbers.)' },
      ] });
    guided('#beach-steps', 's7.beach', {
      finale: '🎉 **60 days.** “Meet again” → PPCM (3, 5, 12) = 2² × 3 × 5 = 60.',
      steps: [
        { type: 'choice', q: '“When will they **meet again**?” Which tool?', choices: ['PPCM (smallest common multiple)', 'PGCD (biggest common divisor)'], answer: 0, ok: '“Again” → **PPCM**.', wrongMsgs: { 1: 'We are not sharing into groups: we want the first day all three are there.' } },
        num('A kid answers **15** (the PPCM of 3 and 5). Does Juliette (every 12 days) come on day 15? What is **15 ÷ 12**?', 1.25, '1.25 — not a whole number, so Juliette is not there.', '12 × 1 = 12, 12 × 2 = 24.'),
        num('After how many days do **all three** meet? PPCM (3, 5, 12):', 60, '**60 days.** Check: 60 ÷ 3 = 20, 60 ÷ 5 = 12, 60 ÷ 12 = 5 ✅', '12 = 2² × 3; add the 5: 2² × 3 × 5.'),
      ] });
  }

  /* ============================================================== 2 · level the bars */
  const MEAN = { c: 'a', x: 10, mean: 0, hit: false };
  const CASES = {
    a: { known: [12, 16, 22], mode: 'one', target: 15, label: 'a) 12, 16, 22, ? → mean 15' },
    b: { known: [43, 51, 26], mode: 'one', target: 48, label: 'b) 43, 51, 26, ? → mean 48' },
    c: { known: [52, 61, 70], mode: 'equal', target: 56, label: 'c) 52, 61, 70, ?, ? (equal) → mean 56' },
    d: { known: [73, 85, 90, 62, 84], mode: 'consec', target: 75, label: 'd) 73, 85, 90, 62, 84, ?, ? (consecutive) → mean 75' },
  };
  function labMean() {
    const root = $('#mean-lab'), box = h('div', { class: 'chart' }), out = h('div', { class: 'readout' });
    const pickCase = (k) => { MEAN.c = k; const t = CASES[k].target; sl.inp.max = t * 2; MEAN.x = t; sl.inp.value = t; sl.sync(); draw(); };
    const bar = h('div', { class: 'chips2' }, ...Object.entries(CASES).map(([k, c]) => chipBtn(c.label, k === MEAN.c, () => pickCase(k), { 'data-case': k })));
    const sl = slider('The missing number', 0, CASES[MEAN.c].target * 2, 0.5, CASES[MEAN.c].target, '', (v) => { MEAN.x = v; draw(); });
    MEAN.x = CASES[MEAN.c].target; root.append(bar, sl.row, box, out);
    MEAN.set = (k, v) => { pickCase(k); MEAN.x = v; sl.inp.value = v; sl.sync(); draw(); };
    function draw() {
      const c = CASES[MEAN.c], x = MEAN.x;
      [...bar.children].forEach((b) => b.classList.toggle('on', b.dataset.case === MEAN.c));
      const miss = c.mode === 'one' ? [x] : c.mode === 'equal' ? [x, x] : [x, x + 1], all = c.known.concat(miss), sum = all.reduce((a, b) => a + b, 0), mean = sum / all.length;
      MEAN.mean = mean; MEAN.hit = Math.abs(mean - c.target) < 1e-9;
      const W = 640, H = 230, base = 200, top = 16, n = all.length, bw = Math.min(56, (W - 60) / n - 8), X = (i) => 30 + i * ((W - 60) / n) + ((W - 60) / n - bw) / 2, ymax = Math.max(...c.known, c.target * 2.1) * 1.08, Y = (v) => base - (v / ymax) * (base - top);
      const parts = [S('line', { x1: 20, x2: W - 10, y1: base, y2: base, stroke: '#9aa0c8', 'stroke-width': 3 })];
      all.forEach((v, i) => {
        const gold = i >= c.known.length;
        parts.push(S('rect', { x: X(i), y: Y(v), width: bw, height: base - Y(v), rx: 6, fill: gold ? '#ffc83d' : '#6d83f2', stroke: '#1b1f5e', 'stroke-width': 2 }));
        parts.push(S('text', { x: X(i) + bw / 2, y: Y(v) - 5, 'font-size': 13, 'text-anchor': 'middle', fill: '#1b1f5e', 'font-weight': 800, stroke: '#fff', 'stroke-width': 4, 'paint-order': 'stroke' }, +(+v).toFixed(1)));
      });
      parts.push(S('line', { x1: 20, x2: W - 10, y1: Y(c.target), y2: Y(c.target), stroke: '#e5484d', 'stroke-width': 3, 'stroke-dasharray': '8 6' }), S('text', { x: W - 12, y: Y(c.target) - 5, 'font-size': 13, 'text-anchor': 'end', fill: '#b3261e', 'font-weight': 800 }, `target mean ${c.target}`));
      parts.push(S('line', { x1: 20, x2: W - 10, y1: Y(mean), y2: Y(mean), stroke: MEAN.hit ? '#17b26a' : '#1b1f5e', 'stroke-width': 4 }), S('text', { x: W - 12, y: Y(mean) + 18, 'font-size': 14, 'text-anchor': 'end', fill: MEAN.hit ? '#0c7a47' : '#1b1f5e', 'font-weight': 800, stroke: '#fff', 'stroke-width': 4, 'paint-order': 'stroke' }, `mean now ${+mean.toFixed(2)}`));
      box.replaceChildren(S('svg', { viewBox: `0 0 ${W} ${H}` }, ...parts));
      out.replaceChildren(pill(`total of all ${n} numbers = <b>${+sum.toFixed(2)}</b>`), pill(`mean = ${+sum.toFixed(2)} ÷ ${n} = <b>${+mean.toFixed(2)}</b>`, MEAN.hit ? 'good' : ''), pill(MEAN.hit ? '🎯 Mean hit! Look at the total: it is <b>target × ' + n + '</b>.' : `to hit ${c.target} the total must be <b>${c.target * n}</b>`, MEAN.hit ? 'good' : ''));
    }
    draw();
    guided('#mean-steps', 's7.mean', {
      finale: '🎉 <b>10, 72 and 52.</b> Always: <b>total = mean × how many</b>, then take away what you know.',
      steps: [
        num('**a)** The mean of **4** numbers is 15. What is their **total**?', 60, '**60** = 4 × 15.', 'Mean × how many.'),
        num('The three known numbers add to **12 + 16 + 22** =', 50, '**50**.', '12 + 16 = 28, then + 22.'),
        num('So the missing number is **60 − 50** =', 10, '**10** — check it in the lab (case a).', 'The total minus what you have.'),
        num('**b)** Mean 48 of 4 numbers → total **192**. Known: 43 + 51 + 26 = **120**. Missing =', 72, '**72**.', '192 − 120.'),
        num('**e)** The total is 3 900 and the mean is 75. How **many** numbers? (total ÷ mean)', 52, '**52** numbers (52 × 75 = 3 900).', 'Mean = total ÷ count, so count = total ÷ mean.'),
      ] });
    guided('#two-steps', 's7.two', {
      finale: '🎉 <b>c) 48.5 each · d) 65 and 66.</b> Find what the two missing numbers add to — then split it (equal) or use n + (n + 1) (consecutive).',
      steps: [
        num('**c)** 5 numbers, mean 56. The **total** is', 280, '**280**.', '5 × 56.'),
        num('52 + 61 + 70 =', 183, '**183**.', '52 + 61 = 113, then + 70.'),
        num('So the two missing numbers add to **280 − 183** =', 97, '**97**.', 'The total minus what you know.'),
        num('They are **equal** — each one is **97 ÷ 2** =', 48.5, '**48.5** — no rounding! Try it in the lab (case c).', 'Half of 97.', { tol: 0.001 }),
        num('**d)** 7 numbers, mean 75 → total **525**. Known: 73 + 85 + 90 + 62 + 84 = **394**. The two missing add to', 131, '**131**.', '525 − 394.'),
        num('They are **consecutive**: n and n + 1. Then 2n + 1 = 131. So the **smaller** number n is', 65, '**65** (2n = 130).', 'Take 1 away: 130, then half.'),
        num('And the bigger one, **n + 1**, is', 66, '**65 and 66**. Check in the lab (case d): the mean hits 75 ✅', '65 + 1.'),
      ] });
  }

  /* ============================================================== weighted blocks */
  const WM = { mode: 'march', x: 5000, mean: 0 };
  function labWeighted() {
    const root = $('#wmean-lab'), box = h('div', { class: 'chart' }), out = h('div', { class: 'readout' }), sl = slider('Score of game 19', 4000, 7000, 10, 5000, 'points', (v) => { WM.x = v; draw(); });
    const bar = h('div', { class: 'chips2' }, chipBtn('🌦️ March temperatures', true, () => setMode('march'), { 'data-m': 'march' }), chipBtn('🎮 Video game', false, () => setMode('game'), { 'data-m': 'game' }));
    root.append(bar, sl.row, box, out);
    function setMode(m) { WM.mode = m; draw(); }
    WM.set = (m, x) => { WM.mode = m; if (x != null) { WM.x = x; sl.inp.value = x; sl.sync(); } draw(); };
    function draw() {
      [...bar.children].forEach((b) => b.classList.toggle('on', b.dataset.m === WM.mode)); sl.row.style.display = WM.mode === 'game' ? '' : 'none';
      const rows = WM.mode === 'march' ? [[13, 5, '🌧️ rain'], [7, 0, '❄️ snow'], [10, 5.8, '☀️ sun']] : [[18, 4960, '18 games'], [1, WM.x, 'game 19']];
      const colors = ['#6d83f2', '#9ad0ff', '#ffc83d'], tw = rows.reduce((a, r) => a + r[0], 0), tot = rows.reduce((a, r) => a + r[0] * r[1], 0), mean = tot / tw; WM.mean = mean;
      const W = 640, H = 230, base = 200, top = 24, vmax = (WM.mode === 'march' ? 6.5 : 7200), Y = (v) => base - (v / vmax) * (base - top), sx = (W - 60) / tw;
      const parts = [S('line', { x1: 20, x2: W - 10, y1: base, y2: base, stroke: '#9aa0c8', 'stroke-width': 3 })]; let x0 = 30;
      rows.forEach((r, i) => {
        const w = Math.max(r[0] * sx, 6);
        parts.push(S('rect', { x: x0, y: Y(r[1]), width: w - 2, height: Math.max(base - Y(r[1]), 1), fill: colors[i % 3], stroke: '#1b1f5e', 'stroke-width': 2 }));
        parts.push(S('text', { x: x0 + w / 2, y: Y(r[1]) - 5, 'font-size': 12, 'text-anchor': 'middle', fill: '#1b1f5e', 'font-weight': 800 }, `${r[0]} × ${+(+r[1]).toFixed(1)}`));
        if (w > 44) parts.push(S('text', { x: x0 + w / 2, y: base + 16, 'font-size': 12, 'text-anchor': 'middle', fill: '#666d96', 'font-weight': 800 }, `${r[2]}`));
        x0 += w;
      });
      parts.push(S('line', { x1: 20, x2: W - 10, y1: Y(mean), y2: Y(mean), stroke: '#e5484d', 'stroke-width': 4 }), S('text', { x: 26, y: Y(mean) - 7, 'font-size': 14, fill: '#b3261e', 'font-weight': 800, stroke: '#fff', 'stroke-width': 4, 'paint-order': 'stroke' }, `mean ${+mean.toFixed(2)}`));
      box.replaceChildren(S('svg', { viewBox: `0 0 ${W} ${H + 10}` }, ...parts));
      out.replaceChildren(pill(rows.map((r) => `${r[0]} × ${+(+r[1]).toFixed(1)}`).join(' + ') + ` = <b>${+tot.toFixed(1)}</b>`), pill(`weights: ${rows.map((r) => r[0]).join(' + ')} = <b>${tw}</b>`), pill(`mean = ${+tot.toFixed(1)} ÷ ${tw} = <b>${+mean.toFixed(2)}</b>`, 'good'));
    }
    draw();
    guided('#march-steps', 's7.march', {
      finale: '🎉 <b>4.1 °C.</b> Not 3.6 (the mean of the three means): the 13 rainy days count more than the 7 snowy ones.',
      steps: [
        { type: 'action', q: 'Show the **March temperatures** blocks in the lab above.', btn: 'It is on March', check: () => WM.mode === 'march' || 'Press “March temperatures”.', ok: 'Widths = days, heights = °C.' },
        num('Total of the temperatures: **13 × 5 + 7 × 0 + 10 × 5.8** =', 123, '**123** (65 + 0 + 58).', '65 + 0 + 58.'),
        num('How many days in all? **13 + 7 + 10** =', 30, '**30** days.', '13 + 7 = 20.'),
        num('Mean temperature = **123 ÷ 30** =', 4.1, '**4.1 °C.**', '30 × 4 = 120, so a bit more than 4.', { tol: 0.001 }),
      ] });
    guided('#game-steps', 's7.game', {
      finale: '🎉 <b>5 720 points.</b> Work with the <b>totals</b>: 95 000 needed − 89 280 already = 5 720.',
      steps: [
        { type: 'action', q: 'Switch to the **video game** story and slide the score of game 19 until the **mean reaches 5 000**.', btn: 'The mean is 5 000', check: () => (WM.mode === 'game' && Math.abs(WM.mean - 5000) < 1e-6) || (WM.mode !== 'game' ? 'Press “Video game” first.' : `The mean is ${+WM.mean.toFixed(1)} — keep sliding (try big scores!).`), ok: 'You found it by sliding. Now see why with totals.' },
        num('Points so far: **18 × 4 960** =', 89280, '**89 280**.', '18 × 5 000 = 90 000, take away 18 × 40 = 720.'),
        num('Total needed after 19 games for a mean of 5 000: **19 × 5 000** =', 95000, '**95 000**.', '19 × 5 = 95, then × 1 000.'),
        num('Points needed in game 19: **95 000 − 89 280** =', 5720, '**5 720** points.', '95 000 − 89 000 = 6 000, then − 280.'),
      ] });
  }

  /* ============================================================== 3 · fraction of a fraction */
  const CK = { n1: 3, d1: 4, n2: 2, d2: 3 };
  function labCake() {
    const root = $('#cake-lab'), box = h('div', { class: 'chart' }), out = h('div', { class: 'readout' });
    const s = {
      n1: slider('1st fraction: top', 1, 4, 1, CK.n1, '', (v) => { CK.n1 = v; draw(); }), d1: slider('1st fraction: bottom', 1, 6, 1, CK.d1, '', (v) => { CK.d1 = v; draw(); }),
      n2: slider('2nd fraction: top', 1, 3, 1, CK.n2, '', (v) => { CK.n2 = v; draw(); }), d2: slider('2nd fraction: bottom', 1, 6, 1, CK.d2, '', (v) => { CK.d2 = v; draw(); }),
    };
    root.append(s.n1.row, s.d1.row, s.n2.row, s.d2.row, box, out);
    function clamp() { for (const [n, d] of [['n1', 'd1'], ['n2', 'd2']]) { s[n].inp.max = CK[d]; if (CK[n] > CK[d]) CK[n] = CK[d]; s[n].inp.value = CK[n]; s[n].sync(); } }
    CK.set = (a, b, c, d) => { CK.d1 = b; CK.d2 = d; CK.n1 = a; CK.n2 = c; s.d1.inp.value = b; s.d2.inp.value = d; s.d1.sync(); s.d2.sync(); draw(); };
    function draw() {
      clamp();
      const { n1, d1, n2, d2 } = CK, cw = Math.min(70, 560 / d1), ch = Math.min(46, 200 / d2), W = d1 * cw + 20, H = d2 * ch + 20, parts = [];
      for (let c = 0; c < d1; c++) for (let r = 0; r < d2; r++) {
        const inA = c < n1, inB = r < n2, fill = inA && inB ? '#ffc83d' : inA ? '#a9b8ff' : '#fff';
        parts.push(S('rect', { x: 10 + c * cw, y: 10 + r * ch, width: cw, height: ch, fill, stroke: '#1b1f5e', 'stroke-width': 1.5 }));
      }
      box.replaceChildren(S('svg', { viewBox: `0 0 ${Math.max(W, 120)} ${H}`, style: { maxWidth: Math.max(W, 120) * 1.4 + 'px', margin: '0 auto' } }, ...parts));
      const num_ = n1 * n2, den = d1 * d2, g = gcd(num_, den);
      out.replaceChildren(pill(`blue columns: [[${n1}/${d1}]] of the grid`), pill(`gold rows inside them: [[${n2}/${d2}]] <i>of that</i>`), pill(`gold pieces: <b>${num_}</b> of <b>${den}</b>`), pill(`[[${n1}/${d1}]] × [[${n2}/${d2}]] = [[${num_}/${den}]]${g > 1 ? ` = <b>[[${num_ / g}/${den / g}]]</b>` : ''}`, 'good'));
    }
    draw();
    guided('#cake-steps', 's7.cake', {
      finale: '🎉 <b>[[1/2]] of the whole cake.</b> “[[2/3]] <i>of</i> [[3/4]]” = [[2/3]] × [[3/4]] = [[6/12]] = [[1/2]].',
      steps: [
        { type: 'action', q: 'Set the lab to **[[3/4]]** (first fraction) and **[[2/3]]** (second fraction).', btn: 'Fractions are set', check: () => (CK.n1 === 3 && CK.d1 === 4 && CK.n2 === 2 && CK.d2 === 3) || 'First: top 3, bottom 4. Second: top 2, bottom 3.', ok: 'Blue = what is left of the cake. Gold = what you eat.' },
        { type: 'choice', q: '“You eat [[2/3]] **of** what is left.” The operation is…', choices: ['[[2/3]] + [[3/4]]', '[[3/4]] − [[2/3]]', '[[2/3]] × [[3/4]]'], answer: 2, ok: '“Of” means **×**.', wrongMsgs: { 0: 'You are not adding two cakes. “Of” means to take a part OF something.', 1: 'You are taking a part of the leftover, not subtracting fractions.' } },
        num('How many **gold** pieces are in the grid?', 6, '**6**.', 'Count the gold squares (3 columns × 2 rows).'),
        num('How many pieces in the **whole** grid?', 12, '**12** (4 × 3).', '4 columns × 3 rows.'),
        num('So you ate **6 out of 12** = (as a fraction, e.g. 1/2)', 0.5, '**[[1/2]]** of the whole cake.', 'Simplify [[6/12]].', { tol: 0.001 }),
      ] });
    guided('#juice-steps', 's7.juice', {
      finale: '🎉 Each friend drinks <b>[[17/24]] L</b>: total [[17/6]] L, shared by 4.',
      steps: [
        num('4 bottles of [[1/3]] L: **4 × [[1/3]]** = (e.g. 4/3)', 4 / 3, '**[[4/3]]** L of orange juice.', '4 × 1 over 3.'),
        num('3 bottles of [[1/2]] L: **3 × [[1/2]]** = (e.g. 3/2 or 1.5)', 1.5, '**[[3/2]]** L of apple juice.', '3 × 1 over 2.'),
        { type: 'choice', q: 'To add [[4/3]] + [[3/2]] you need a common denominator. The smallest is the…', choices: ['PGCD of 3 and 2', 'PPCM of 3 and 2'], answer: 1, ok: '**PPCM** (3, 2) = 6.', wrongMsgs: { 0: 'A common denominator is a common MULTIPLE.' } },
        num('[[4/3]] = [[?/6]]. The top is', 8, '[[4/3]] = [[8/6]].', 'Multiply top and bottom by 2.'),
        num('[[3/2]] = [[?/6]]. The top is', 9, '[[3/2]] = [[9/6]].', 'Multiply top and bottom by 3.'),
        num('Total: [[8/6]] + [[9/6]] = (e.g. 17/6)', 17 / 6, '**[[17/6]]** L together.', '8 + 9 = 17 over 6.'),
        num('Shared between **4** friends: [[17/6]] ÷ 4 = (e.g. 17/24)', 17 / 24, '**[[17/24]]** L each.', 'Dividing by 4 multiplies the bottom by 4: 6 × 4.'),
      ] });
  }

  /* ============================================================== 4 · clauses */
  function labClauses() {
    const cards = shuffle([
      ['Je suppose <b>qu’elle est allée faire des courses.</b>', 'compl', 'After a verb of thinking (*je suppose*) the clause answers “what?” — replace it by *ça*: <i>Je suppose ça.</i> → complétive.'],
      ['L’auteur <b>dont tu m’as parlé</b> est célèbre.', 'rel', '*dont* replaces *l’auteur* (“tu m’as parlé de l’auteur”) → relative.'],
      ['Elle crie très fort <b>afin que quelqu’un l’entende.</b>', 'circ', '*afin que* = PURPOSE (why she shouts) — a conjunction from the list → circonstancielle.'],
      ['Les deux hommes discutaient <b>pendant que Rémi les écoutait.</b>', 'circ', '*pendant que* = TIME → circonstancielle.'],
      ['Je crois <b>qu’il ne reviendra plus.</b>', 'compl', '<i>Je crois ça.</i> → complétive.'],
      ['L’enfant <b>que tu as vu</b> est sérieux.', 'rel', '*que* replaces *l’enfant* (“tu as vu l’enfant”) → relative.'],
      ['Je remarque <b>que tu n’as pas fait ton devoir.</b>', 'compl', '<i>Je remarque ça.</i> → complétive.'],
      ['La porte était fermée avec un cadenas <b>afin que l’enfant ne puisse pas manger.</b>', 'circ', '*afin que* = PURPOSE → circonstancielle.'],
      ['Il fallait atteindre la ville <b>avant que le soir ne tombe.</b>', 'circ', '*avant que* = TIME → circonstancielle.'],
      ['Le village, <b>duquel nous sommes partis</b>, est très loin de la ville.', 'rel', '*duquel* replaces *le village* (“nous sommes partis du village”) → relative.'],
    ].map(([html, key, why]) => ({ html, key, why, hint: 'Try the three tests: does it DESCRIBE a noun? Can you replace it by <i>ça</i>? Does it start with a conjunction of time / purpose / cause?' })));
    cardGame($('#clause-lab'), cards, [
      { key: 'rel', label: '🔗 Relative', sub: 'describes a noun · qui, que, dont…', color: 'linear-gradient(180deg,#60a5fa,#1d4ed8)' },
      { key: 'compl', label: '📦 Complétive', sub: 'replace it by ça', color: 'linear-gradient(180deg,#a78bfa,#6d28d9)' },
      { key: 'circ', label: '🕐 Circonstancielle', sub: 'conjunction: time, purpose…', color: 'linear-gradient(180deg,#34d399,#047857)' },
    ], 'You can tell the three clauses apart!', 's7.clause', 'Which kind of clause is the bold part?');

    const ind = ['après que', 'aussitôt que', 'comme', 'depuis que', 'dès que', 'parce que', 'pendant que', 'puisque', 'quand', 'si', 'même si', 'étant donné que'];
    const sub = ['à condition que', 'afin que', 'à moins que', 'avant que', 'bien que', 'jusqu’à ce que', 'pour que', 'pourvu que', 'quoique', 'sans que', 'de crainte que', 'en attendant que'];
    const both = ['de façon que', 'de manière que', 'de sorte que', 'en sorte que'];
    const pick = (a, n) => shuffle(a.slice()).slice(0, n);
    const deck = shuffle([...pick(ind, 5).map((w) => ({ w, key: 'ind', why: `*${w}* is followed by the <b>indicatif</b>.` })), ...pick(sub, 5).map((w) => ({ w, key: 'sub', why: `*${w}* is followed by the <b>subjonctif</b>.` })),
      ...pick(both, 2).map((w) => ({ w, key: 'both', why: `*${w}* takes <b>either</b>: result (conséquence) → indicatif · purpose (but) → subjonctif.` }))]);
    cardGame($('#mood-lab'), deck.map((d) => ({ html: `<b>${d.w}</b> …`, key: d.key, why: d.why, hint: 'Think about the meaning: a real fact (indicatif) or a wish / purpose / doubt / condition (subjonctif)? Some take both.' })), [
      { key: 'ind', label: 'Indicatif', sub: 'real facts', color: 'linear-gradient(180deg,#60a5fa,#1d4ed8)' },
      { key: 'sub', label: 'Subjonctif', sub: 'purpose · doubt · condition', color: 'linear-gradient(180deg,#f472b6,#be185d)' },
      { key: 'both', label: 'Les deux', sub: 'depends on the meaning', color: 'linear-gradient(180deg,#fbbf24,#b45309)' },
    ], 'You know which mood each conjunction commands!', 's7.mood', 'After this conjunction, which mood?');
  }

  labFactor(); missionsFactor(); labMean(); labWeighted(); labCake(); labClauses();
  refreshSkills(false);
})();
