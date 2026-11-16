/* Week 10 lesson — CJMC prep: blank or guess?, the game plan, and Sam's smart moves from the 2024 paper.
 * Each lab = something to play with + a "guided" worked example where YOU do each step. */
(function () {
  'use strict';
  const { h, svg, $, $$ } = MC;
  const WEEK = 'week10', PAGE = 'lesson';
  const F = (s) => MC.fmt(s);

  $$('.mission .ask, .mission .orig, .nova .say, .big-idea small, .callout').forEach((el) => { el.innerHTML = MC.fmt(el.innerHTML); });

  /* ------------------------------------------------------------ badges / progress */
  const SKILLS = {
    guess: { label: 'Blank or guess?', emoji: '🎲', color: '#3b82f6', tasks: ['w10.expect', 'w10.rule'] },
    plan:  { label: 'Game plan',       emoji: '⏱️', color: '#10b981', tasks: ['w10.plan'] },
    moves: { label: 'Smart moves',     emoji: '🧰', color: '#f59e0b', tasks: ['w10.commas', 'w10.blocks', 'w10.fact'] },
    cases: { label: 'Worst case & fractions', emoji: '🔍', color: '#8b5cf6', tasks: ['w10.venn', 'w10.dice', 'w10.forest'] },
  };
  const BADGE_TEXT = {
    guess: 'A guess is worth chance × points. You know when to guess and when to leave it blank!',
    plan: 'Easy first, 60 minutes for Part C. You have a game plan!',
    moves: 'Count the gaps, test a choice, chain the factorials. Smart moves unlocked!',
    cases: 'Worst case, case work and fractions of the side. Problem-cracker badge!',
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
  const pill = (text, cls) => h('span', { class: 'pill' + (cls ? ' ' + cls : ''), html: F(text) });
  const chip = (text, on, fn, extra) => h('button', { class: on ? 'on' : '', onclick: fn, ...(extra || {}) }, text);
  const S = (w, hh, ...kids) => svg('svg', { viewBox: `0 0 ${w} ${hh}`, style: `width:100%;max-width:${w}px;display:block;margin:8px auto;background:#fff;border:3px solid #e1e4fb;border-radius:14px` }, ...kids);
  const T = (x, y, text, o = {}) => svg('text', Object.assign({ x, y, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, fill: '#1d2150', 'font-family': 'Nunito, sans-serif' }, o), text);
  const R = (x, y, w, hh, o = {}) => svg('rect', Object.assign({ x, y, width: w, height: hh, fill: '#fff', stroke: '#1d2150', 'stroke-width': 2 }, o));
  const L = (x1, y1, x2, y2, o = {}) => svg('line', Object.assign({ x1, y1, x2, y2, stroke: '#1d2150', 'stroke-width': 2 }, o));

  /* ============================================================== world 1: blank or guess */
  const PARTS = [
    { id: 'A', label: 'Part A', opts: 4, pts: 5 }, { id: 'B', label: 'Part B', opts: 5, pts: 5 },
    { id: 'C', label: 'Part C', opts: 5, pts: 6 }, { id: 'Y', label: '2021 · Part A', opts: 5, pts: 4 },
  ];
  const G = { part: 'C', out: 0, runs: [] };
  function labGuess() {
    const root = $('#guess-lab');
    const partRow = h('div', { class: 'qtty' }), outRow = h('div', { class: 'qtty' }), info = h('div', { class: 'readout' }), chart = h('div'), summary = h('div', { class: 'readout' });
    const cur = () => PARTS.find((p) => p.id === G.part);
    const reset = () => { G.runs = []; draw(); };
    function drawChips() {
      const P = cur();
      partRow.replaceChildren(h('span', {}, '📄 Which part?'), ...PARTS.map((p) => chip(`${p.label} · ${p.opts} options · ${p.pts} pts`, p.id === G.part, () => { G.part = p.id; G.out = Math.min(G.out, p.opts - 1); reset(); }, { 'data-part': p.id })));
      outRow.replaceChildren(h('span', {}, '✂️ Options crossed out:'), ...Array.from({ length: P.opts }, (_, i) => chip(String(i), i === G.out, () => { G.out = i; reset(); }, { 'data-out': i })));
    }
    function run(times) {
      const P = cur(), k = P.opts - G.out;
      for (let t = 0; t < times; t++) {
        let right = 0; for (let q = 0; q < 100; q++) if (Math.random() < 1 / k) right++;
        G.runs.push({ right, pts: right * P.pts });
      }
      G.runs = G.runs.slice(-20); draw();
    }
    function draw() {
      drawChips();
      const P = cur(), k = P.opts - G.out, per = P.pts / k, verdict = per > 1.001 ? ['Guess!', 'good'] : per < 0.999 ? ['Leave it blank', 'hot'] : ['Same as blank', ''];
      info.replaceChildren(pill(`chance a guess is right: <b>1 in ${k}</b>`), pill(`average per guess: ${P.pts} ÷ ${k} = <b>${+per.toFixed(2)}</b>`), pill('blank: <b>1</b>'), pill(`<b>${verdict[0]}</b>`, verdict[1]));
      // chart of the runs
      const W = 440, H = 170, base = 140, maxPts = Math.max(150, ...G.runs.map((r) => r.pts)) * 1.1, Y = (v) => base - (v / maxPts) * 120;
      const kids = [L(30, base, W - 10, base), L(30, Y(100), W - 10, Y(100), { stroke: '#b3261e', 'stroke-dasharray': '6 4' }), T(W - 14, Y(100) - 5, 'blank = 100', { 'text-anchor': 'end', fill: '#b3261e', 'font-size': 12 })];
      const bw = Math.min(20, (W - 50) / 20 - 3);
      G.runs.forEach((r, i) => kids.push(R(36 + i * (bw + 3), Y(r.pts), bw, base - Y(r.pts), { fill: r.pts > 100 ? '#7ee8c0' : r.pts < 100 ? '#ffd08a' : '#c9ccf2', 'stroke-width': 1.5 }), T(36 + i * (bw + 3) + bw / 2, Y(r.pts) - 4, r.pts, { 'font-size': 9 })));
      if (!G.runs.length) kids.push(T(W / 2, 80, 'Press “Run 100 questions” →', { fill: '#666d96', 'font-size': 15 }));
      chart.replaceChildren(S(W, H, ...kids));
      const last = G.runs[G.runs.length - 1], avg = G.runs.reduce((a, r) => a + r.pts, 0) / (G.runs.length || 1);
      summary.replaceChildren(...(last ? [pill(`last run: <b>${last.right}</b> right × ${P.pts} = <b>${last.pts}</b> points (blank: 100)`), pill(`average of ${G.runs.length} run${G.runs.length > 1 ? 's' : ''}: <b>${Math.round(avg)}</b>`, avg > 100 ? 'good' : 'hot')] : [pill('Close your eyes and guess…')]));
    }
    root.append(partRow, outRow, info, h('div', { class: 'runrow' }, h('button', { class: 'btn small go', id: 'run1', onclick: () => run(1) }, '🎲 Run 100 questions'), h('button', { class: 'btn small', id: 'run20', onclick: () => run(20) }, '🎲×20 Run 20 tests'), h('button', { class: 'btn small ghost', onclick: reset }, 'Clear')), chart, summary);
    draw();
    guided('#expect-steps', 'w10.expect', {
      finale: '🎉 **Expected value = chance × points.** Part C: ⅕ × 6 = 1.2 per guess, so 100 guesses ≈ 120 points — more than the 100 for blank. “Expected value” is an idea from probability theory (Sam’s note!).',
      steps: [
        { type: 'action', q: 'Set the simulator to **Part C** with **0** options crossed out, then run it a few times.', btn: 'It is set', check: () => (G.part === 'C' && G.out === 0) || 'Choose “Part C” and cross out 0 options.', ok: 'The totals bounce around 120 — but not on 100 every time.' },
        { q: 'You guess **100** Part C questions (5 options). About how many are **right**? (1 in 5)', type: 'number', answer: 20, nudge: '100 ÷ 5.', ok: 'About **20** right.' },
        { q: '20 right × **6 points** = how many points?', type: 'number', answer: 120, nudge: '20 × 6.', ok: '**120** points from guessing.' },
        { q: 'You leave all 100 questions **blank**. How many points?', type: 'number', answer: 100, nudge: '1 point each.', ok: '**100** points.' },
        { type: 'choice', q: 'So in Part C, a blind guess is…', choices: ['worth more than blank', 'worth less than blank', 'exactly the same as blank'], answer: 0, ok: '120 > 100 — **always answer Part C!**', wrongMsgs: { 1: 'Compare 120 with 100 again.', 2: '120 is not 100.' } },
      ],
    });
    guided('#rule-steps', 'w10.rule', {
      finale: '🎉 **Rule for Part B: guess once you can cross out even 1 option.** With 5 options a blind guess earns exactly the 1 point of a blank; every crossed-out option pushes it above 1. Part A (4 options, 5 points) is worth 1¼ even with no crossing out.',
      steps: [
        { q: '**Part B**: 5 options, **5 points**. You guess 100 questions. About how many are right?', type: 'number', answer: 20, nudge: '1 in 5 of 100.', ok: 'About **20**.' },
        { q: '20 right × 5 points = ?', type: 'number', answer: 100, nudge: '20 × 5.', ok: '**100** points.' },
        { type: 'choice', q: 'Blank gives 100 points too. A blind guess in Part B is…', choices: ['better than blank', 'exactly the same as blank', 'worse than blank'], answer: 1, ok: '**The same** — so with no extra clue it’s a coin-flip decision.', wrongMsgs: { 0: '100 vs 100 — is one bigger?', 2: '100 vs 100 — is one smaller?' } },
        { type: 'action', q: 'In the simulator pick **Part B** and **cross out 1** option, then press “Run 20 tests”. Do most bars beat the red line?', btn: 'Done', check: () => (G.part === 'B' && G.out === 1) || 'Choose “Part B” and 1 crossed-out option.', ok: 'Most bars should now sit above 100.' },
        { q: 'Now **4** options are left. About how many of 100 guesses are right?', type: 'number', answer: 25, nudge: '100 ÷ 4.', ok: '**25**.' },
        { q: '25 × 5 points = ?', type: 'number', answer: 125, nudge: '25 × 5.', ok: '**125** — beats the 100 for blank.' },
        { type: 'choice', q: 'The Part B rule is…', choices: ['Never guess in Part B', 'Guess once you can cross out even 1 option', 'Always guess without thinking'], answer: 1, ok: 'Cross out first, **then** guess. 🎯', wrongMsgs: { 0: 'With one option crossed out a guess is worth 125 per 100 — better than blank.', 2: 'With no clue it is only equal to blank — so think first.' } },
      ],
    });
  }

  /* ============================================================== world 2: game plan */
  const PL = { a: 10, b: 20 };
  function labPlan() {
    const root = $('#plan-lab'), bar = h('div'), out = h('div', { class: 'readout' }), note = h('div');
    const sA = slider('🅰️ Part A', 4, 40, 1, PL.a, 'min', (v) => { PL.a = v; draw(); });
    const sB = slider('🅱️ Part B', 4, 60, 1, PL.b, 'min', (v) => { PL.b = v; draw(); });
    const sam = h('button', { class: 'btn small warm', id: 'sam-plan', onclick: () => { PL.a = 10; PL.b = 20; sA.inp.value = 10; sB.inp.value = 20; sA.sync(); sB.sync(); draw(); } }, '⭐ Sam’s plan');
    root.append(sA.row, sB.row, h('div', { class: 'runrow' }, sam), bar, out, note);
    function draw() {
      const c = 90 - PL.a - PL.b, w = (m) => Math.max(0, m) / 90 * 100;
      bar.replaceChildren(h('div', { class: 'timebar' }, h('i', { style: { width: w(PL.a) + '%', background: '#8fbaff' } }, 'A ' + PL.a), h('i', { style: { width: w(PL.b) + '%', background: '#7ee8c0' } }, 'B ' + PL.b), h('i', { style: { width: w(c) + '%', background: '#ffd08a' } }, c > 0 ? 'C ' + c : '')));
      out.replaceChildren(pill(`🅰️ <b>${+(PL.a / 5).toFixed(1)}</b> min per question`), pill(`🅱️ <b>${+(PL.b / 5).toFixed(1)}</b> min per question`), pill(`🏆 <b>${c > 0 ? +(c / 5).toFixed(1) : 0}</b> min per question`, c / 5 >= 10 ? 'good' : 'hot'));
      note.replaceChildren(c <= 0 ? pill('No time left for Part C!', 'hot') : c / 5 < 8 ? pill('Part C is the hardest part — it needs more than that.', 'hot') : pill(c / 5 >= 12 ? 'Part C gets lots of thinking time. 👍' : 'OK — but can you save time in A and B?', 'good'));
    }
    draw();
    guided('#plan-steps', 'w10.plan', {
      finale: '🎉 **Sam’s plan:** Part A 10 min (2 each) · Part B 20 min (4 each) · Part C 60 min (12 each). Easy first — and never sit on one question forever.',
      steps: [
        { type: 'action', q: 'Press **Sam’s plan** (Part A = 10 min, Part B = 20 min).', btn: 'Check', check: () => (PL.a === 10 && PL.b === 20) || 'Press the “Sam’s plan” button.', ok: 'Look at the bar.' },
        { q: 'How many minutes are left for **Part C**? (90 − 10 − 20)', type: 'number', answer: 60, nudge: '90 − 30.', ok: '**60** minutes.' },
        { q: 'Part C has **5** questions. Minutes for each?', type: 'number', answer: 12, nudge: '60 ÷ 5.', ok: '**12** minutes each.' },
        { q: 'Part A has 5 questions in 10 minutes. Minutes for each?', type: 'number', answer: 2, nudge: '10 ÷ 5.', ok: '**2** minutes each.' },
        { type: 'choice', q: 'You are stuck on a Part A question after 2 minutes. The best move is…', choices: ['Stay until it is solved', 'Mark it, move on, come back later', 'Panic'], answer: 1, ok: 'Mark it and **come back later** — easy points first.', wrongMsgs: { 0: 'A stuck question can eat the time you need for Part C.', 2: 'Breathe! 😄 Move on and come back.' } },
      ],
    });
  }

  /* ============================================================== world 3: smart moves */
  function labFence() {
    const root = $('#fence-lab'), row = h('div', { class: 'fence' }), out = h('div', { class: 'readout' });
    const s = slider('🔢 Last number', 2, 12, 1, 11, '', (v) => draw(v));
    root.append(s.row, row, out);
    function draw(n) {
      const kids = [];
      for (let i = 1; i <= n; i++) { kids.push(h('span', { class: 'num' }, i)); if (i < n) kids.push(h('span', { class: 'comma' }, ',')); }
      row.replaceChildren(...kids);
      const digits = Array.from({ length: n }, (_, i) => String(i + 1).length).reduce((a, b) => a + b, 0);
      out.replaceChildren(pill(`<b>${n}</b> numbers`), pill(`only <b>${n - 1}</b> commas`, 'good'), pill(`digit keys: <b>${digits}</b>`), pill(`total: ${digits} + ${n - 1} = <b>${digits + n - 1}</b> key presses${n === 11 ? ' ✅ the contest’s 23!' : ''}`));
    }
    draw(11);
    guided('#commas-steps', 'w10.commas', {
      finale: '🎉 **291 key presses.** The classic slip is 292: that counts 100 commas, but there is no comma after the last number — N numbers have N − 1 gaps.',
      steps: [
        { q: '100 numbers in a row. How many **commas** between them?', type: 'number', answer: 99, nudge: 'Look at the slider: 11 numbers had 10 commas.', ok: '**99** commas.' },
        { q: 'Numbers **1 to 9** have one digit each. How many keys?', type: 'number', answer: 9, nudge: '9 × 1.', ok: '**9** keys.' },
        { q: 'How many numbers are there from **10 to 99**?', type: 'number', answer: 90, nudge: '99 − 10 + 1.', ok: '**90** numbers.' },
        { q: 'Each of those has 2 digits. How many keys?', type: 'number', answer: 180, nudge: '90 × 2.', ok: '**180** keys.' },
        { q: 'The number **100** has how many digits?', type: 'number', answer: 3, nudge: '1, 0, 0.', ok: '**3** keys.' },
        { q: 'Add it all up: **99 + 9 + 180 + 3** =', type: 'number', answer: 291, nudge: '99 + 9 = 108, then 108 + 180 = 288.', ok: '**291** → (D).' },
      ],
    });
  }

  function labBlocks() {
    const root = $('#blocks-lab'), out = h('div', { class: 'readout' }), row = h('div', { class: 'bagrow' });
    const s = slider('🟦 Big at the start', 0, 100, 1, 50, '', (v) => draw(v));
    root.append(s.row, row, out);
    function draw(b) {
      const small = 100 - b, ok = small % 3 === 0, end = b + small / 3;
      row.replaceChildren(...Array.from({ length: Math.min(100, 100) }, (_, i) => h('span', { class: 'blk ' + (i < b ? 'big' : 'sml') })));
      out.replaceChildren(pill(`start: <b>${b}</b> big + <b>${small}</b> small = 100`),
        ok ? pill(`combine ${small} ÷ 3 = <b>${small / 3}</b> times → <b>${end}</b> big at the end ${end === 40 ? '🎯' : ''}`, end === 40 ? 'good' : '') : pill(`${small} small blocks can’t all be combined: <b>${small % 3}</b> would be left over`, 'hot'),
        ok ? pill(`each combine: 3 blocks → 1, the total drops by <b>2</b>`) : null);
    }
    draw(50);
    guided('#blocks-steps', 'w10.blocks', {
      finale: '🎉 **10 big blocks.** Tempting trap: 100 − 40 = 60 and 60 ÷ **3** = 20 — but each combine removes only **2** blocks from the total (3 become 1), so 60 ÷ **2** = 30 combines, 90 small blocks, 10 big.',
      steps: [
        { type: 'choice', q: 'Test it: **20 big + 80 small**. Can she combine **all** 80 small blocks?', choices: ['Yes — 80 ÷ 3 is a whole number', 'No — 80 ÷ 3 = 26 and 2 small blocks are left over'], answer: 1, ok: 'No! So 20 big **can’t** be the start. 🚫', wrongMsgs: { 0: '3 × 26 = 78. What about the other 2 blocks?' } },
        { q: 'Test **10 big + 90 small**. After combining, how many **big** blocks?', type: 'number', answer: 40, nudge: '90 ÷ 3 = 30 new big blocks, plus the 10.', ok: '10 + 30 = **40** ✅ — it works!' },
        { q: 'Another way: 100 blocks became 40 blocks. How many blocks **vanished**?', type: 'number', answer: 60, nudge: '100 − 40.', ok: '**60** vanished.' },
        { q: 'One combine turns 3 small blocks into 1 big block. How many blocks vanish **each time**?', type: 'number', answer: 2, nudge: '3 become 1…', ok: '**2** vanish each time.' },
        { q: 'So how many combines happened? (60 ÷ 2)', type: 'number', answer: 30, nudge: '60 ÷ 2.', ok: '**30** combines.' },
        { q: 'Each combine used 3 small blocks: 30 × 3 = 90 small. So how many **big** blocks at the start?', type: 'number', answer: 10, nudge: '100 − 90.', ok: '**10** → (A).' },
      ],
    });
  }

  function labFact() {
    const root = $('#fact-lab'), out = h('div'), s = slider('⛓️ n', 1, 12, 1, 4, '', (v) => draw(v));
    root.append(s.row, out);
    function draw(n) {
      let f = 1, prev = 1; const rows = [];
      for (let k = 1; k <= n; k++) {
        prev = f; f = f * k;
        rows.push(h('tr', { class: f % 10 === 0 ? 'ex-blank' : '' }, h('td', {}, `${k}!`), h('td', {}, k === 1 ? '1' : `${k} × ${prev}`), h('td', {}, f.toLocaleString('en-US').replace(/,/g, ' ')), h('td', {}, h('b', {}, f % 10))));
      }
      MC.fill(out, h('table', { class: 'ex-table' }, h('tr', {}, ['n!', '= n × (n−1)!', 'value', 'last digit'].map((t) => h('th', {}, t))), rows),
        n >= 5 ? h('div', { class: 'callout green', html: F('From 5! on every factorial is a multiple of 10 — and a multiple of 10 times anything is still a multiple of 10. It **ends in 0 forever**.') }) : null);
    }
    draw(4);
    guided('#fact-steps', 'w10.fact', {
      finale: '🎉 **Last digit 3.** Everything from 5! onward is a multiple of 10 (ends in 0), so only 1! + 2! + 3! + 4! = 1 + 2 + 6 + 24 = 33 matters.',
      steps: [
        { q: '**5!** = 5 × 4 × 3 × 2 × 1 =', type: 'number', answer: 120, nudge: '5 × 24.', ok: '**120** — it ends in 0.' },
        { q: '**6!** = 6 × 5! = 6 × 120 =', type: 'number', answer: 720, nudge: '6 × 120.', ok: '**720** — still ends in 0.' },
        { type: 'choice', q: '**7!** = 7 × 6! = 7 × 720. Its last digit is…', choices: ['0', '7', '2'], answer: 0, ok: '**0** — a multiple of 10 stays a multiple of 10.', wrongMsgs: { 1: 'Multiply 7 × 720 — what does the last digit do?', 2: '7 × 720 = 5040.' } },
        { q: 'So only the small ones matter: **1! + 2! + 3! + 4!** =', type: 'number', answer: 33, nudge: '1 + 2 + 6 + 24.', ok: '**33**.' },
        { q: 'The **last digit** of 1! + 2! + … + 2024! is…', type: 'number', answer: 3, nudge: 'The rest all end in 0 — they add nothing to the last digit.', ok: '**3** → (D).' },
      ],
    });
  }

  /* ============================================================== world 4: cases */
  function labVenn() {
    const root = $('#venn-lab'), holder = h('div'), msg = h('div', { class: 'readout' });
    const s = slider('⭕ In both clubs', 0, 42, 1, 0, 'students', (v) => draw(v));
    const mn = h('button', { class: 'btn small', id: 'venn-min', onclick: () => { s.inp.value = 7; s.sync(); draw(7); } }, 'Smallest overlap');
    const mx = h('button', { class: 'btn small warm', id: 'venn-max', onclick: () => { s.inp.value = 42; s.sync(); draw(42); } }, 'Biggest overlap');
    root.append(s.row, h('div', { class: 'runrow' }, mn, mx), holder, msg);
    function draw(x) {
      const u = 4, math = 70, phys = 42, total = 105, either = math + phys - x, over = Math.max(0, either - total), ps = math - x;
      holder.replaceChildren(S(460, 150, R(20, 14, total * u, 26, { fill: 'none', stroke: '#666d96', 'stroke-dasharray': '6 4' }), T(240, 32, 'the school: 105', { fill: '#666d96', 'font-size': 12 }),
        R(20, 48, math * u, 26, { fill: '#9db4ff' }), T(20 + (math * u) / 2, 66, 'Math club: 70'),
        R(20 + ps * u, 82, phys * u, 26, { fill: '#ffd28a' }), T(20 + (ps + phys / 2) * u, 100, 'Physics club: 42'),
        x ? R(20 + ps * u, 48, x * u, 60, { fill: '#17b26a', 'fill-opacity': 0.35, stroke: '#0c7a47', 'stroke-dasharray': '4 3' }) : null,
        over ? R(20 + total * u, 82, over * u, 26, { fill: '#ffb3ab', stroke: '#b3261e' }) : null,
        T(240, 134, x ? `in both: ${x}` : 'nobody is in both', { fill: '#0c7a47' })));
      msg.replaceChildren(pill(`in at least one club: 70 + 42 − ${x} = <b>${either}</b>`, over ? 'hot' : ''), over ? pill(`${over} too many — the school only has 105!`, 'hot') : x === 7 ? pill('🎯 the school is exactly full: the <b>smallest</b> overlap', 'good') : x === 42 ? pill('🎯 the whole physics club is inside math club: the <b>biggest</b> overlap', 'good') : pill('fits'));
    }
    draw(0);
    guided('#venn-steps', 'w10.venn', {
      finale: '🎉 **Smallest overlap = 7**: 70 + 42 = 112 memberships, only 105 students, so at least 7 are counted twice. (Biggest overlap: 42, the whole physics club inside math club.)',
      steps: [
        { q: '**⅔** of 105 students are in math club. How many?', type: 'number', answer: 70, nudge: '105 ÷ 3 × 2.', ok: '**70**.' },
        { q: '**⅖** of 105 students are in physics club. How many?', type: 'number', answer: 42, nudge: '105 ÷ 5 × 2.', ok: '**42**.' },
        { q: 'If **nobody** were in both clubs, how many different students would we need? (70 + 42)', type: 'number', answer: 112, nudge: '70 + 42.', ok: '**112**.' },
        { q: 'But the school has only **105**. So at least how many are in **both**?', type: 'number', answer: 7, nudge: '112 − 105.', ok: '**7** → (C).' },
        { type: 'choice', q: 'What is the **biggest** overlap possible?', choices: ['42 — the whole physics club is inside math club', '70', '105'], answer: 0, ok: 'The overlap can’t be bigger than the **smaller** club.', wrongMsgs: { 1: 'Physics club has only 42 students.', 2: 'The overlap can’t be bigger than a club.' } },
      ],
    });
  }

  function labDice() {
    const faces = [2, 3, 5, 7, 11, 13], root = $('#dice-lab'), out = h('div', { class: 'readout' }), last = h('div', { class: 'diceline' });
    const st = { n: 0, even: 0 };
    const faceRow = h('div', { class: 'faces' }, faces.map((f) => h('span', { class: f % 2 ? 'odd' : 'even' }, f)), h('small', {}, ' 1 even face, 5 odd faces'));
    const roll = (k) => {
      let a = 0, b = 0;
      for (let i = 0; i < k; i++) { a = faces[Math.floor(Math.random() * 6)]; b = faces[Math.floor(Math.random() * 6)]; st.n++; if ((a + b) % 2 === 0) st.even++; }
      draw(a, b);
    };
    function draw(a, b) {
      last.textContent = a ? `Last pair: ${a} + ${b} = ${a + b} (${(a + b) % 2 ? 'odd' : 'even'})` : 'Roll the dice!';
      out.replaceChildren(pill(`rolls: <b>${st.n}</b>`), pill(`even sums: <b>${st.even}</b> = <b>${st.n ? Math.round((st.even / st.n) * 1000) / 10 : 0}%</b>`), pill('exact chance: 13/18 ≈ <b>72.2%</b>', 'good'));
    }
    root.append(faceRow, h('div', { class: 'runrow' }, h('button', { class: 'btn small go', id: 'dice1', onclick: () => roll(1) }, '🎲 Roll 1 pair'), h('button', { class: 'btn small', id: 'dice100', onclick: () => roll(100) }, '🎲×100 Roll 100 pairs'), h('button', { class: 'btn small ghost', onclick: () => { st.n = 0; st.even = 0; draw(0, 0); } }, 'Clear')), last, out);
    draw(0, 0);
    guided('#dice-steps', 'w10.dice', {
      finale: '🎉 **13/18.** Case work: even + even = even (1 way) or odd + odd = even (25 ways). Sam’s way: ⅙ × ⅙ = 1/36 and ⅚ × ⅚ = 25/36 → 26/36 = 13/18 — right where the dice landed.',
      steps: [
        { q: 'How many of the six faces (2, 3, 5, 7, 11, 13) are **even**?', type: 'number', answer: 1, nudge: 'Only one prime is even.', ok: '**1** — only the prime 2.' },
        { q: 'Case 1: **both dice even**. Out of the 36 pairs, how many are (even, even)?', type: 'number', answer: 1, nudge: '1 × 1.', ok: '**1** pair: (2, 2).' },
        { q: 'Case 2: **both dice odd**. How many of the 36 pairs?', type: 'number', answer: 25, nudge: '5 odd faces × 5 odd faces.', ok: '**25** pairs.' },
        { q: 'Pairs with an **even sum** (case 1 + case 2) out of 36?', type: 'number', answer: 26, nudge: '1 + 25.', ok: '**26** out of 36.' },
        { type: 'choice', q: 'The chance of an even sum is…', choices: ['5/18', '1/2', '13/18'], answer: 2, ok: '26/36 = **13/18** → (D).', wrongMsgs: { 0: '5/18 is the chance of an **odd** sum.', 1: 'Only one face in six is even — an even sum isn’t a coin flip.' } },
      ],
    });
  }

  function labForest() {
    const root = $('#forest-lab'), holder = h('div'), out = h('div', { class: 'readout' });
    const s = slider('📏 Side of the square', 20, 100, 1, 60, 'km', (v) => draw(v));
    const six = h('button', { class: 'btn small', onclick: () => { s.inp.value = 77; s.sync(); draw(77); } }, '6000 km² forest ≈ side 77 km');
    root.append(s.row, h('div', { class: 'runrow' }, six), holder, out);
    function draw(side) {
      const px = side * 2, ox = 20, oy = 14, A = [ox, oy + px], E = [ox + px / 2, oy + px], B = [ox + px, oy + px], Gb = [ox, oy + px - px / 5], Fn = [ox + px, oy + px - (2 * px) / 3];
      const poly = (pts, fill) => svg('polygon', { points: pts.map((p) => p.join(',')).join(' '), fill, stroke: '#1d2150', 'stroke-width': 2 });
      holder.replaceChildren(S(260, 230, R(ox, oy, px, px, { fill: '#c9f2d3' }), poly([A, Gb, E], '#ffd9ac'), poly([E, B, Fn], '#9aa0ff'), T(ox + 28, oy + px - 6, '⅕', { 'font-size': 11 }), T(ox + px - 20, oy + px - 20, '⅔', { 'font-size': 11 })));
      const whole = side * side;
      out.replaceChildren(pill(`whole forest: ${side} × ${side} = <b>${whole}</b>`), pill(`brick: ½ × ½ × ⅕ = 1/20 → <b>${+(whole / 20).toFixed(1)}</b> = <b>5%</b>`), pill(`blue: ½ × ½ × ⅔ = 1/6 → <b>${+(whole / 6).toFixed(1)}</b> = <b>16.7%</b>`), pill('the shares never change!', 'good'));
    }
    draw(60);
    guided('#forest-steps', 'w10.forest', {
      finale: '🎉 **4700 km².** Brick = 1/20 of 6000 = 300, blue = 1/6 of 6000 = 1000, so green = 6000 − 300 − 1000 = 4700. The side (√6000) never mattered — Sam: “is quite easy” once you use fractions!',
      steps: [
        { type: 'choice', q: 'Do we need to work out the side of the forest, **√6000**?', choices: ['Yes — I must calculate √6000', 'No — use fractions of the side, then fractions of the area'], answer: 1, ok: 'The slider showed it: the **shares** of the area never change.', wrongMsgs: { 0: 'Slide the side in the lab — did the percentages change?' } },
        { q: 'Brick triangle: legs ½ of the bottom and ⅕ of the left side. **½ × ½ × ⅕** = what fraction of the whole square? (type 1/20)', type: 'number', answer: 0.05, tol: 0.002, nudge: '½ × ½ = ¼, and ¼ × ⅕ = ?', ok: '**1/20** of the square.' },
        { q: 'Blue triangle: legs ½ of the bottom and ⅔ of the right side. **½ × ½ × ⅔** = ? (type 1/6)', type: 'number', answer: 1 / 6, tol: 0.002, nudge: '¼ × ⅔ = ?', ok: '**1/6** of the square.' },
        { q: 'Brick area = 1/20 of **6000** km² =', type: 'number', answer: 300, nudge: '6000 ÷ 20.', ok: '**300** km².' },
        { q: 'Blue area = 1/6 of 6000 =', type: 'number', answer: 1000, nudge: '6000 ÷ 6.', ok: '**1000** km².' },
        { q: 'Green (where Canada Jays live) = 6000 − 300 − 1000 =', type: 'number', answer: 4700, nudge: '6000 − 1300.', ok: '**4700** → (B).' },
      ],
    });
  }

  labGuess(); labPlan(); labFence(); labBlocks(); labFact(); labVenn(); labDice(); labForest();
  refreshSkills(false);
})();
