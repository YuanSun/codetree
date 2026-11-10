/* Sem 6 lesson — PPCM & PGCD. Each lab = something to play with + a "guided" worked example where YOU do each step. */
(function () {
  'use strict';
  const { h, $, $$, gcd, shuffle } = MC;
  const WEEK = 'sem06', PAGE = 'lesson';
  const lcm = (a, b) => (a / gcd(a, b)) * b;
  const fr = (a, b) => `[[${a}/${b}]]`;
  const F = (s) => MC.fmt(s);
  const T = 0.002;
  const primeColor = { 2: '#3b82f6', 3: '#ec6f9a', 5: '#17b26a', 7: '#f59e0b', 11: '#8b5cf6' };
  const pc = (p) => primeColor[p] || '#64748b';
  const factor = (n) => { const f = []; for (let p = 2; n > 1; p++) while (n % p === 0) { f.push(p); n /= p; } return f; };

  $$('.mission .ask, .mission .orig, .nova .say, .big-idea small').forEach((el) => { el.innerHTML = MC.fmt(el.innerHTML); });

  /* ------------------------------------------------------------ badges / progress */
  const SKILLS = {
    ppcm:   { label: 'PPCM',          emoji: '🔔', color: '#8b5cf6', tasks: ['ppcm.race', 'ppcm.clocks'] },
    primes: { label: 'Prime factors', emoji: '🧬', color: '#10b981', tasks: ['primes.venn', 'primes.ladder'] },
    pgcd:   { label: 'PGCD',          emoji: '🎒', color: '#3b82f6', tasks: ['pgcd.bags', 'pgcd.sorter'] },
    review: { label: 'Fractions',     emoji: '💰', color: '#f59e0b', tasks: ['review.pay'] },
  };
  const BADGE_TEXT = {
    ppcm: 'PPCM = the first time they meet again. Clocks are yours!',
    primes: 'Break into prime bricks — shared ones for PGCD, all of them for PPCM!',
    pgcd: 'Share equally, as many groups as possible. PGCD is yours!',
    review: 'The PPCM finds the common denominator. Fractions review done!',
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
  const S = (tag, attrs, ...kids) => MC.svg(tag, attrs, ...kids);

  /* ============================================================== beep race */
  const race = { n: 2, v: [4, 6, 10] };
  function labRace() {
    const root = $('#race-lab'), box = h('div', { class: 'race' }), out = h('div', { class: 'readout' });
    const names = ['A', 'B', 'C'], colors = ['#3b82f6', '#ec6f9a', '#17b26a'];
    const sl = names.map((nm, i) => slider(`🔔 Clock ${nm} every`, 2, 24, 1, race.v[i], 'min', (v) => { race.v[i] = v; draw(); }));
    const tog = h('div', { class: 'toggle' }, [2, 3].map((n) => h('button', { class: n === race.n ? 'on' : '', 'data-n': n, onclick: () => setN(n) }, `${n} clocks`)));
    function setN(n) { race.n = n; $$('button', tog).forEach((b) => b.classList.toggle('on', +b.dataset.n === n)); sl[2].row.style.display = n === 3 ? '' : 'none'; draw(); }
    root.append(tog, ...sl.map((s) => s.row), box, out);
    race.set = (vals) => { vals.forEach((v, i) => { race.v[i] = v; sl[i].inp.value = v; sl[i].sync(); }); setN(vals.length); };
    function draw() {
      const vals = race.v.slice(0, race.n), L = vals.reduce(lcm), H = Math.min(L, 240), W = 640, rowH = 38, top = 30, X = (t) => 20 + (t / H) * (W - 40);
      const parts = [];
      vals.forEach((v, i) => {
        const y = top + i * rowH + 16;
        parts.push(S('line', { x1: 20, x2: W - 20, y1: y, y2: y, stroke: '#d5d9f5', 'stroke-width': 6, 'stroke-linecap': 'round' }));
        parts.push(S('text', { x: 4, y: y + 4, 'font-size': 13, 'font-weight': 800, fill: colors[i] }, names[i]));
        for (let t = v; t <= H + 1e-9; t += v) {
          const all = t % L === 0;
          parts.push(S('circle', { cx: X(t), cy: y, r: all ? 8 : H / v > 40 ? 3 : 5, fill: all ? '#ffc83d' : colors[i], stroke: all ? '#1b1f5e' : 'none', 'stroke-width': 2 }));
        }
      });
      const bottom = top + vals.length * rowH;
      parts.push(S('text', { x: 20, y: 18, 'font-size': 13, 'font-weight': 800, fill: '#666d96' }, '0 min'));
      if (L <= 240) {
        parts.push(S('line', { x1: X(L), x2: X(L), y1: 22, y2: bottom, stroke: '#ffc83d', 'stroke-width': 4, 'stroke-dasharray': '6 5' }));
        parts.push(S('text', { x: Math.min(X(L), W - 70), y: 18, 'font-size': 15, 'font-weight': 800, fill: '#a66a00', 'text-anchor': L > 200 ? 'end' : 'middle' }, `together at ${L} min`));
      } else parts.push(S('text', { x: W - 24, y: 18, 'font-size': 13, 'font-weight': 800, fill: '#a64b00', 'text-anchor': 'end' }, `first together at ${L} min — off the screen!`));
      box.replaceChildren(S('svg', { viewBox: `0 0 ${W} ${bottom + 10}` }, ...parts));
      out.replaceChildren(...vals.map((v, i) => h('span', { class: 'pill' }, `Clock ${names[i]}: ${v}, ${2 * v}, ${3 * v}…`)),
        h('span', { class: 'pill good', html: F(`PPCM (${vals.join(', ')}) = <b>${L}</b>`) }));
    }
    setN(2);
    guided('#race-steps', 'ppcm.race', {
      finale: '🎉 **The first time all clocks beep together is the PPCM.** And they beep together again at 2×, 3×… that number.',
      steps: [
        { type: 'action', q: 'Set **2 clocks**: Clock A every **4** min and Clock B every **6** min.', btn: 'Clocks are set', check: () => (race.n === 2 && race.v[0] === 4 && race.v[1] === 6) || 'A = 4, B = 6, and press the “2 clocks” button.', ok: 'Watch for the gold dots.' },
        { q: 'When do they **first** beep together? (minutes)', type: 'number', answer: 12, nudge: 'A: 4, 8, 12 … B: 6, 12 … Find the first one in both lists.', ok: 'At 12 minutes: PPCM (4, 6) = 12.' },
        { type: 'choice', q: 'And the **next** time after that?', choices: ['16 minutes', '18 minutes', '24 minutes'], answer: 2, ok: 'Every 12 minutes: 12, 24, 36 … — all multiples of the PPCM.', wrongMsgs: { 0: 'Is 16 in the 6 table?', 1: 'Is 18 in the 4 table?' } },
        { type: 'choice', q: 'The **first** time they beep together again is called the…', choices: ['PGCD', 'PPCM'], answer: 1, ok: '**PPCM** — Plus Petit Commun Multiple.', wrongMsgs: { 0: 'The PGCD is about the *biggest divisor*. This is the smallest *multiple*.' } },
      ],
    });
  }

  function missionClocks() {
    guided('#clock-steps', 'ppcm.clocks', {
      finale: '🎉 **120 minutes = 2 hours.** Using primes: 20 = 2²×5, 15 = 3×5, 24 = 2³×3 → PPCM = 2³ × 3 × 5 = 120.',
      steps: [
        { type: 'choice', q: '“Ring together **again**” — which tool?', choices: ['PPCM (smallest common multiple)', 'PGCD (biggest common divisor)'], answer: 0, ok: '“Again / at the same time” → **PPCM**.', wrongMsgs: { 1: 'We are not sharing things into groups. We want the first time all three meet.' } },
        { q: 'A kid guesses **60** (the PPCM of 20 and 15). Does the 24-minute clock ring at 60? What is **60 ÷ 24**?', type: 'number', answer: 2.5, nudge: '24 × 2 = 48, 24 × 3 = 72.', ok: '2.5 — not a whole number, so the third clock is *not* ringing at 60.' },
        { q: 'After how many minutes do **all three** first ring together? (Try the beep race with 3 clocks: 20, 15, 24 — or use primes.)', type: 'number', answer: 120, nudge: 'Biggest power of each prime: 2³ (from 24), 3 (from 24 or 15), 5 (from 20). Multiply.', hint: '8 × 3 × 5', ok: '**120 minutes.** Check: 120 ÷ 20 = 6, ÷ 15 = 8, ÷ 24 = 5 ✅' },
        { q: 'How many **hours** is that?', type: 'number', answer: 2, nudge: '60 minutes in an hour.', ok: '2 hours.' },
      ],
    });
  }

  /* ============================================================== prime bubbles */
  function labVenn() {
    const st = { a: 12, b: 18 };
    const root = $('#venn-lab'), box = h('div', { class: 'venn' }), out = h('div', { class: 'readout' });
    const sA = slider('First number', 2, 150, 1, st.a, '', (v) => { st.a = v; draw(); });
    const sB = slider('Second number', 2, 150, 1, st.b, '', (v) => { st.b = v; draw(); });
    const chips = h('div', { class: 'chips2' }, [[12, 18], [36, 48], [11, 12], [7, 11], [20, 15]].map(([a, b]) => h('button', { onclick: () => { st.a = a; st.b = b; sA.inp.value = a; sB.inp.value = b; sA.sync(); sB.sync(); draw(); } }, `${a} & ${b}`)));
    root.append(chips, sA.row, sB.row, box, out);
    venn.st = st; venn.set = (a, b) => { st.a = a; st.b = b; sA.inp.value = a; sB.inp.value = b; sA.sync(); sB.sync(); draw(); };
    function place(list, cx, cy, cols, gap) {
      const rows = Math.ceil(list.length / cols);
      return list.map((p, i) => { const r = Math.floor(i / cols), inRow = Math.min(cols, list.length - r * cols), c = i % cols; return { p, x: cx + (c - (inRow - 1) / 2) * gap, y: cy + (r - (rows - 1) / 2) * gap }; });
    }
    function draw() {
      const fa = factor(st.a), fb = factor(st.b), cnt = (f) => f.reduce((m, p) => ((m[p] = (m[p] || 0) + 1), m), {});
      const ca = cnt(fa), cb = cnt(fb), mid = [], left = [], right = [];
      new Set([...fa, ...fb]).forEach((p) => {
        const m = Math.min(ca[p] || 0, cb[p] || 0);
        for (let i = 0; i < m; i++) mid.push(p);
        for (let i = 0; i < (ca[p] || 0) - m; i++) left.push(p);
        for (let i = 0; i < (cb[p] || 0) - m; i++) right.push(p);
      });
      [mid, left, right].forEach((l) => l.sort((x, y) => x - y));
      const prod = (l) => l.reduce((x, y) => x * y, 1), pgcd = prod(mid), ppcm = pgcd * prod(left) * prod(right);
      const tok = ({ p, x, y }) => [S('circle', { cx: x, cy: y, r: 15, fill: pc(p) }), S('text', { x, y: y + 5, 'text-anchor': 'middle', 'font-size': 15, fill: '#fff' }, p)];
      const parts = [
        S('circle', { cx: 205, cy: 155, r: 125, fill: '#8fbaff', 'fill-opacity': .3, stroke: '#3b82f6', 'stroke-width': 3 }),
        S('circle', { cx: 355, cy: 155, r: 125, fill: '#ffd08a', 'fill-opacity': .35, stroke: '#f59e0b', 'stroke-width': 3 }),
        S('text', { x: 150, y: 24, 'text-anchor': 'middle', 'font-size': 20, fill: '#1d4ed8' }, st.a), S('text', { x: 410, y: 24, 'text-anchor': 'middle', 'font-size': 20, fill: '#b45309' }, st.b),
        S('text', { x: 280, y: 292, 'text-anchor': 'middle', 'font-size': 14, fill: '#0c7a47' }, mid.length ? 'shared ↑' : 'nothing shared!'),
        ...place(left, 148, 155, 3, 36).flatMap(tok), ...place(mid, 280, 155, 2, 34).flatMap(tok), ...place(right, 412, 155, 3, 36).flatMap(tok)];
      box.replaceChildren(S('svg', { viewBox: '0 0 560 300' }, ...parts));
      const join = (l) => (l.length ? l.join(' × ') : '1');
      out.replaceChildren(
        h('span', { class: 'pill', html: F(`${st.a} = ${join(fa)}`) }), h('span', { class: 'pill', html: F(`${st.b} = ${join(fb)}`) }),
        h('span', { class: 'pill good', html: F(`PGCD = middle = ${join(mid)} = <b>${pgcd}</b>`) }), h('span', { class: 'pill good', html: F(`PPCM = everything = <b>${ppcm}</b>`) }),
        h('span', { class: 'pill hot', html: F(`PGCD × PPCM = ${pgcd * ppcm} &nbsp; and &nbsp; ${st.a} × ${st.b} = ${st.a * st.b}`) }));
      venn.mid = mid.length;
    }
    draw();
    guided('#venn-steps', 'primes.venn', {
      finale: '🎉 **PGCD = the middle bricks, PPCM = every brick once.** And PPCM × PGCD = a × b — a perfect way to check two-number answers.',
      steps: [
        { type: 'action', q: 'Set the two numbers to **36** and **48** (slide them, or tap the “36 & 48” chip).', btn: 'Numbers set', check: () => (st.a === 36 && st.b === 48) || 'First number 36, second number 48.', ok: 'Look at the middle of the bubbles.' },
        { q: 'How many **2-bricks** are in the middle (shared)? 36 = 2×2×3×3 and 48 = 2×2×2×2×3.', type: 'number', answer: 2, nudge: '36 has two 2s, 48 has four 2s. Shared = the smaller count.', ok: 'Two 2s, and one 3 in the middle.' },
        { q: 'PGCD = multiply **the middle bricks** (2 × 2 × 3). What do you get?', type: 'number', answer: 12, nudge: '2 × 2 = 4, then × 3.', ok: '**PGCD (36, 48) = 12**' },
        { q: 'PPCM = multiply **every brick in the picture**. What do you get?', type: 'number', answer: 144, nudge: 'Middle × left × right: 12 × 3 × 4 — or 2×2×2×2×3×3.', ok: '**PPCM (36, 48) = 144**' },
        { q: 'PPCM × PGCD = ?', type: 'number', answer: 1728, nudge: '144 × 12.', ok: '1728 — exactly 36 × 48!' },
        { type: 'choice', q: 'So for **two** numbers a and b, PPCM × PGCD equals…', choices: ['a + b', 'a × b', 'a ÷ b'], answer: 1, ok: '**a × b**. Use it to double-check!', wrongMsgs: { 0: '36 + 48 = 84, not 1728.', 2: 'The pictures show a product: 1728 = 36 × 48.' } },
        { type: 'choice', q: 'Tap the “**11 & 12**” chip (consecutive numbers). The middle is…', choices: ['empty → PGCD = 1', 'full of bricks'], answer: 0, ok: 'Nothing shared → **PGCD = 1**, and PPCM = 11 × 12 = 132.', wrongMsgs: { 1: 'Look at the picture: 11 is prime, 12 = 2×2×3. Any shared brick?' } },
      ],
    });
  }
  const venn = {};

  /* ============================================================== divide-down ladder */
  function labLadder() {
    const SETS = { a: [72, 80, 180], b: [48, 60, 90], c: [36, 48] };
    const st = { set: 'a', mode: 'ppcm', rows: [], primes: [], done: false };
    const root = $('#ladder-lab'), table = h('table', { class: 'ladder' }), msg = h('div', { class: 'readout' }), btns = h('div', { class: 'primebtns' });
    const modeTog = h('div', { class: 'toggle' }, [['ppcm', 'PPCM'], ['pgcd', 'PGCD']].map(([m, l]) => h('button', { 'data-m': m, class: m === st.mode ? 'on' : '', onclick: () => { st.mode = m; reset(); } }, l)));
    const setChips = h('div', { class: 'chips2' }, [['a', '72, 80, 180'], ['b', '48, 60, 90'], ['c', '36, 48']].map(([k, l]) => h('button', { 'data-k': k, class: k === st.set ? 'on' : '', onclick: () => { st.set = k; reset(); } }, l)));
    [2, 3, 5, 7].forEach((p) => btns.append(h('button', { class: 'btn small', style: { background: `linear-gradient(180deg, ${pc(p)}, ${pc(p)})` }, onclick: () => divide(p) }, `÷ ${p}`)));
    btns.append(h('button', { class: 'btn small ghost', onclick: () => { if (st.primes.length) { st.primes.pop(); st.rows.pop(); st.done = false; draw(); say('Undone.'); } } }, '↶ Undo'), h('button', { class: 'btn small ghost', onclick: reset }, '↺ Restart'));
    root.append(modeTog, setChips, btns, table, msg);
    ladder.state = st;
    function reset() {
      st.rows = [SETS[st.set].slice()]; st.primes = []; st.done = false;
      $$('button', modeTog).forEach((b) => b.classList.toggle('on', b.dataset.m === st.mode)); $$('button', setChips).forEach((b) => b.classList.toggle('on', b.dataset.k === st.set));
      draw(); say(st.mode === 'ppcm' ? 'PPCM mode: divide by a prime that fits at least one number. Finish when every number is 1.' : 'PGCD mode: divide ONLY by a prime that fits ALL the numbers. Finish when no prime fits them all.');
    }
    function say(text, cls) { msg.replaceChildren(h('span', { class: 'pill ' + (cls || ''), html: F(text) })); }
    function divide(p) {
      if (st.done) { say('Already finished — press ↶ Undo or ↺ Restart to try again.'); return; }
      const cur = st.rows[st.rows.length - 1];
      if (st.mode === 'pgcd' ? !cur.every((n) => n % p === 0) : !cur.some((n) => n % p === 0)) {
        say(st.mode === 'pgcd' ? `${p} does not divide <b>all</b> of ${cur.join(', ')} — PGCD only uses primes that fit every number.` : `${p} does not divide any of them. Try another prime.`, 'hot'); return;
      }
      st.primes.push(p); st.rows.push(cur.map((n) => (n % p === 0 ? n / p : n)));
      draw();
    }
    function draw() {
      const cur = st.rows[st.rows.length - 1], set = SETS[st.set];
      st.done = st.mode === 'ppcm' ? cur.every((n) => n === 1) : ![2, 3, 5, 7].some((p) => cur.every((n) => n % p === 0));
      table.replaceChildren(h('tr', {}, h('th', {}, 'prime'), set.map((n) => h('th', {}, n))),
        ...st.rows.map((r, i) => h('tr', { class: 'n' }, i < st.primes.length ? h('td', { class: 'p', style: { '--c': pc(st.primes[i]) } }, h('span', {}, st.primes[i])) : h('td', { class: 'p' }), r.map((n) => h('td', { class: n === 1 ? 'one' : '' }, n)))));
      if (st.done) {
        const result = st.primes.reduce((x, y) => x * y, 1);
        say(`<b>Finished!</b> ${st.mode.toUpperCase()} = ${st.primes.join(' × ') || '1'} = <b>${result}</b>`, 'good');
        st.result = result;
      } else if (st.primes.length) say(`Keep going — ${st.mode === 'pgcd' ? 'is there a prime that fits ALL of them?' : 'numbers that are not 1 yet need more primes.'}`);
    }
    reset();
    guided('#ladder-steps', 'primes.ladder', {
      finale: '🎉 **Same ladder, two rules.** PPCM: divide whatever fits until all are 1 · PGCD: divide only what fits *all*, until nothing fits.',
      steps: [
        { type: 'action', q: 'Choose **PPCM** and the numbers **72, 80, 180**. Divide by primes until the last row is all **1**s.', btn: 'It is finished', check: () => (st.done && st.mode === 'ppcm' && st.set === 'a') || (st.mode !== 'ppcm' || st.set !== 'a' ? 'Choose PPCM mode and the 72, 80, 180 chip.' : 'Keep dividing — every number must reach 1.'), ok: 'The primes on the left are your bricks.' },
        { q: 'PPCM (72, 80, 180) = the **product of the primes** on the left. What is it?', type: 'number', answer: 720, nudge: 'It is shown in the green message under the ladder.', hint: '2×2×2×2×3×3×5', ok: '**720.**' },
        { type: 'action', q: 'Now choose **PGCD** and **48, 60, 90**. Divide **only by a prime that fits all three**, until none does.', btn: 'It is finished', check: () => (st.done && st.mode === 'pgcd' && st.set === 'b') || (st.mode !== 'pgcd' || st.set !== 'b' ? 'Choose PGCD mode and the 48, 60, 90 chip.' : 'Is there another prime that divides all three numbers?'), ok: 'You stopped when no prime fit all three.' },
        { q: 'PGCD (48, 60, 90) = ?', type: 'number', answer: 6, nudge: 'Multiply the primes on the left (2 and 3).', ok: '**6.**' },
        { type: 'choice', q: 'Why couldn’t you use **5** in the PGCD ladder?', choices: ['5 does not divide 48', '5 is too small', '5 is not prime'], answer: 0, ok: '5 is missing from 48 — PGCD only keeps bricks **every** number has.', wrongMsgs: { 1: 'Size isn’t the issue. Does 5 divide every number?', 2: '5 is prime. Check 48 ÷ 5.' } },
      ],
    });
  }
  const ladder = {};

  /* ============================================================== bags (marbles) */
  function labBags() {
    const st = { n: 5 }, C = [['🔴 red', 48], ['🔵 blue', 64], ['🟢 green', 112]];
    const root = $('#bags-lab'), chipRow = h('div', { class: 'chipsrow' }), list = h('div', { class: 'baglist' }), out = h('div', { class: 'readout' });
    const sl = slider('🎒 Number of bags', 1, 32, 1, st.n, 'bags', (v) => { st.n = v; draw(); });
    root.append(sl.row, h('div', { class: 'flabel' }, 'Green = every colour shares out evenly (no marble left over)'), chipRow, list, out);
    bags.st = st;
    const ok = (n) => C.every(([, t]) => t % n === 0);
    function draw() {
      chipRow.replaceChildren(...Array.from({ length: 32 }, (_, i) => h('span', { class: (ok(i + 1) ? 'ok ' : '') + (i + 1 === st.n ? 'cur' : '') }, i + 1)));
      const even = ok(st.n);
      list.replaceChildren(...Array.from({ length: Math.min(st.n, 32) }, (_, i) => h('div', { class: 'bag' + (even ? '' : ' leftover') }, '🎒', h('br'), ...C.map(([nm, t]) => h('div', {}, `${nm.split(' ')[0]} ${Math.floor(t / st.n)}`)))));
      out.replaceChildren(...C.map(([nm, t]) => h('span', { class: 'pill ' + (t % st.n ? 'hot' : 'good') }, `${nm}: ${t} ÷ ${st.n} = ${Math.floor(t / st.n)}${t % st.n ? ' r ' + (t % st.n) : ''}`)),
        h('span', { class: 'pill ' + (even ? 'good' : 'hot') }, even ? '✅ nothing left over' : '❌ marbles left over'));
    }
    draw();
    guided('#bags-steps', 'pgcd.bags', {
      finale: '🎉 **The numbers of bags that work are exactly the divisors of the PGCD (48, 64, 112) = 16** — and 16 is the biggest. 1, 2, 4, 8, 16.',
      steps: [
        { type: 'choice', q: 'Slide to **5 bags**. Are there marbles left over?', choices: ['No, it shares out evenly', 'Yes — some marbles are left over'], answer: 1, ok: '5 doesn’t divide 48, 64 or 112 → leftovers (red).', wrongMsgs: { 0: 'Check the red pills: 48 ÷ 5 = 9 remainder 3.' } },
        { q: 'How many **green** squares are there (numbers of bags that work, from 1 to 32)?', type: 'number', answer: 5, nudge: 'Slide through the numbers, or look at the green chips: 1, 2, 4, …', ok: 'Five choices: 1, 2, 4, 8, 16.' },
        { q: 'He wants the **most** bags possible. How many bags?', type: 'number', answer: 16, nudge: 'The biggest green number.', ok: '**16 bags** = PGCD (48, 64, 112).' },
        { q: 'With 16 bags, how many marbles are in **one bag** altogether (red + blue + green)?', type: 'number', answer: 14, nudge: '48 ÷ 16 + 64 ÷ 16 + 112 ÷ 16.', hint: '3 + 4 + 7', ok: '3 red + 4 blue + 7 green = **14** per bag.' },
      ],
    });
  }
  const bags = {};

  /* ============================================================== sorter game */
  function labSorter() {
    const clues = shuffle([
      ['Three clocks ring together. When will they ring together <b>again</b>?', 'ppcm', '“Together again” means the first shared multiple.'],
      ['Share 48 red and 64 blue marbles into the <b>most identical bags</b> possible.', 'pgcd', '“Most identical groups, nothing left” is the biggest shared divisor.'],
      ['Two buses leave every 12 and 18 min. When do they leave <b>together</b> next?', 'ppcm', 'They meet at a common multiple — the first one.'],
      ['Cut a 36 cm × 48 cm board into the <b>biggest square tiles</b>, none left over.', 'pgcd', 'The tile side divides both lengths — as big as possible.'],
      ['What is the <b>smallest number</b> that 6 and 8 both divide?', 'ppcm', '“Smallest number both go into” = smallest common multiple.'],
      ['What is the <b>biggest number that divides</b> both 18 and 30?', 'pgcd', '“Biggest number that divides both” is the PGCD.'],
      ['Add [[1/4]] + [[1/6]]: find the <b>smallest common denominator</b>.', 'ppcm', 'The common denominator is a common multiple of 4 and 6 — the smallest is the PPCM.'],
      ['Simplify [[18/30]] in <b>one step</b>: divide top and bottom by the…', 'pgcd', 'Divide by the biggest number that goes into both.'],
    ]);
    const root = $('#sorter-lab'), card = h('div', { class: 'sorter-card' }), msg = h('div', { class: 'sorter-msg' }), count = h('div', { class: 'readout', style: { justifyContent: 'center' } });
    const btn = (id, label, sub, c) => h('button', { style: { background: c }, onclick: () => answer(id) }, label, h('small', {}, sub));
    const btns = h('div', { class: 'sorter-btns' }, btn('ppcm', '🔔 PPCM', 'meet again · smallest', 'linear-gradient(180deg,#a78bfa,#6d28d9)'), btn('pgcd', '🎒 PGCD', 'share equally · biggest', 'linear-gradient(180deg,#34d399,#047857)'));
    root.append(h('div', { class: 'sorter' }, count, card, btns, msg));
    let i = 0, wrongNow = 0, busy = false;
    const show = () => {
      if (i >= clues.length) { card.innerHTML = '🏆 Deck complete!'; btns.style.display = 'none'; msg.className = 'sorter-msg ok'; msg.textContent = 'You can tell “meet again” from “share equally”!'; count.replaceChildren(h('span', { class: 'pill good' }, `${clues.length} / ${clues.length}`));
        if (MC.award(WEEK, PAGE, 'pgcd.sorter', 10)) MC.confetti(70); refreshSkills(true); return; }
      card.innerHTML = F(clues[i][0]); card.classList.remove('deal'); void card.offsetWidth; card.classList.add('deal'); wrongNow = 0;
      count.replaceChildren(h('span', { class: 'pill' }, `Card ${i + 1} of ${clues.length}`));
    };
    function answer(id) {
      if (busy || i >= clues.length) return;
      if (id === clues[i][1]) { msg.className = 'sorter-msg ok'; msg.innerHTML = F('✅ ' + clues[i][2]); busy = true; setTimeout(() => { i++; busy = false; show(); }, 900); }
      else { wrongNow++; msg.className = 'sorter-msg bad'; msg.innerHTML = F('🤔 Think again: ' + (wrongNow > 1 ? clues[i][2] : 'is it about meeting again, or sharing equally?')); }
    }
    show();
  }

  /* ============================================================== pay (fractions review) */
  function labPay() {
    guided('#pay-steps', 'review.pay', {
      finale: `🎉 **$1272.** The PPCM (10, 20, 50) = 100 gave the common denominator, then: add the cuts, subtract from 1, take that fraction of 1200, double it.`,
      steps: [
        { q: 'To add [[3/10]] + [[3/20]] + [[1/50]] we need the same-size pieces. What is the **PPCM of 10, 20 and 50**?', type: 'number', answer: 100, nudge: '10 = 2×5, 20 = 2²×5, 50 = 2×5². Highest powers: 2² × 5².', ok: 'Hundredths!' },
        { q: `${fr(3, 10)} = ?/100`, type: 'number', answer: 30, nudge: '100 ÷ 10 = 10, then × 3.', ok: `${fr(3, 10)} = ${fr(30, 100)}` },
        { q: `${fr(3, 20)} = ?/100`, type: 'number', answer: 15, nudge: '100 ÷ 20 = 5, then × 3.', ok: `${fr(3, 20)} = ${fr(15, 100)}` },
        { q: `${fr(1, 50)} = ?/100`, type: 'number', answer: 2, nudge: '100 ÷ 50 = 2.', ok: `${fr(1, 50)} = ${fr(2, 100)}` },
        { q: 'What **fraction of the pay is taken away** in total? (as a decimal or fraction)', type: 'number', answer: 0.47, tol: T, nudge: '30 + 15 + 2 hundredths.', ok: `${fr(47, 100)} is taken away.` },
        { q: 'What fraction does the worker **keep**?', type: 'number', answer: 0.53, tol: T, nudge: 'A whole is 100/100. Take away the 47/100.', ok: `${fr(53, 100)} is kept.` },
        { q: 'How many dollars is that in **one week** (of $1200)?', type: 'number', answer: 636, nudge: '1200 ÷ 100 = 12 per hundredth, then × 53.', ok: '12 × 53 = $636.' },
        { q: 'And for the **two-week pay**?', type: 'number', answer: 1272, nudge: 'Two weeks = double one week.', hint: 'Not 564 — that is what is taken away in one week.', ok: '**$1272**' },
      ],
    });
  }

  [labRace, missionClocks, labVenn, labLadder, labBags, labSorter, labPay].forEach((fn) => { try { fn(); } catch (e) { console.error('lab failed:', fn.name, e); } });
  refreshSkills(false);
})();
