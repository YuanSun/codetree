/* Week 5 lesson — fractions. Each lab = something to play with + a "guided" worked example where YOU do each step. */
(function () {
  'use strict';
  const { h, $, $$, gcd } = MC;
  const WEEK = 'week05', PAGE = 'lesson';
  const lcm = (a, b) => (a / gcd(a, b)) * b;
  const fr = (a, b) => `[[${a}/${b}]]`;
  const frs = (a, b) => { const g = gcd(a, b) || 1; return fr(a / g, b / g); };      // simplified fraction
  const F = (s) => MC.fmt(s);

  $$('.mission .ask, .mission .orig, .nova .say, .big-idea small, .callout').forEach((el) => { el.innerHTML = MC.fmt(el.innerHTML); });

  /* ------------------------------------------------------------ badges / progress */
  const SKILLS = {
    of:       { label: 'Of = ×',   emoji: '🍰', color: '#10b981', tasks: ['of.grid', 'of.goats'] },
    brackets: { label: 'Brackets', emoji: '🧮', color: '#3b82f6', tasks: ['brackets.lcd', 'brackets.flip', 'brackets.expr'] },
    farm:     { label: 'The farm', emoji: '🐄', color: '#f59e0b', tasks: ['farm.explore', 'farm.mission'] },
  };
  const BADGE_TEXT = {
    of: '“Of” means multiply — fractions of fractions are yours!',
    brackets: 'Inside first, same-size pieces, flip to divide. Brackets are yours!',
    farm: 'You always ask “a fraction of WHAT?”. The farm is yours!',
  };
  const isDone = (id) => !!(MC.store.get(WEEK, PAGE, id) || {}).done;
  function refreshSkills(announce) {
    const all = Object.values(SKILLS).flatMap((s) => s.tasks);
    MC.setProgress(Math.round((all.filter(isDone).length / all.length) * 100));
    MC.setSkillBar(Object.values(SKILLS).map((s) => ({ label: s.label, emoji: s.emoji, color: s.color, done: s.tasks.every(isDone) })));
    if (!announce) return;
    for (const [k, s] of Object.entries(SKILLS)) {
      if (s.tasks.every(isDone) && !MC.store.get(WEEK, 'lesson-meta', 'badge.' + k)) {
        MC.store.set(WEEK, 'lesson-meta', 'badge.' + k, { seen: 1 });
        MC.badge(s.emoji, `${s.label} badge unlocked!`, BADGE_TEXT[k]);
      }
    }
  }
  const guided = (mount, id, cfg) => MC.guided($(mount), Object.assign({ week: WEEK, page: PAGE, id, onDone: () => refreshSkills(true) }, cfg));
  const slider = (label, min, max, step, value, unit, onInput) => {
    const out = h('b', {}), inp = h('input', { type: 'range', min, max, step, value });
    const sync = () => { out.textContent = `${inp.value}${unit ? ' ' + unit : ''}`; };
    inp.oninput = () => { sync(); onInput(+inp.value); }; sync();
    return { row: h('div', { class: 'slider' }, h('span', {}, label), inp, out), inp, sync };
  };
  const bar = (n, cls, thin) => h('div', { class: 'fbar' + (thin ? ' thin' : '') }, Array.from({ length: n }, (_, i) => h('i', { class: cls(i) || '' })));
  const T = 0.002;   // tolerance for typed fractions (so 0.13 is not accepted for 2/15)

  /* ============================================================== world 1: grid */
  function labGrid() {
    const st = { b: 2, a: 1, d: 2, c: 1 };
    const svg = MC.svg('svg', { viewBox: '0 0 300 300' }), fx = h('div', { class: 'fx' });
    const sA = slider('🟦 Take (blue)', 1, st.b, 1, st.a, 'cols', (v) => { st.a = v; draw(); });
    const sB = slider('🟦 Cut into', 2, 8, 1, st.b, 'columns', (v) => { st.b = v; sA.inp.max = v; if (st.a > v) { st.a = v; sA.inp.value = v; sA.sync(); } draw(); });
    const sC = slider('🟨 Take (rows)', 1, st.d, 1, st.c, 'rows', (v) => { st.c = v; draw(); });
    const sD = slider('🟨 Cut into', 2, 8, 1, st.d, 'rows', (v) => { st.d = v; sC.inp.max = v; if (st.c > v) { st.c = v; sC.inp.value = v; sC.sync(); } draw(); });
    $('#grid-lab').append(h('div', { class: 'fgrid' }, svg, h('div', {}, sB.row, sA.row, sD.row, sC.row, fx)));
    function draw() {
      const { a, b, c, d } = st, w = 300 / b, hh = 300 / d, cells = [];
      for (let i = 0; i < b; i++) for (let j = 0; j < d; j++) {
        const col = i < a, row = j < c, fill = col && row ? '#ffc83d' : col ? '#8fbaff' : row ? '#ffe3ec' : '#fff';
        cells.push(MC.svg('rect', { x: i * w, y: j * hh, width: w, height: hh, fill, stroke: '#1b1f5e', 'stroke-width': 1.5 }));
      }
      svg.replaceChildren(...cells);
      const g = gcd(a * c, b * d);
      fx.innerHTML = F(`${fr(c, d)} of ${fr(a, b)} → <em>${fr(c, d)} × ${fr(a, b)}</em> = ${fr(a * c, b * d)}${g > 1 ? ' = **' + fr((a * c) / g, (b * d) / g) + '**' : ''}<br><small style="font-size:16px;color:var(--muted)">gold cells: ${a * c} out of ${b * d}</small>`);
    }
    draw();
    guided('#grid-steps', 'of.grid', {
      finale: '🎉 **“Of” means ×.** The gold part is always *smaller* than the blue part — you took a piece of a piece.',
      steps: [
        { type: 'action', q: `Set the grid to ${fr(3, 4)} blue (cut into **4**, take **3**) and take ${fr(2, 3)} of it (rows: cut into **3**, take **2**).`, btn: 'My grid is ready', check: () => (st.a / st.b === 0.75 && st.c / st.d === 2 / 3) || 'Blue = 3 of 4 columns, rows = 2 of 3. Move the four sliders.', ok: 'Look at the gold cells.' },
        { q: 'What fraction of the **whole square** is gold? (Simplify it.)', type: 'number', answer: 0.5, tol: T, nudge: 'Gold cells ÷ all cells. It is on the right: 6 out of 12.', hint: '6 out of 12 simplifies to…', ok: `6 out of 12 = ${fr(1, 2)}. And ${fr(3, 4)} × ${fr(2, 3)} = ${fr(6, 12)} too!` },
        { q: `No picture this time: what is ${fr(3, 5)} of ${fr(1, 2)}?`, type: 'number', answer: 0.3, tol: T, nudge: 'Multiply the tops and multiply the bottoms.', ok: `${fr(3, 5)} × ${fr(1, 2)} = ${fr(3, 10)}.` },
        { type: 'choice', q: 'So the word “of” between two fractions means…', choices: ['add', 'subtract', 'multiply', 'divide'], answer: 2, ok: '**Multiply.**', wrongMsgs: { 0: 'Count the gold cells again — they are 6 out of 12, not a sum.', 1: 'Subtracting would make a *different* picture. Look at the gold part.', 3: 'Dividing is for “how many fit”. Here we took a piece of a piece.' } },
      ],
    });
  }

  /* ============================================================== world 1: goats */
  function labGoats() {
    const stage = $('#goat-stage'), left = h('span', { class: 'pill' }), msg = h('span', { class: 'pill' });
    const goats = Array.from({ length: 56 }, () => h('span', {}, '🐐'));
    const field = h('div', { class: 'goats' }, goats);
    field.style.gridAutoFlow = 'column'; field.style.gridTemplateRows = 'repeat(8, auto)'; field.style.gridTemplateColumns = 'none';
    let year = 0;
    const paint = () => {
      goats.forEach((g, i) => { g.className = year >= 1 && i < 8 ? 'lost1' : year >= 2 && i < 16 ? 'gone' : ''; });
      const n = year === 0 ? 56 : year === 1 ? 48 : 40;
      left.textContent = `Goats left: ${n}`;
      msg.textContent = year === 0 ? '56 goats = 7 columns of 8' : year === 1 ? 'Year 1: one column of 8 is gone (1/7)' : 'Year 2: 1/6 of the 48 rest = 8 more';
    };
    const b1 = h('button', { class: 'btn small', onclick: () => { year = Math.max(year, 1); paint(); } }, 'Year 1: lose 1/7 of 56');
    const b2 = h('button', { class: 'btn small warm', onclick: () => { if (year < 1) { MC.toast('Do year 1 first!'); return; } year = 2; paint(); } }, 'Year 2: lose 1/6 of the REST');
    const rs = h('button', { class: 'btn small ghost', onclick: () => { year = 0; paint(); } }, '↺ Reset');
    stage.append(field, h('div', { class: 'goatbtns' }, b1, b2, rs), h('div', { class: 'readout', style: { justifyContent: 'center' } }, left, msg));
    paint();
    guided('#goat-steps', 'of.goats', {
      finale: `🎉 **${fr(5, 6)} of ${fr(6, 7)} = ${fr(5, 7)}** — and ${fr(5, 7)} of 56 = 40 goats. Year 2 took ${fr(1, 6)} of the *rest*, not of the whole flock.`,
      steps: [
        { q: `Year 1: he loses ${fr(1, 7)} of 56 goats. How many goats is that?`, type: 'number', answer: 8, nudge: 'Find ONE seventh: 56 ÷ 7.', ok: '56 ÷ 7 = 8 goats.' },
        { q: 'What **fraction** of the flock is left after year 1?', type: 'number', answer: 6 / 7, tol: T, nudge: 'He lost 1 seventh out of 7 sevenths. How many sevenths remain?', ok: `${fr(6, 7)} of the flock = 48 goats.` },
        { q: `Year 2 takes ${fr(1, 6)} of **the rest**. How many goats are in the rest?`, type: 'number', answer: 48, nudge: '56 − 8.', ok: 'The rest is 48 goats.' },
        { q: `${fr(1, 6)} of 48 goats = ?`, type: 'number', answer: 8, nudge: '48 ÷ 6.', ok: '8 goats lost in year 2.' },
        { q: 'How many goats are left at the end?', type: 'number', answer: 40, nudge: '56 − 8 − 8.', ok: '**40 goats.**' },
        { q: `What fraction of the **original** flock is that? (${fr(5, 6)} of ${fr(6, 7)})`, type: 'number', answer: 5 / 7, tol: T, nudge: '40 out of 56 — or multiply 5/6 × 6/7 and watch the 6s cancel.', hint: 'Not 6/7 − 1/6! The second loss is a fraction of the REST.', ok: `${fr(5, 6)} × ${fr(6, 7)} = ${fr(5, 7)}. ✅` },
      ],
    });
  }

  /* ========================================================= world 2: common denominator */
  function labLcd() {
    const st = { a: 3, b: 4, c: 1, d: 3, op: '−' };
    const root = $('#lcd-lab');
    const sB = slider('First: cut into', 2, 12, 1, st.b, 'parts', (v) => { st.b = v; sA.inp.max = v - 1; if (st.a > v - 1) { st.a = v - 1; sA.inp.value = st.a; sA.sync(); } draw(); });
    const sA = slider('First: take', 1, st.b - 1, 1, st.a, 'parts', (v) => { st.a = v; draw(); });
    const sD = slider('Second: cut into', 2, 12, 1, st.d, 'parts', (v) => { st.d = v; sC.inp.max = v - 1; if (st.c > v - 1) { st.c = v - 1; sC.inp.value = st.c; sC.sync(); } draw(); });
    const sC = slider('Second: take', 1, st.d - 1, 1, st.c, 'parts', (v) => { st.c = v; draw(); });
    const tog = h('div', { class: 'toggle' }, ['+', '−'].map((o) => h('button', { class: o === st.op ? 'on' : '', onclick: (e) => { st.op = o; $$('button', tog).forEach((b) => b.classList.toggle('on', b === e.currentTarget)); draw(); } }, o)));
    const out = h('div', { class: 'readout' }), bars = h('div', {});
    root.append(sB.row, sA.row, sD.row, sC.row, tog, bars, out);
    function draw() {
      const { a, b, c, d, op } = st, L = lcm(b, d), x = (a * L) / b, y = (c * L) / d, r = op === '+' ? x + y : x - y;
      bars.replaceChildren(
        h('div', { class: 'flabel', html: F(`${fr(a, b)} <small>— cut into ${b}</small>`) }), bar(b, (i) => (i < a ? 'a' : ''), false),
        h('div', { class: 'flabel', html: F(`${fr(c, d)} <small>— cut into ${d}</small>`) }), bar(d, (i) => (i < c ? 'b' : ''), false),
        h('div', { class: 'flabel', html: F(`Same-size pieces: <b>${L}</b> pieces in the whole ${op === '+' ? '(blue + orange)' : '(blue minus orange)'}`) }),
        bar(L, (i) => (op === '+' ? (i < x ? 'a' : i < x + y ? 'b' : '') : i < r ? 'both' : i < x ? 'cut' : ''), true));
      const ok = r > 0 && r <= L;
      out.replaceChildren(
        h('span', { class: 'pill', html: F(`PPCM (${b}, ${d}) = ${L}`) }), h('span', { class: 'pill', html: F(`${fr(a, b)} = ${fr(x, L)}`) }), h('span', { class: 'pill', html: F(`${fr(c, d)} = ${fr(y, L)}`) }),
        h('span', { class: 'pill ' + (ok ? 'good' : 'hot'), html: F(ok ? `${fr(x, L)} ${op} ${fr(y, L)} = **${frs(r, L)}**` : r <= 0 ? 'that would be 0 or negative — try the other sign' : `${fr(r, L)} — more than a whole!`) }));
    }
    draw();
    guided('#lcd-steps', 'brackets.lcd', {
      finale: '🎉 **Same size first, then add or subtract the tops.** The new piece size is the PPCM of the denominators — you will meet the PPCM again next week!',
      steps: [
        { q: `Set the lab to ${fr(3, 4)} − ${fr(1, 3)}. What is the **PPCM of 4 and 3**? (the smallest number in both times tables)`, type: 'number', answer: 12, nudge: 'Count: 4, 8, 12 … and 3, 6, 9, 12 …', ok: 'Twelfths!' },
        { q: `${fr(3, 4)} = ?/12 — how many twelfths?`, type: 'number', answer: 9, nudge: '12 ÷ 4 = 3, so each quarter is 3 twelfths. You take 3 quarters.', ok: `${fr(3, 4)} = ${fr(9, 12)}` },
        { q: `${fr(1, 3)} = ?/12`, type: 'number', answer: 4, nudge: '12 ÷ 3 = 4 twelfths in each third.', ok: `${fr(1, 3)} = ${fr(4, 12)}` },
        { q: `So ${fr(3, 4)} − ${fr(1, 3)} = ?`, type: 'number', answer: 5 / 12, tol: T, nudge: '9 twelfths − 4 twelfths.', ok: `${fr(9, 12)} − ${fr(4, 12)} = **${fr(5, 12)}**` },
        { q: `One more, no picture: ${fr(7, 10)} + ${fr(1, 5)} = ? (PPCM of 10 and 5 is 10)`, type: 'number', answer: 0.9, tol: T, nudge: `${fr(1, 5)} = ${fr(2, 10)}. Then add the tops.`, ok: `${fr(7, 10)} + ${fr(2, 10)} = **${fr(9, 10)}**` },
      ],
    });
  }

  /* ========================================================= world 2: divide by a fraction */
  function labFlip() {
    const presets = [[3, 4, 1, 8], [1, 2, 1, 6], [3, 4, 3, 8], [2, 3, 1, 6], [1, 5, 3, 8]];
    let p = presets[0];
    const root = $('#flip-lab'), out = h('div', { class: 'readout' });
    const box = h('div', { style: { position: 'relative', height: '116px', margin: '8px 0' } });
    const btns = h('div', { class: 'presets' }, presets.map((q, i) => h('button', { class: i === 0 ? 'on' : '', html: F(`${fr(q[0], q[1])} ÷ ${fr(q[2], q[3])}`), onclick: (e) => { p = q; $$('button', btns).forEach((b) => b.classList.toggle('on', b === e.currentTarget)); draw(); } })));
    root.append(btns, box, out);
    function draw() {
      const [a, b, c, d] = p, A = a / b, C = c / d, n = A / C, whole = Math.floor(n + 1e-9);
      const rect = (l, t, w, hh, bg, text, extra = {}) => h('div', Object.assign({ style: { position: 'absolute', left: l + '%', top: t + 'px', width: w + '%', height: hh + 'px', background: bg, border: '2px solid #1b1f5e', borderRadius: '8px', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '13px', color: '#1b1f5e', boxSizing: 'border-box', overflow: 'hidden' } }, extra), text);
      const kids = [rect(0, 0, 100, 24, '#fff', ''), rect(0, 0, A * 100, 24, '#8fbaff', `${a}/${b} of one whole`)];
      for (let k = 0; k <= whole; k++) {
        const w = Math.min(C, A - k * C);
        if (w < 1e-9) continue;
        kids.push(rect(k * C * 100, 40, w * 100, 34, w >= C - 1e-9 ? '#7ee8c0' : '#ffe0b0', w >= C - 1e-9 ? `${c}/${d}` : '', { 'aria-label': 'piece' }));
      }
      kids.push(h('div', { style: { position: 'absolute', top: '84px', left: 0, fontWeight: 800, color: '#1b1f5e' }, html: F(`Pieces of size ${fr(c, d)} that fit: <b>${whole >= 1 || n % 1 === 0 ? whole : 0}${n % 1 > 1e-9 ? ' and a part of one' : ''}</b>`) }));
      box.replaceChildren(...kids);
      const prod = a * d, den = b * c;
      out.replaceChildren(h('span', { class: 'pill', html: F(`${fr(a, b)} ÷ ${fr(c, d)} = ${fr(a, b)} × ${fr(d, c)} = ${fr(prod, den)}${gcd(prod, den) > 1 ? ' = **' + frs(prod, den) + '**' : ''}`) }),
        h('span', { class: 'pill ' + (n < 1 ? 'hot' : 'good') }, n < 1 ? 'less than 1 piece fits → answer < 1' : `${n % 1 === 0 ? n : (+n.toFixed(2))} pieces fit`));
    }
    draw();
    guided('#flip-steps', 'brackets.flip', {
      finale: `🎉 **Dividing by a fraction = multiplying by its flip.** ${fr(1, 5)} ÷ ${fr(3, 8)} = ${fr(1, 5)} × ${fr(8, 3)} = ${fr(8, 15)}.`,
      steps: [
        { q: `With the first example selected: how many ${fr(1, 8)} pieces fit in ${fr(3, 4)}?`, type: 'number', answer: 6, nudge: 'Count the green pieces in the picture.', ok: `6 — and ${fr(3, 4)} × ${fr(8, 1)} = 6 too.` },
        { type: 'choice', q: `Pick the last example. ${fr(1, 5)} ÷ ${fr(3, 8)} — will the answer be…`, choices: ['bigger than 1', 'smaller than 1'], answer: 1, ok: `Right: ${fr(3, 8)} is *bigger* than ${fr(1, 5)}, so less than one piece fits.`, wrongMsgs: { 0: 'Look at the orange piece: it doesn’t even fit once.' } },
        { type: 'choice', q: `Dividing by ${fr(3, 8)} is the same as multiplying by…`, choices: [fr(3, 8), fr(8, 3), fr(5, 1)], answer: 1, ok: 'Flip it: **[[8/3]]**.', wrongMsgs: { 0: 'That would multiply by the same fraction. Flip means swap top and bottom.', 2: 'Flip the fraction you divide by: 3/8 → 8/3.' } },
        { q: `${fr(1, 5)} ÷ ${fr(3, 8)} = ${fr(1, 5)} × ${fr(8, 3)} = ?`, type: 'number', answer: 8 / 15, tol: T, nudge: 'Tops: 1 × 8. Bottoms: 5 × 3.', ok: `**${fr(8, 15)}**` },
      ],
    });
  }

  /* ========================================================= world 2: the big expression */
  function labExpr() {
    $('#bigexpr').innerHTML = F(`${fr(1, 5)} ÷ [ ( ${fr(7, 10)} + ${fr(1, 5)} ) × ( ${fr(3, 4)} − ${fr(1, 3)} ) ] − ${fr(2, 5)}`);
    guided('#expr-steps', 'brackets.expr', {
      finale: `🎉 **${fr(2, 15)}.** Brackets → × ÷ → − , and the flip for ÷. Notice ${fr(8, 15)} was a *trap*: it is only the answer if you forget the last step.`,
      steps: [
        { type: 'choice', q: 'What do you do **first**?', choices: [`The ÷ in ${fr(1, 5)} ÷ [ … ]`, `The − ${fr(2, 5)} at the end`, 'The round brackets inside the square bracket'], answer: 2, ok: 'Innermost brackets first.', wrongMsgs: { 0: 'The square bracket isn’t finished yet — it hides two calculations.', 1: 'Subtracting is always last here.' } },
        { q: `( ${fr(7, 10)} + ${fr(1, 5)} ) = ?`, type: 'number', answer: 0.9, tol: T, nudge: `${fr(1, 5)} = ${fr(2, 10)}. Then add the tops.`, ok: `${fr(7, 10)} + ${fr(2, 10)} = ${fr(9, 10)}` },
        { q: `( ${fr(3, 4)} − ${fr(1, 3)} ) = ?`, type: 'number', answer: 5 / 12, tol: T, nudge: 'Twelfths: 9/12 − 4/12.', ok: `${fr(9, 12)} − ${fr(4, 12)} = ${fr(5, 12)}` },
        { q: `The square bracket is ${fr(9, 10)} × ${fr(5, 12)}. What is it? (simplify!)`, type: 'number', answer: 3 / 8, tol: T, nudge: '9 × 5 = 45 and 10 × 12 = 120. Then simplify 45/120 (÷ 15).', ok: `${fr(45, 120)} = ${fr(3, 8)}` },
        { q: `Now ${fr(1, 5)} ÷ ${fr(3, 8)} = ?`, type: 'number', answer: 8 / 15, tol: T, nudge: 'Flip the second fraction, then multiply.', hint: `${fr(1, 5)} × ${fr(8, 3)}`, ok: `${fr(8, 15)}` },
        { q: `Last step: ${fr(8, 15)} − ${fr(2, 5)} = ?`, type: 'number', answer: 2 / 15, tol: T, nudge: `${fr(2, 5)} = ${fr(6, 15)}.`, ok: `${fr(8, 15)} − ${fr(6, 15)} = **${fr(2, 15)}**` },
      ],
    });
  }

  /* ========================================================= world 3: the farm */
  const FARM = [
    { id: 'pigs', emoji: '🐖', name: 'Pigs', n: 60, f: [2, 15], color: '#ec6f9a', inner: [['go to the slaughterhouse this week', 35, [7, 12], '#e5484d'], ['stay', 25, null, '#f3a6bf']] },
    { id: 'rabbits', emoji: '🐇', name: 'Rabbits', n: 135, f: [3, 10], color: '#8b6fd6', inner: [['are black', 30, [2, 9], '#312a55'], ['other colours', 105, null, '#b9a8ee']] },
    { id: 'cows', emoji: '🐄', name: 'Cows', n: 180, f: [2, 5], color: '#3b82f6', inner: [['are sick', 18, [1, 10], '#e5484d'], ['healthy', 162, null, '#8fbaff']] },
    { id: 'hens', emoji: '🐔', name: 'Hens', n: 75, f: [1, 6], color: '#f59e0b', rest: true, inner: [['are very good layers', 10, [2, 15], '#17b26a'], ['other hens', 65, null, '#ffd08a']] },
  ];
  function labFarm() {
    const st = { sel: null };
    const bigBar = h('div', { class: 'farm' }), info = h('div', { class: 'readout', style: { flexDirection: 'column', alignItems: 'flex-start' } }), innerBar = h('div', { class: 'farm inner', style: { display: 'none' } });
    const buttons = FARM.map((g) => h('button', { style: { width: (g.n / 450) * 100 + '%', background: g.color }, 'data-id': g.id, onclick: () => pick(g.id) },
      g.emoji, h('small', {}, `${g.name} ${g.f[0]}/${g.f[1]}`)));
    bigBar.append(...buttons);
    $('#farm-lab').append(h('div', { class: 'flabel' }, 'All 450 animals'), bigBar, innerBar, info);
    function pick(id) {
      st.sel = id; const g = FARM.find((x) => x.id === id);
      buttons.forEach((b) => b.classList.toggle('on', b.dataset.id === id));
      innerBar.style.display = '';
      innerBar.replaceChildren(...g.inner.map((s) => h('button', { style: { width: (s[1] / g.n) * 100 + '%', background: s[3] } }, h('small', {}, `${s[1]}`))));
      const s0 = g.inner[0], gg = gcd(s0[1], 450);
      info.replaceChildren(
        h('span', { class: 'pill', html: F(`${g.emoji} ${g.name}: ${g.rest ? 'the rest = ' : ''}${fr(...g.f)} of the farm = <b>${g.n}</b> animals`) }),
        h('span', { class: 'pill good', html: F(`Inside: ${fr(...s0[2])} of the ${g.name.toLowerCase()} ${s0[0]} = <b>${s0[1]}</b>`) }),
        h('span', { class: 'pill hot', html: F(`…which is only ${fr(s0[1] / gg, 450 / gg)} of the whole farm (${s0[1]} out of 450)`) }));
    }
    guided('#farm-steps', 'farm.explore', {
      finale: '🎉 **Two different wholes!** “[[1/10]] of the cows” and “[[1/10]] of the farm” are very different amounts. Always find the whole first.',
      steps: [
        { type: 'action', q: 'Tap the **🐄 Cows** piece in the bar.', btn: 'I opened it', check: () => st.sel === 'cows' || 'Tap the blue 🐄 piece first.', ok: 'Inside the cows you can see the sick ones.' },
        { q: `${fr(1, 10)} of the cows are sick. How many sick cows?`, type: 'number', answer: 18, nudge: 'There are 180 cows. 180 ÷ 10.', ok: '18 sick cows.' },
        { type: 'choice', q: `Is that ${fr(1, 10)} **of the cows**, or ${fr(1, 10)} **of all 450 animals**?`, choices: ['of the cows', 'of all 450 animals'], answer: 0, ok: '1/10 **of the cows.**', wrongMsgs: { 1: '1/10 of 450 would be 45 animals. We found 18 — a tenth of the 180 cows.' } },
        { q: `So what fraction of the **whole farm** is sick cows? (${fr(1, 10)} of ${fr(2, 5)})`, type: 'number', answer: 1 / 25, tol: T, nudge: '18 out of 450 — or multiply 1/10 × 2/5.', ok: `${fr(1, 10)} × ${fr(2, 5)} = ${fr(2, 50)} = **${fr(1, 25)}**` },
      ],
    });
    guided('#mission-steps', 'farm.mission', {
      finale: `🎉 **Farm solved!** Hens ${fr(1, 6)} · quadrupeds ${fr(5, 6)} · sick cows ${fr(1, 25)} = 18 · quadrupeds 375 · pigs + hens ${fr(3, 10)}.`,
      steps: [
        { q: '**a)** Hens are “the rest”. What fraction of the animals are hens?', type: 'number', answer: 1 / 6, tol: T, nudge: `Add pigs ${fr(4, 30)}, rabbits ${fr(9, 30)} and cows ${fr(12, 30)}. Then take that from a whole.`, hint: `${fr(25, 30)} are not hens.`, ok: `1 − ${fr(25, 30)} = **${fr(1, 6)}**` },
        { q: '**b)** What fraction are **quadrupeds** (4 legs)? Pigs, rabbits and cows — not the hens!', type: 'number', answer: 5 / 6, tol: T, nudge: 'Everything except the hens — or add the three fractions.', ok: `${fr(25, 30)} = **${fr(5, 6)}**` },
        { q: '**c)** What fraction of all the animals are **sick cows**?', type: 'number', answer: 1 / 25, tol: T, nudge: `${fr(1, 10)} of ${fr(2, 5)} — multiply.`, ok: `**${fr(1, 25)}**` },
        { q: '**d)** How many sick cows?', type: 'number', answer: 18, nudge: `${fr(1, 25)} of 450 = 450 ÷ 25.`, ok: '**18**' },
        { q: '**e)** How many quadrupeds? (The pigs going to the slaughterhouse *will* go — they are still here now.)', type: 'number', answer: 375, nudge: `${fr(5, 6)} of 450: 450 ÷ 6 = 75, then × 5.`, ok: '75 × 5 = **375**' },
        { q: '**f)** Pigs and hens together are what fraction of the animals?', type: 'number', answer: 3 / 10, tol: T, nudge: `Pigs ${fr(2, 15)} = ${fr(4, 30)}, hens ${fr(1, 6)} = ${fr(5, 30)}. Add.`, hint: 'Careful: the hens are 1/6 of the farm. The 2/15 the story gives for the hens is only about the *good layers*.', ok: `${fr(4, 30)} + ${fr(5, 30)} = ${fr(9, 30)} = **${fr(3, 10)}**` },
      ],
    });
  }

  [labGrid, labGoats, labLcd, labFlip, labExpr, labFarm].forEach((fn) => { try { fn(); } catch (e) { console.error('lab failed:', fn.name, e); } });
  refreshSkills(false);
})();
