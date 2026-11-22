/* Sem 8 lesson — number line, sign machine, power parser, timeline, tout machine.
 * Each lab = something to play with + a "guided" worked example where YOU do each step. */
(function () {
  'use strict';
  const { h, $, $$ } = MC;
  const WEEK = 'sem08', PAGE = 'lesson';
  const F = (s) => MC.fmt(s);
  const S = (tag, attrs, ...kids) => MC.svg(tag, attrs, ...kids);
  const sg = (n) => (n < 0 ? '−' + Math.abs(n) : String(n));          // typographic minus
  const br = (n) => (n < 0 ? `(${sg(n)})` : String(n));

  $$('.mission .ask, .mission .orig, .nova .say, .big-idea small').forEach((el) => { el.innerHTML = MC.fmt(el.innerHTML); });

  /* ------------------------------------------------------------ badges / progress */
  const SKILLS = {
    rel:  { label: 'Negative numbers', emoji: '➕', color: '#3b82f6', tasks: ['s8.line', 's8.chain', 's8.signs', 's8.mix'] },
    pow:  { label: 'Powers',           emoji: '🔺', color: '#8b5cf6', tasks: ['s8.pow', 's8.mix2', 's8.compare'] },
    time: { label: 'Timeline',         emoji: '🏛️', color: '#f59e0b', tasks: ['s8.time'] },
    tout: { label: 'Tout',             emoji: '🦎', color: '#10b981', tasks: ['s8.tout1', 's8.tout2', 's8.tout3'] },
  };
  const BADGE_TEXT = {
    rel: 'Same signs → +, different signs → −. Negative numbers are yours!',
    pow: 'Brackets decide what is raised to the power. Powers badge!',
    time: 'End year − start year, even before Christ. Timeline badge!',
    tout: 'Déterminant, pronom or adverbe — you can tame tout!',
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
    const sync = () => { out.textContent = `${sg(+inp.value)}${unit ? ' ' + unit : ''}`; };
    inp.oninput = () => { sync(); onInput(+inp.value); }; sync();
    return { row: h('div', { class: 'slider' }, h('span', {}, label), inp, out), inp, sync };
  };
  const pill = (t, cls) => h('span', { class: 'pill' + (cls ? ' ' + cls : ''), html: F(t) });
  const chipBtn = (text, on, fn, extra) => h('button', Object.assign({ class: on ? 'on' : '', onclick: fn }, extra || {}), text);

  /* ============================================================== 1 · number-line walker */
  const NL = { a: 4, op: '−', b: 7, res: -3 };
  function labLine() {
    const root = $('#line-lab'), box = h('div', { class: 'chart' }), out = h('div', { class: 'readout' });
    const sa = slider('First number', -20, 20, 1, NL.a, '', (v) => { NL.a = v; draw(); }), sb = slider('Second number', -20, 20, 1, NL.b, '', (v) => { NL.b = v; draw(); });
    const ops = h('div', { class: 'chips2' }, ...['+', '−'].map((o) => chipBtn(o, o === NL.op, () => { NL.op = o; draw(); }, { 'data-op': o })));
    const pre = h('div', { class: 'chips2' }, ...[[4, '−', 7], [-2, '+', 4], [9, '−', -3], [9, '+', -3], [-9, '−', 15]].map((p) => chipBtn(`${br(p[0])} ${p[1]} ${br(p[2])}`, false, () => set(...p))));
    root.append(pre, sa.row, ops, sb.row, box, out);
    function set(a, op, b) { NL.a = a; NL.op = op; NL.b = b; sa.inp.value = a; sb.inp.value = b; sa.sync(); sb.sync(); draw(); }
    function draw() {
      [...ops.children].forEach((c) => c.classList.toggle('on', c.dataset.op === NL.op));
      const { a, op, b } = NL, res = op === '+' ? a + b : a - b, move = op === '+' ? b : -b; NL.res = res;
      const W = 640, H = 150, X = (v) => 20 + ((v + 40) / 80) * 600, y = 90, parts = [S('line', { x1: 20, x2: 620, y1: y, y2: y, stroke: '#9aa0c8', 'stroke-width': 4, 'stroke-linecap': 'round' })];
      for (let v = -40; v <= 40; v += 10) { parts.push(S('line', { x1: X(v), x2: X(v), y1: y - 8, y2: y + 8, stroke: v === 0 ? '#1b1f5e' : '#9aa0c8', 'stroke-width': v === 0 ? 4 : 2 }), S('text', { x: X(v), y: y + 28, 'font-size': 13, 'text-anchor': 'middle', fill: '#666d96', 'font-weight': 800 }, sg(v))); }
      const mid = (X(a) + X(res)) / 2, lift = Math.min(70, 20 + Math.abs(X(res) - X(a)) / 4);
      parts.push(S('path', { d: `M${X(a)} ${y - 6} Q${mid} ${y - 6 - lift * 1.6} ${X(res)} ${y - 6}`, fill: 'none', stroke: move >= 0 ? '#17b26a' : '#e5484d', 'stroke-width': 5, 'stroke-linecap': 'round' }));
      parts.push(S('circle', { cx: X(a), cy: y, r: 9, fill: '#6d83f2', stroke: '#1b1f5e', 'stroke-width': 3 }), S('circle', { cx: X(res), cy: y, r: 10, fill: '#ffc83d', stroke: '#1b1f5e', 'stroke-width': 3 }));
      parts.push(S('text', { x: X(a), y: y - 18, 'font-size': 13, 'text-anchor': 'middle', fill: '#1b1f5e', 'font-weight': 800 }, `start ${sg(a)}`), S('text', { x: X(res), y: y + 52, 'font-size': 14, 'text-anchor': 'middle', fill: '#a66a00', 'font-weight': 800 }, `end ${sg(res)}`));
      box.replaceChildren(S('svg', { viewBox: `0 0 ${W} ${H}` }, ...parts));
      let rewrite = '';
      if (op === '−' && b < 0) rewrite = `${sg(a)} − (${sg(b)}) = ${sg(a)} + ${Math.abs(b)}  <small>(− − = +)</small>`;
      else if (op === '+' && b < 0) rewrite = `${sg(a)} + (${sg(b)}) = ${sg(a)} − ${Math.abs(b)}  <small>(+ − = −)</small>`;
      MC.fill(out, pill(`${br(a)} ${op} ${br(b)} = <b>${sg(res)}</b>`, 'good'), pill(move >= 0 ? `walk <b>${Math.abs(move)}</b> to the right ➡️` : `walk <b>${Math.abs(move)}</b> to the left ⬅️`), rewrite ? pill(rewrite) : null);
    }
    draw();
    guided('#line-steps', 's8.line', {
      finale: '🎉 <b>−3, −2, 2, −24</b> — and the two sign rules: <b>− (−) = +</b> and <b>+ (−) = −</b>.',
      steps: [
        { type: 'action', q: 'Set the walker to **4 − 7** (use the preset or the sliders).', btn: 'It is set', check: () => (NL.a === 4 && NL.op === '−' && NL.b === 7) || 'First number 4, press −, second number 7.', ok: 'The walker starts at 4 and walks 7 to the left.' },
        num('**4 − 7** =', -3, '**−3**: 4 steps reach 0, 3 more go below.', 'Walk 7 to the left from 4.'),
        num('**3 − 5** =', -2, '**−2**.', '3 steps reach zero, 2 more.'),
        num('**−2 + 4** =', 2, '**2**.', 'Start at −2 and walk 4 to the right.'),
        num('**−9 − 15** =', -24, '**−24**: both push you down, so add the sizes.', '9 + 15 = 24, keep the minus.'),
        num('Example 11: **9 − (−3)** = 9 + 3 =', 12, '**12** — minus a negative is a plus.', 'Try it in the walker: 9, −, −3.'),
        num('Example 12: **9 + (−3)** = 9 − 3 =', 6, '**6** — plus a negative is a minus.', 'Try it in the walker: 9, +, −3.'),
      ] });
    guided('#chain-steps', 's8.chain', {
      finale: '🎉 <b>−252</b> and <b>34</b>. Go left to right, one step at a time, and rewrite “+ −” as “−” and “− −” as “+”.',
      steps: [
        num('**−77 − 88** =', -165, '**−165**.', '77 + 88 = 165, keep the minus.'),
        num('**−165 − 65** =', -230, '**−230**.', '165 + 65.'),
        num('**−230 + (−22)** = −230 − 22 =', -252, '**−252**.', '230 + 22.'),
        num('Example 13: **−66 + 45** =', -21, '**−21**.', '66 − 45 = 21, with the minus (the bigger number is negative).'),
        num('**−21 − (−55)** = −21 + 55 =', 34, '**34**.', '55 − 21.'),
      ] });
  }

  /* ============================================================== 2 · sign machine */
  function labSigns() {
    const root = $('#sign-lab'), st = { sa: '+', sb: '−', op: '×', n: 4, k: 2 }, out = h('div', { class: 'readout' }), out2 = h('div', { class: 'readout' });
    const row1 = h('div', { class: 'chips2' }), row2 = h('div', { class: 'chips2' });
    const mk = (key, vals, label) => { const g = h('span', {}, label + ' '); vals.forEach((v) => g.append(chipBtn(v, st[key] === v, () => { st[key] = v; draw(); }, { 'data-k': key, 'data-v': v }))); return g; };
    row1.append(mk('sa', ['+', '−'], '1st sign'), mk('op', ['×', '÷'], 'op'), mk('sb', ['+', '−'], '2nd sign'));
    const sn = slider('How many factors', 2, 7, 1, st.n, '', (v) => { st.n = v; if (st.k > v) { st.k = v; sk.inp.value = v; sk.sync(); } sk.inp.max = v; draw(); });
    const sk = slider('How many are negative', 0, 7, 1, st.k, '', (v) => { st.k = Math.min(v, st.n); draw(); });
    root.append(h('p', { class: 'muted', html: '<b>Two numbers</b> (6 and 3):' }), row1, out, h('p', { class: 'muted', html: '<b>Many factors</b> (each is 2):' }), sn.row, sk.row, out2);
    function draw() {
      [...row1.querySelectorAll('button')].forEach((b) => b.classList.toggle('on', st[b.dataset.k] === b.dataset.v));
      const a = st.sa === '−' ? -6 : 6, b = st.sb === '−' ? -3 : 3, r = st.op === '×' ? a * b : a / b, same = st.sa === st.sb;
      MC.fill(out, pill(`${br(a)} ${st.op} ${br(b)} = <b>${sg(r)}</b>`, 'good'), pill(same ? 'same signs → <b>+</b>' : 'different signs → <b>−</b>'));
      const k = Math.min(st.k, st.n), facs = Array.from({ length: st.n }, (_, i) => (i < k ? '(−2)' : '2')).join(' × '), val = (k % 2 ? -1 : 1) * 2 ** st.n;
      MC.fill(out2, pill(`${facs} = <b>${sg(val)}</b>`, 'good'), pill(`${k} negative${k === 1 ? '' : 's'}: ${k % 2 ? '<b>odd</b> → negative' : '<b>even</b> → positive'}`));
    }
    sk.inp.max = st.n; draw();
  }
  function missionsSigns() {
    guided('#signs-steps', 's8.signs', {
      finale: '🎉 <b>−6, −5, −30 and 60.</b> Count the negative signs: even → +, odd → −.',
      steps: [
        num('**2 × −3** =', -6, '**−6** — different signs.', '2 × 3 = 6, then the sign.'),
        num('**−35 ÷ 7** =', -5, '**−5** — different signs.', '35 ÷ 7 = 5.'),
        num('Example 8: **−3 × −2** =', 6, '**6** — two negatives make a positive.', '3 × 2.'),
        num('**6 × −5** =', -30, '**−30**.', '6 × 5 = 30, different signs.'),
        num('Example 9: **−3 × −2 × −5 × −2** — how many **negative** factors?', 4, '**4**.', 'Count the minus signs.'),
        num('Four negatives (even) → positive. The product is', 60, '**60** (3 × 2 × 5 × 2 = 60).', '3 × 2 × 5 × 2.'),
      ] });
    guided('#mix-steps', 's8.mix', {
      finale: '🎉 <b>91</b> and <b>43</b>. Order: brackets, then × ÷, then + −. Minus a negative is a plus.',
      steps: [
        num('**−12 × −8** =', 96, '**96**.', 'Two negatives: positive. 12 × 8.'),
        num('**96 + (−15)** = 96 − 15 =', 81, '**81**.', '96 − 15.'),
        num('**81 − (−10)** = 81 + 10 =', 91, '**91**.', 'Minus a negative → plus.'),
        num('Example 14: brackets first, **−15 + −2** =', -17, '**−17**.', '−15 − 2.'),
        num('**−17 × −3** =', 51, '**51**.', '17 × 3 = 51, two negatives → positive.'),
        num('**51 + (−8)** = 51 − 8 =', 43, '**43**.', '51 − 8.'),
      ] });
  }

  /* ============================================================== 3 · powers */
  function labPow() {
    const root = $('#pow-lab'), st = { b: -5, n: 2 }, out = h('div', { class: 'pow2' });
    const sb = slider('Base', -9, 9, 1, st.b, '', (v) => { st.b = v; draw(); }), sn = slider('Power', 0, 6, 1, st.n, '', (v) => { st.n = v; draw(); });
    root.append(sb.row, sn.row, out);
    function draw() {
      const { b, n } = st, a = Math.abs(b), pw = b ** n, nb = -(a ** n);
      const exp = (base) => (n === 0 ? '= 1' : n <= 4 ? '= ' + Array(n).fill(br(base)).join(' × ') : `= ${n} factors of ${br(base)}`);
      const card = (title, expr, line, val) => h('div', { class: 'powcard' }, h('h4', {}, title), h('div', { class: 'big' }, expr), h('div', { class: 'muted', html: line }), h('div', { class: 'res ' + (val < 0 ? 'neg' : 'pos') }, '= ' + sg(val)));
      const sup = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶' }[n];
      MC.fill(out, card('WITH brackets: the base is the whole (negative) number', `(${sg(b)})${sup}`, `${exp(b)}`, pw),
        b < 0 ? card('WITHOUT brackets: only the number is raised, then the minus', `−${a}${sup}`, `= −(${n === 0 ? '1' : n <= 4 ? Array(n).fill(a).join(' × ') : n + ' factors of ' + a})`, nb)
          : card('Positive base: no difference', `${b}${sup}`, `${exp(b)}`, pw));
      if (b === 0 && n === 0) out.append(h('p', { class: 'muted' }, '0⁰ is not used here.'));
    }
    draw();
  }
  function missionsPow() {
    guided('#pow-steps', 's8.pow', {
      finale: '🎉 <b>−25 · 25 · −27 · −32 · −32.</b> With brackets the minus is raised too; without, only the number is raised.',
      steps: [
        num('Example c: **−5²** = −(5 × 5) =', -25, '**−25** — no brackets: only the 5 is squared.', '5 × 5 = 25, then the minus.'),
        num('Example d: **(−5)²** = −5 × −5 =', 25, '**25** — brackets: the base is −5.', 'Two negatives make a positive.'),
        num('Example e: **(−3)³** = −3 × −3 × −3 =', -27, '**−27**: 9 × −3.', '(−3) × (−3) = 9, then × (−3).'),
        num('Exercice 2 · 1: **(−2)⁵** =', -32, '**−32** — 5 negatives (odd).', '2⁵ = 32, odd power keeps the minus.'),
        num('Exercice 2 · 2: **−2⁵** =', -32, '**−32** — same result here, because 5 is odd. (Try base −2, power 4 in the lab: the two forms differ!)', '−(2⁵).'),
        { type: 'choice', q: 'With brackets, (−2)^n is negative when n is…', choices: ['even', 'odd'], answer: 1, ok: '**odd**: an odd number of negative factors.', wrongMsgs: { 0: 'Try (−2)² in the lab: 4, positive.' } },
      ] });
    guided('#mix2-steps', 's8.mix2', {
      finale: '🎉 <b>33 · −12 · 19 · 0.</b> Powers first, then × ÷, then + −.',
      steps: [
        num('Exercice 2 · 3: **−(−33)** =', 33, '**33**.', 'Minus a negative.'),
        num('Exercice 2 · 4: **−(−(−12))** — inside first: −(−12) = 12. Then −12 =', -12, '**−12** (three minus signs: odd → negative).', '−(12).'),
        num('Exercice 2 · 5: brackets, **(−15 + −2) × −3** = −17 × −3 =', 51, '**51**.', '17 × 3.'),
        num('…and the power **(−2)⁵** =', -32, '**−32**.', 'Five negative factors.'),
        num('So **51 + (−32)** =', 19, '**19**.', '51 − 32.'),
        num('Exercice 2 · 6: **−(−2)⁴** — first (−2)⁴ = 16, then the minus:', -16, '**−16**.', '(−2)⁴ = 16.'),
        num('**−3²** (no brackets) =', -9, '**−9**.', '−(3 × 3).'),
        num('**(−5)²** =', 25, '**25**. Total: −16 + (−9) + 25 = **0**.', '(−5) × (−5).'),
      ] });
    const cmp = (q, ans, ok) => ({ type: 'choice', q, choices: ['<', '=', '>'], answer: ans, ok, wrongMsgs: { 0: 'Compute each side first, then compare on the number line.', 1: 'Compute each side first, then compare on the number line.', 2: 'Compute each side first, then compare on the number line.' } });
    guided('#compare-steps', 's8.compare', {
      finale: '🎉 <b>= · &lt; · &gt; · &gt;.</b> Compute both sides, then compare.',
      steps: [
        cmp('a) **(−4)³** ___ **−4³**', 1, '(−4)³ = −64 and −4³ = −(4 × 4 × 4) = −64 → **=**'),
        cmp('b) **−7²** ___ **(−7)²**', 0, '−7² = −49 and (−7)² = 49 → −49 **<** 49'),
        cmp('c) **−(−3)³** ___ **−3³**', 2, '(−3)³ = −27 so −(−3)³ = 27; −3³ = −27 → 27 **>** −27'),
        cmp('d) **(−8)⁰** ___ **−8⁰**', 2, '(−8)⁰ = 1 and −8⁰ = −(8⁰) = −1 → 1 **>** −1'),
      ] });
  }

  /* ============================================================== 4 · timeline */
  const TL = { b: -72, d: -46 };
  function labTime() {
    const root = $('#time-lab'), box = h('div', { class: 'chart' }), out = h('div', { class: 'readout' });
    const sb = slider('Born in', -350, 40, 1, TL.b, '', (v) => { TL.b = v; if (TL.d < v) { TL.d = v; sd.inp.value = v; sd.sync(); } draw(); });
    const sd = slider('Died in', -350, 50, 1, TL.d, '', (v) => { TL.d = Math.max(v, TL.b); sd.inp.value = TL.d; sd.sync(); draw(); });
    const pre = h('div', { class: 'chips2' }, chipBtn('Vercingétorix', false, () => set(-72, -46)), chipBtn('Euclide', false, () => set(-323, -283)));
    root.append(pre, sb.row, sd.row, box, out);
    function set(b, d) { TL.b = b; TL.d = d; sb.inp.value = b; sd.inp.value = d; sb.sync(); sd.sync(); draw(); }
    function draw() {
      const { b, d } = TL, X = (v) => 20 + ((v + 350) / 400) * 600, y = 90, parts = [S('line', { x1: 20, x2: 620, y1: y, y2: y, stroke: '#9aa0c8', 'stroke-width': 4, 'stroke-linecap': 'round' })];
      for (let v = -350; v <= 50; v += 50) parts.push(S('line', { x1: X(v), x2: X(v), y1: y - 7, y2: y + 7, stroke: v === 0 ? '#1b1f5e' : '#9aa0c8', 'stroke-width': v === 0 ? 4 : 2 }), S('text', { x: X(v), y: y + 26, 'font-size': 12, 'text-anchor': 'middle', fill: '#666d96', 'font-weight': 800 }, sg(v)));
      parts.push(S('text', { x: X(0), y: y - 14, 'font-size': 12, 'text-anchor': 'middle', fill: '#1b1f5e', 'font-weight': 800 }, 'Jésus-Christ'),
        S('line', { x1: X(b), x2: X(d), y1: y, y2: y, stroke: '#ffc83d', 'stroke-width': 10, 'stroke-linecap': 'round', opacity: 0.9 }),
        S('circle', { cx: X(b), cy: y, r: 9, fill: '#6d83f2', stroke: '#1b1f5e', 'stroke-width': 3 }), S('circle', { cx: X(d), cy: y, r: 9, fill: '#e5484d', stroke: '#1b1f5e', 'stroke-width': 3 }),
        S('text', { x: X(b), y: y + 52, 'font-size': 13, 'text-anchor': 'middle', fill: '#1b1f5e', 'font-weight': 800 }, `born ${sg(b)}`), S('text', { x: X(d), y: y + 70, 'font-size': 13, 'text-anchor': 'middle', fill: '#b3261e', 'font-weight': 800 }, `died ${sg(d)}`));
      box.replaceChildren(S('svg', { viewBox: '0 0 640 170' }, ...parts));
      const rew = b < 0 ? `${sg(d)} − (${sg(b)}) = ${sg(d)} + ${Math.abs(b)}` : `${sg(d)} − ${b}`;
      MC.fill(out, pill(`years lived = died − born = ${rew} = <b>${d - b}</b>`, 'good'));
    }
    draw();
    guided('#time-steps', 's8.time', {
      finale: '🎉 <b>26 years</b> and <b>40 years</b>. Duration = end − start, and “− (−72)” becomes “+ 72”.',
      steps: [
        { type: 'choice', q: 'To find how many years someone lived, you do…', choices: ['born − died', 'died − born', 'born + died'], answer: 1, ok: '**died − born** (end − start).', wrongMsgs: { 0: 'That would give a negative number of years.', 2: 'Adding the two dates measures nothing useful.' } },
        num('Vercingétorix: **−46 − (−72)** = −46 + 72 =', 26, '**26 years.** Check with the timeline (button “Vercingétorix”).', '72 − 46.'),
        num('Euclide: **−283 − (−323)** = −283 + 323 =', 40, '**40 years.** He died aged 40.', '323 − 283.'),
      ] });
  }

  /* ============================================================== 5 · tout machine */
  const TM = { role: 'det', g: 'm', n: 'sg', snd: 'cons', pr: 'coll' };
  function labTout() {
    const root = $('#tout-lab'), opts = h('div'), out = h('div');
    root.append(opts, out);
    const grp = (key, label, list) => h('div', { class: 'chips2' }, h('span', { class: 'muted' }, label), ...list.map(([v, t]) => chipBtn(t, TM[key] === v, () => { TM[key] = v; draw(); }, { 'data-k': key, 'data-v': v })));
    function result() {
      const nm = (g, n) => (g === 'm' ? (n === 'sg' ? 'tout' : 'tous') : (n === 'sg' ? 'toute' : 'toutes'));
      if (TM.role === 'det') {
        const w = nm(TM.g, TM.n), ex = { 'm-sg': 'tout le temps', 'm-pl': 'tous les jours', 'f-sg': 'toute la journée', 'f-pl': 'toutes les semaines' }[TM.g + '-' + TM.n];
        return [w, ex, 'Before a <b>noun</b>, tout is a déterminant: it agrees with the noun in gender and number.'];
      }
      if (TM.role === 'pr') {
        const w = { coll: 'tout', mpl: 'tous', fpl: 'toutes' }[TM.pr], ex = { coll: 'Ne t’inquiète pas, tout suit.', mpl: 'Les bagages ? Tous suivent.', fpl: 'Les valises ? Toutes suivent.' }[TM.pr];
        return [w, ex, 'Before a <b>verb</b>, tout is a pronoun: it changes (tout / tous / toutes) with what it stands for.'];
      }
      if (TM.g === 'm') return ['tout', TM.n === 'sg' ? 'Il est tout mignon.' : 'Ils sont tout émus.', 'A <b>masculine</b> adjective → tout is an adverb and stays <b>invariable</b>.'];
      if (TM.snd === 'vow') return ['tout', TM.n === 'sg' ? 'Elle est tout étonnée.' : 'Elles sont tout heureuses.', 'A feminine adjective starting with a <b>vowel</b> (or h muet) → <b>invariable</b>.'];
      const w = TM.n === 'sg' ? 'toute' : 'toutes';
      return [w, TM.n === 'sg' ? 'Elle est toute seule.' : 'Elles sont toutes contentes.', 'A <b>feminine</b> adjective starting with a <b>consonant</b> or h aspiré → tout agrees: <b>toute / toutes</b>.'];
    }
    function draw() {
      const kids = [grp('role', 'Tout is a…', [['det', '🅰️ déterminant (before a noun)'], ['pr', '🅾️ pronom (before a verb)'], ['adv', '🅱️ adverbe (before an adjective)']])];
      if (TM.role === 'det') kids.push(grp('g', 'noun is', [['m', 'masculine'], ['f', 'feminine']]), grp('n', 'noun is', [['sg', 'singular'], ['pl', 'plural']]));
      if (TM.role === 'pr') kids.push(grp('pr', 'it stands for', [['coll', 'everything (collective)'], ['mpl', 'masculine plural'], ['fpl', 'feminine plural']]));
      if (TM.role === 'adv') kids.push(grp('g', 'adjective is', [['m', 'masculine'], ['f', 'feminine']]), grp('n', 'adjective is', [['sg', 'singular'], ['pl', 'plural']]), grp('snd', 'adjective starts with', [['cons', 'consonant / h aspiré'], ['vow', 'vowel / h muet']]));
      opts.replaceChildren(...kids);
      const [w, ex, why] = result();
      MC.fill(out, h('div', { class: 'touts', html: `<b>${w}</b> &nbsp; <small>${ex}</small>` }), h('div', { class: 'readout' }, pill(why, 'good')));
    }
    draw();
  }
  function missionsTout() {
    const TOUT = ['tout', 'tous', 'toute', 'toutes'];
    const ts = (q, ans, why) => ({ type: 'choice', q, choices: TOUT.slice(), answer: TOUT.indexOf(ans), ok: why, wrongMsgs: Object.fromEntries(TOUT.map((t, i) => [i, 'Check again: ' + why.replace(/\*\*/g, '')])) });
    guided('#tout1-steps', 's8.tout1', {
      finale: '🎉 Before a noun, <i>tout</i> always agrees with it: <b>tout le monde · toute la classe · tous les jours · toutes ces leçons</b>.',
      steps: [
        ts('1. Elle prend des cours de danse ……… les jours.', 'tous', '*jours* = masculine plural → **tous** les jours.'),
        ts('3. ……… la classe a cours de français aujourd’hui ?', 'toute', '*classe* = feminine singular → **toute** la classe.'),
        ts('5. Dans cette classe, ……… le monde doit parler en anglais.', 'tout', '*le monde* = masculine singular → **tout** le monde.'),
        ts('9. Elle sait ……… ces leçons par cœur !', 'toutes', '*leçons* = feminine plural → **toutes** ces leçons.'),
      ] });
    guided('#tout2-steps', 's8.tout2', {
      finale: '🎉 Adverb: <b>invariable</b> — except before a <b>feminine</b> adjective starting with a <b>consonant / h aspiré</b>: toute seule, toutes contentes.',
      steps: [
        ts('1. Ils sont ……… émus !', 'tout', '*émus* is masculine (and starts with a vowel) → **tout** émus.'),
        ts('3. Sonia est ……… seule à la maison ce soir !', 'toute', '*seule* is feminine and starts with a consonant → **toute** seule.'),
        ts('4. Elles sont ……… contentes de venir !', 'toutes', '*contentes* = feminine plural, consonant → **toutes** contentes.'),
        ts('9. Claire est ……… étonnée de son succès.', 'tout', '*étonnée* starts with a vowel → invariable: **tout** étonnée.'),
        ts('10. Ces étudiantes sont ……… heureuses de leur résultat !', 'tout', '*heureuses* starts with an h muet (= vowel) → **tout** heureuses.'),
      ] });
    guided('#tout3-steps', 's8.tout3', {
      finale: '🎉 Pronoun: <b>tout suit</b> (everything) · <b>toutes suivent</b> (les valises) · <b>tous pour vous</b> (les livres).',
      steps: [
        ts('Ne t’inquiète pas pour les bagages, ……… suit. (sens collectif)', 'tout', 'Collective sense: **tout** suit.'),
        ts('Ne t’inquiète pas pour les valises, ……… suivent.', 'toutes', '*les valises* = feminine plural → **toutes** suivent.'),
        ts('Ces livres sont ……… pour vous.', 'tous', '*livres* = masculine plural → **tous** pour vous.'),
      ] });
  }

  labLine(); labSigns(); missionsSigns(); labPow(); missionsPow(); labTime(); labTout(); missionsTout();
  refreshSkills(false);
})();
