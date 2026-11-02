/* Week 8 lesson — interactive labs.
 * Each lab = something to play with + a "guided" worked example where YOU do each step. */
(function () {
  'use strict';
  const { h, $, $$, clamp, shuffle, gcd, near, parseNum, money } = MC;
  const WEEK = 'week08', PAGE = 'lesson';

  // the static HTML uses [[a/b]] fractions — render them
  $$('.problem, .callout').forEach((el) => { el.innerHTML = MC.fmt(el.innerHTML); });

  /* ------------------------------------------------------------ badges / progress */
  const SKILLS = {
    rates:   { label: 'Rates',   emoji: '🚗', color: '#3b82f6', tasks: ['rates.printer', 'rates.walk', 'rates.predict', 'rates.meet'] },
    ratio:   { label: 'Ratio',   emoji: '🍰', color: '#10b981', tasks: ['ratio.cake', 'ratio.dressing'] },
    percent: { label: 'Percent', emoji: '🏷️', color: '#f59e0b', tasks: ['percent.lightning', 'percent.chain', 'percent.shirt', 'percent.undo', 'percent.order'] },
    mean:    { label: 'Mean',    emoji: '⚖️', color: '#8b5cf6', tasks: ['mean.level', 'mean.remove', 'mean.cumulative', 'mean.tug', 'mean.stats'] },
  };
  const isDone = (id) => !!(MC.store.get(WEEK, PAGE, id) || {}).done;
  const BADGE_TEXT = {
    rates: 'You find the amount for ONE, then scale. Rates are yours!',
    ratio: 'Count the parts, share the whole. Ratios are yours!',
    percent: 'A percent is a multiplier. Percent problems are yours!',
    mean: 'Work with the total. Means are yours!',
  };
  function refreshSkills(announce) {
    MC.setSkillBar(Object.values(SKILLS).map((s) => ({ label: s.label, emoji: s.emoji, color: s.color, done: s.tasks.every(isDone) })));
    if (!announce) return;
    for (const [k, s] of Object.entries(SKILLS)) {
      if (s.tasks.every(isDone) && !MC.store.get(WEEK, 'lesson-meta', 'badge.' + k)) {
        MC.store.set(WEEK, 'lesson-meta', 'badge.' + k, { seen: 1 });   // no "done" flag, so it is not counted as a task
        MC.badge(s.emoji, `${s.label} badge unlocked!`, BADGE_TEXT[k]);
      }
    }
  }
  const finish = (id, xp = 10) => { if (MC.award(WEEK, PAGE, id, xp)) MC.confetti(70); refreshSkills(true); };
  const guided = (mount, id, cfg) => MC.guided($(mount), Object.assign({ week: WEEK, page: PAGE, id, onDone: () => refreshSkills(true) }, cfg));
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const num = (v) => String(+(+v).toFixed(4));
  const slider = (label, min, max, step, value, unit, onInput) => {
    const out = h('b', {}), inp = h('input', { type: 'range', min, max, step, value });
    const sync = () => { out.textContent = `${inp.value}${unit ? ' ' + unit : ''}`; };
    inp.oninput = () => { sync(); onInput(+inp.value); }; sync();
    return { row: h('div', { class: 'slider' }, h('span', {}, label), inp, out), inp, sync };
  };

  /* ======================================================================= intro: match */
  function labMatch() {
    const root = $('#lab-match');
    const skills = [
      { id: 'rates', label: 'Rates', emoji: '🚗', color: 'var(--rates)', one: 'the amount for ONE' },
      { id: 'ratio', label: 'Ratio', emoji: '🍰', color: 'var(--ratio)', one: 'the number of parts' },
      { id: 'percent', label: 'Percent', emoji: '🏷️', color: 'var(--percent)', one: 'the multiplier' },
      { id: 'mean', label: 'Mean', emoji: '⚖️', color: 'var(--mean)', one: 'the total' },
    ];
    const clues = [['km per hour', 'rates'], ['pages per day', 'rates'], ['3 : 1', 'ratio'], ['scale on a map', 'ratio'], ['20% off', 'percent'], ['15% tax added', 'percent'], ['average of 5 numbers', 'mean'], ['remove a number from a set', 'mean']];
    let sel = null, placed = 0;
    const slots = {};
    const grid = h('div', { class: 'match' }, skills.map((s) => {
      const el = h('div', { class: 'slot', style: { '--c': s.color } }, h('h4', {}, `${s.emoji} ${s.label}`), h('div', { class: 'one' }, `ONE number → ${s.one}`));
      el.onclick = () => pick(s.id); slots[s.id] = el; return el;
    }));
    const clueRow = h('div', { class: 'clues' }, shuffle(clues).map(([t, skill]) => {
      const b = h('button', { class: 'clue' }, t);
      b.onclick = () => { if (b.classList.contains('placed')) return; $$('.clue.sel', clueRow).forEach((x) => x.classList.remove('sel')); b.classList.add('sel'); sel = { skill, b }; };
      return b;
    }));
    const win = h('div', { class: 'win', style: { display: 'none' } });
    root.append(clueRow, grid, win);
    function pick(skill) {
      if (!sel) { MC.toast('Tap a clue first 👆'); return; }
      if (sel.skill !== skill) { slots[skill].classList.remove('shake'); void slots[skill].offsetWidth; slots[skill].classList.add('shake'); MC.toast('Hmm, not that one. Is it per-ONE, parts, a multiplier, or a total?'); return; }
      sel.b.classList.remove('sel'); sel.b.classList.add('placed'); slots[skill].append(sel.b); sel = null;
      if (++placed === clues.length) {
        $$('.slot', grid).forEach((s) => s.classList.add('revealed'));
        win.style.display = ''; win.innerHTML = '🎯 Every problem becomes easy once you turn it into <b>ONE number</b> you can scale.';
        finish('intro.match');
      }
    }
  }

  /* ========================================================================= rates */
  function labPrinter() {
    const stage = $('#printer-stage'), box = $('#printer-slider');
    const lump = () => stage.replaceChildren(h('div', { class: 'boxes' }, h('div', { class: 'box lump' }, Array.from({ length: 12 }, () => h('i', { class: 'pg' })), h('small', { style: { width: '100%', textAlign: 'center' } }, '12 pages · 4 min'))));
    const boxes = (n, per) => stage.replaceChildren(
      h('div', { class: 'boxes' }, Array.from({ length: n }, (_, i) => h('div', { class: 'box' }, Array.from({ length: per }, () => h('i', { class: 'pg' })), h('small', {}, `min ${i + 1}`)))),
      h('div', { class: 'bar-label' }, `${n} minute${n > 1 ? 's' : ''} × ${per} pages = ${n * per} pages`));
    lump();
    guided('#printer-steps', 'rates.printer', {
      onStep(i) {
        if (i === 0) { boxes(4, 3); const s = slider('⏱ Minutes', 1, 15, 1, 4, 'min', (v) => boxes(v, 3)); box.append(s.row); }
      },
      finale: '🎉 **Find ONE first.** Once you know 3 pages per minute, any time is just ×3.',
      steps: [
        { q: 'The 12 pages took 4 minutes. Split them into 4 equal minute-boxes. How many pages are printed in **ONE** minute?', type: 'number', answer: 3, nudge: 'Share 12 pages equally between 4 minutes: 12 ÷ 4.', ok: '**3 pages per minute** — that’s the ONE number. Look: every minute-box holds 3 pages. A slider just appeared!' },
        { q: 'Drag the slider to **15 minutes**. How many pages get printed?', type: 'number', answer: 45, nudge: 'Fifteen minute-boxes with 3 pages each: 15 × 3.', ok: '15 × 3 = 45 pages.' },
        { q: 'Different printer: **20 pages in 5 minutes**. How many pages in **8 minutes**?', type: 'number', answer: 32, nudge: 'No picture this time — find ONE first: 20 pages ÷ 5 minutes = ? per minute. Then × 8.', ok: '20 ÷ 5 = 4 pages per minute, and 8 × 4 = 32.' },
      ],
    });
  }

  function labWalk() {
    const stage = $('#walk-stage');
    const segs = Array.from({ length: 5 }, () => h('div', { class: 'seg' }, '⅕'));
    const walker = h('em', {}, '🚶‍♀️'); segs[0].append(walker);
    stage.append(h('div', { class: 'walk' }, h('span', { class: 'end' }, '🏫'), ...segs, h('span', { class: 'end' }, '🏠')));
    guided('#walk-steps', 'rates.walk', {
      onStep(i) {
        if (i === 0) { segs.slice(0, 4).forEach((s) => { s.classList.add('walked'); s.firstChild.textContent = '10 min'; }); segs[3].append(walker); }
        if (i === 1) segs[4].classList.add('left');
        if (i === 2) { segs[4].firstChild.textContent = '10 min'; segs[4].classList.remove('left'); segs[4].classList.add('walked'); segs[4].append(walker); }
      },
      finale: '🎉 **(C) 10 minutes.** Constant speed means equal pieces take equal time — find the time for ONE piece.',
      steps: [
        { q: 'The way home is cut into **5 equal pieces**. She walked 4 of them in 40 minutes. How many minutes for **ONE** piece?', type: 'number', answer: 10, unit: 'min', nudge: '40 minutes shared over 4 pieces: 40 ÷ 4.', ok: '10 minutes per piece (see the blue pieces).' },
        { q: 'How many pieces are **left** to walk?', type: 'number', answer: 1, nudge: 'She’s walked 4 of the 5 pieces.', ok: 'Just the one orange piece.' },
        { q: 'How long will the rest take?', type: 'number', answer: 10, unit: 'min', ok: '1 piece × 10 min = **10 minutes** → (C).' },
      ],
    });
  }

  function labMeet() {
    const root = $('#meet-lab');
    const st = { mode: 'toward', vA: 50, vB: 40, gap: 120, raf: 0, ch: null, streak: 0 };
    const hm = (t) => { const m = Math.round(t * 60); return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`; };

    const bTow = h('button', { class: 'on' }, '➡️ ⬅️ Towards each other'), bCha = h('button', {}, '➡️ ➡️ Same way (catch-up)');
    const toggle = h('div', { class: 'toggle' }, bTow, bCha);
    const sA = slider('🚗 Car A speed', 10, 100, 5, st.vA, 'km/h', (v) => { st.vA = v; idle(); });
    const sB = slider('🚙 Car B speed', 10, 100, 5, st.vB, 'km/h', (v) => { st.vB = v; idle(); });
    const sG = slider('↔ Gap', 5, 600, 5, st.gap, 'km', (v) => { st.gap = v; idle(); });
    const sliders = [sA, sB, sG];
    const carA = h('div', { class: 'car flip' }, '🚗', h('small', {}, 'A')), carB = h('div', { class: 'car' }, '🚙', h('small', {}, 'B'));
    const road = h('div', { class: 'road' }, carA, carB);
    const clock = h('div', { class: 'clock' }), readout = h('div', { class: 'readout' });
    const goBtn = h('button', { class: 'btn go' }, '▶ Go'), resetBtn = h('button', { class: 'btn ghost' }, '↺ Reset'), chBtn = h('button', { class: 'btn warm' }, '🎲 Challenge me');
    const chBox = h('div', { class: 'challenge', style: { display: 'none' } });
    root.append(toggle, ...sliders.map((s) => s.row), h('div', { class: 'stage' }, road, clock), readout, h('div', { class: 'row', style: { marginTop: '10px' } }, goBtn, resetBtn, chBtn), chBox);

    const geom = () => {
      const rel = st.mode === 'toward' ? st.vA + st.vB : st.vA - st.vB;
      const t = rel > 0 ? st.gap / rel : Infinity;
      return { rel, t, view: st.mode === 'toward' ? st.gap : isFinite(t) ? st.vA * t * 1.06 : st.gap * 2 };
    };
    function place(th) {
      const { view } = geom();
      const a = st.vA * th, b = st.mode === 'toward' ? st.gap - st.vB * th : st.gap + st.vB * th;
      carA.style.left = (a / view) * 100 + '%'; carB.style.left = (b / view) * 100 + '%';
      clock.textContent = `⏱ ${hm(th)}`;
    }
    function lock(on) { sliders.forEach((s) => (s.inp.disabled = on)); bTow.disabled = bCha.disabled = on; }
    function setMode(m) { st.mode = m; bTow.classList.toggle('on', m === 'toward'); bCha.classList.toggle('on', m === 'chase'); idle(); }
    bTow.onclick = () => setMode('toward'); bCha.onclick = () => setMode('chase');

    function idle() {
      cancelAnimationFrame(st.raf);
      sliders.forEach((s) => s.sync());
      carB.classList.toggle('flip', st.mode === 'chase');
      $$('.boom', road).forEach((b) => b.remove());
      place(0);
      const g = geom();
      const closing = st.mode === 'toward' ? `${st.vA} + ${st.vB} = ${g.rel}` : `${st.vA} − ${st.vB} = ${g.rel}`;
      readout.replaceChildren();
      if (st.ch && !st.ch.reveal) readout.append(h('span', { class: 'pill' }, st.ch.tries ? `Closing speed: ${closing} km/h` : 'Closing speed: ?'), h('span', { class: 'pill' }, 'Time: ?'));
      else if (!(g.rel > 0)) readout.append(h('span', { class: 'pill hot' }, 'A is not faster than B — it will never catch up! Speed A up.'));
      else readout.append(h('span', { class: 'pill' }, `Closing speed: ${closing} km/h`), h('span', { class: 'pill hot' }, `Time: ${st.gap} ÷ ${g.rel} = ${num(g.t)} h = ${hm(g.t)}`));
      goBtn.disabled = !(g.rel > 0);
    }
    function go() {
      const g = geom(); if (!(g.rel > 0)) return;
      cancelAnimationFrame(st.raf); $$('.boom', road).forEach((b) => b.remove());
      const dur = Math.min(5000, 2200 + g.t * 700), t0 = performance.now();
      const tick = (now) => {
        const f = Math.min(1, (now - t0) / dur);
        place(g.t * f);
        if (f < 1) st.raf = requestAnimationFrame(tick);
        else road.append(h('div', { class: 'boom', style: { left: ((st.vA * g.t) / g.view) * 100 + '%' } }, st.mode === 'toward' ? '💥' : '🤝'));
      };
      st.raf = requestAnimationFrame(tick);
    }
    goBtn.onclick = go;
    resetBtn.onclick = () => {
      st.ch = null; chBox.style.display = 'none'; lock(false);
      Object.assign(st, { vA: 50, vB: 40, gap: 120 }); sA.inp.value = 50; sB.inp.value = 40; sG.inp.value = 120; setMode('toward');
    };

    // ---- predict-then-watch game
    const stars = () => '⭐'.repeat(st.streak) + '☆'.repeat(Math.max(0, 3 - st.streak));
    chBtn.onclick = () => {
      const mode = Math.random() < 0.5 ? 'toward' : 'chase';
      let vA, vB;
      do { vA = 10 * (3 + Math.floor(Math.random() * 6)); vB = 10 * (2 + Math.floor(Math.random() * 5)); } while (mode === 'chase' && vA <= vB);
      const rel = mode === 'toward' ? vA + vB : vA - vB;
      const ts = [1, 1.5, 2, 2.5, 3, 4].filter((t) => rel * t <= 600), t = ts[Math.floor(Math.random() * ts.length)];
      Object.assign(st, { vA, vB, gap: rel * t });
      sA.inp.value = vA; sB.inp.value = vB; sG.inp.value = st.gap;
      st.ch = { minutes: t * 60, tries: 0, reveal: false };
      lock(true); setMode(mode);

      const input = h('input', { type: 'text', class: 'ans', placeholder: 'minutes', inputmode: 'numeric', autocomplete: 'off' });
      const msg = h('div', { class: 'fb', style: { marginTop: '8px', fontWeight: 700 } });
      const check = () => {
        const v = parseNum(input.value);
        if (isNaN(v)) return;
        if (near(v, st.ch.minutes, 0.6)) {
          st.streak = Math.min(3, st.streak + 1); st.ch.reveal = true; idle(); go(); MC.confetti(30);
          msg.className = 'fb ok'; msg.innerHTML = `✅ Yes — ${st.ch.minutes} minutes! Watch them meet. Streak ${stars()}`;
          input.disabled = true; checkBtn.disabled = true; lock(false);
          if (st.streak >= 3) finish('rates.predict', 15);
        } else {
          st.ch.tries++; idle();
          msg.className = 'fb bad';
          msg.innerHTML = st.ch.tries === 1 ? '🤔 Not yet. I’ve shown the <b>closing speed</b> — how fast does the gap shrink? Time = gap ÷ closing speed.' : '🤔 Still off. Time (hours) = gap ÷ closing speed. Then × 60 for minutes.';
        }
      };
      const checkBtn = h('button', { class: 'btn small', onclick: check }, 'Check');
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') check(); });
      chBox.style.display = '';
      chBox.replaceChildren(h('b', {}, `🎲 Predict first! How many MINUTES until they ${mode === 'toward' ? 'meet' : 'catch up'}? `), h('span', { class: 'muted' }, ` (get 3 right to finish: ${stars()})`), h('div', { class: 'row', style: { marginTop: '8px' } }, input, checkBtn), msg);
      input.focus({ preventScroll: true });
    };
    idle();

    guided('#meet-steps', 'rates.meet', {
      finale: '🎉 **(E) 1 h 20 min.** Meet-up → add the speeds. Catch-up → subtract them.',
      steps: [
        { type: 'choice', q: 'Brodie and Ryan drive **directly towards each other**. To see how fast the gap shrinks, we…', choices: ['add the speeds', 'subtract the speeds'], answer: 0, ok: 'Towards each other — both cars eat into the gap at once, so the speeds **add**.', wrongMsgs: { 1: 'Subtracting is for the “catch-up” switch (same direction). Here they come from opposite ends.' } },
        { q: 'How fast does the 120 km gap shrink?', type: 'number', answer: 90, unit: 'km/h', nudge: '50 + 40.', ok: '50 + 40 = 90 km/h.' },
        { q: 'Time = gap ÷ closing speed = 120 ÷ 90. How many **hours**? (a fraction like 4/3 is fine)', type: 'number', answer: [4 / 3, 1.33], tol: 0.01, unit: 'h', nudge: '120 ÷ 90 simplifies to 12 ÷ 9 = 4 ÷ 3.', ok: '[[4/3]] hours = 1 and [[1/3]] hours.' },
        { q: 'How many **minutes** is [[1/3]] of an hour?', type: 'number', answer: 20, unit: 'min', ok: '60 ÷ 3 = 20 → **1 h 20 min** → (E).' },
      ],
    });
  }

  /* ========================================================================= ratio */
  function labCake() {
    const root = $('#cake-lab'), st = { a: 3, b: 1 };
    const sa = slider('🟧 Rich’s parts', 1, 9, 1, st.a, '', (v) => { st.a = v; draw(); });
    const sb = slider('🟩 Ben’s parts', 1, 9, 1, st.b, '', (v) => { st.b = v; draw(); });
    const bar = h('div', { class: 'sharebar' }), pills = h('div', { class: 'readout' });
    root.append(sa.row, sb.row, bar, pills);
    function draw() {
      const n = st.a + st.b, pc = (x) => num((x / n) * 100);
      bar.replaceChildren(h('div', { style: { flex: st.a, background: '#ff8a3d' } }, `Rich ${st.a}`), h('div', { style: { flex: st.b, background: '#10b981' } }, `Ben ${st.b}`));
      pills.replaceChildren(
        h('span', { class: 'pill' }, `Ratio Rich : Ben = ${st.a} : ${st.b}`), h('span', { class: 'pill hot' }, `Total parts = ${st.a} + ${st.b} = ${n}`),
        h('span', { class: 'pill', html: MC.fmt(`Ben’s share = [[${st.b}/${n}]] = ${pc(st.b)}%`) }), h('span', { class: 'pill', html: MC.fmt(`Rich’s share = [[${st.a}/${n}]] = ${pc(st.a)}%`) }));
    }
    draw();
    guided('#cake-steps', 'ratio.cake', {
      finale: '🎉 **(D) 25%.** 3 : 1 compares part to part. To get a percent of the whole, divide by the **total parts** (3 + 1 = 4).',
      steps: [
        { type: 'action', q: 'Set the sliders to match the problem: Rich eats **3** parts, Ben eats **1** part.', btn: 'Check sliders', check: () => (st.a === 3 && st.b === 1) || 'Rich = 3 parts, Ben = 1 part. Use the two sliders.', ok: 'The cake is cut into equal parts — Rich gets 3 of them for every 1 of Ben’s.' },
        { q: 'How many parts is the whole cake?', type: 'number', answer: 4, nudge: '3 + 1.', ok: '3 + 1 = **4 parts** in total.' },
        { type: 'choice', q: 'Which fraction of the cake did **Ben** eat?', choices: ['[[1/3]]', '[[1/4]]', '[[3/4]]'], answer: 1, ok: 'Ben has 1 part out of 4 → [[1/4]].', wrongMsgs: { 0: '[[1/3]] only compares Ben with Rich (part-to-part). The whole cake is all 4 parts.', 2: '[[3/4]] is **Rich’s** share. Re-read: the question asks about Ben.' } },
        { q: 'Write [[1/4]] as a percent.', type: 'number', answer: 25, unit: '%', nudge: '[[1/4]] = ?/100.', ok: '[[1/4]] = [[25/100]] = 25%.' },
      ],
    });
  }

  function labDressing() {
    const root = $('#dress-lab'), st = { oil: 3, vin: 1 };
    const rowO = h('div', { class: 'blocks' }), rowV = h('div', { class: 'blocks' }), info = h('div', { class: 'readout' });
    const mk = (label, fn, cls) => h('button', { class: 'btn small ' + (cls || ''), onclick: fn }, label);
    root.append(rowO, rowV, info, h('div', { class: 'row', style: { marginTop: '10px' } },
      mk('Double the oil', () => { st.oil *= 2; draw(); }), mk('Double the vinegar', () => { st.vin *= 2; draw(); }), mk('↺ Reset', () => { st.oil = 3; st.vin = 1; draw(); }, 'ghost')));
    function draw() {
      const row = (el, label, n, color) => el.replaceChildren(h('span', { class: 'lbl' }, label), ...Array.from({ length: Math.min(n, 24) }, () => h('div', { class: 'blk', style: { '--b': color } })), n > 24 ? `+${n - 24}` : '');
      row(rowO, '🫒 Oil', st.oil, '#d9a400'); row(rowV, '🍶 Vinegar', st.vin, '#10b981');
      const g = gcd(st.oil, st.vin);
      MC.fill(info, h('span', { class: 'pill hot' }, `oil : vinegar = ${st.oil} : ${st.vin}`), g > 1 ? h('span', { class: 'pill' }, `simplified: ${st.oil / g} : ${st.vin / g}`) : null);
    }
    draw();
    guided('#dress-steps', 'ratio.dressing', {
      finale: '🎉 **(A) 3 : 2.** Only the vinegar changed (1 → 2), so only the vinegar side of the ratio changes.',
      steps: [
        { type: 'choice', q: 'The dressing is 3 : 1. **Predict** (no peeking): if the vinegar is doubled, the new ratio oil : vinegar is…', choices: ['3 : 2', '6 : 1', '1 : 3', '2 : 3', '4 : 3'], answer: 0, ok: 'Vinegar 1 → 2, oil stays 3. Press **Double the vinegar** to see it.', wrongMsgs: { 1: '6 : 1 doubles the **oil**. The question doubles the vinegar.', 2: 'That’s flipped. Oil comes first: oil : vinegar.', 3: 'That’s flipped. Oil comes first.', 4: 'Doubling means × 2 — not adding 1. Which side changes, and what does it become?' } },
        { type: 'action', q: 'Now build **oil : vinegar = 3 : 4** with the buttons. (Reset first if you need to.)', btn: 'Check my dressing', check: () => (st.oil * 4 === st.vin * 3) || `Right now it’s ${st.oil} : ${st.vin}. Tip: you only need one of the buttons.`, ok: 'Doubling the vinegar twice: 1 → 2 → 4. Oil stays 3.' },
        { q: 'A 20-cup batch is made with oil : vinegar = **3 : 2**. How many cups of **oil**?', type: 'number', answer: 12, unit: 'cups', nudge: 'Count the parts (3 + 2), then find the size of one part: 20 ÷ parts.', ok: '5 parts → 20 ÷ 5 = 4 cups per part. Oil = 3 × 4 = **12 cups**.' },
      ],
    });
  }

  /* ======================================================================== percent */
  function labLightning() {
    const root = $('#lightning');
    const bank = [['Reduced by 30%', 0.7, '100% − 30% = 70%'], ['Increased by 30%', 1.3, '100% + 30% = 130%'], ['35% of the price', 0.35, '35% = 35/100'], ['15% tax added', 1.15, '100% + 15% = 115%'],
      ['25% off', 0.75, '100% − 25% = 75%'], ['An increase of 8%', 1.08, '100% + 8% = 108%'], ['Half price (50% off)', 0.5, '100% − 50% = 50%'], ['Reduced by 5%', 0.95, '100% − 5% = 95%'],
      ['Doubled (up 100%)', 2, '100% + 100% = 200%'], ['A 10% discount', 0.9, '100% − 10% = 90%'], ['Up 20%', 1.2, '100% + 20% = 120%'], ['Reduced by 60%', 0.4, '100% − 60% = 40%']];
    let queue, idx, got;
    const prompt = h('div', { class: 'big-q' }), fill = h('div', { class: 'pbar' }), wrap = h('div', { class: 'pbar-wrap' }, fill, h('div', { class: 'pbar-mark', title: '× 1 = same price' }));
    const input = h('input', { type: 'text', class: 'ans', placeholder: 'multiplier', inputmode: 'decimal', autocomplete: 'off' });
    const go = h('button', { class: 'btn small' }, 'Check'), fb = h('div', { class: 'fb', style: { fontWeight: 700, minHeight: '28px' } });
    const dots = h('div', { class: 'readout' }), again = h('button', { class: 'btn warm', style: { display: 'none' } }, '🔁 Play again');
    root.append(prompt, wrap, h('div', { class: 'row', style: { justifyContent: 'center' } }, h('span', { class: 'big-q' }, '×'), input, go), fb, dots, again);
    function start() { queue = shuffle(bank).slice(0, 6); idx = 0; got = 0; again.style.display = 'none'; input.disabled = go.disabled = false; ask(); }
    function ask() {
      prompt.textContent = queue[idx][0]; input.value = ''; fb.textContent = ''; fill.style.width = '0%'; fill.textContent = ''; input.focus({ preventScroll: true });
      dots.replaceChildren(h('span', { class: 'pill' }, `Question ${Math.min(idx + 1, 6)} of 6`), h('span', { class: 'pill good' }, `✅ ${got} right`));
    }
    function check() {
      if (input.value.trim() === '') return;
      const [, m, why] = queue[idx], v = parseNum(input.value);
      if (near(v, m, 0.0051)) {
        got++; fill.style.width = clamp((m / 2) * 100, 0, 100) + '%'; fill.textContent = `× ${num(m)}`;
        fb.className = 'fb ok'; fb.textContent = `✅ ${why} → × ${num(m)}`; idx++;
        input.disabled = go.disabled = true;
        if (idx >= 6) { dots.replaceChildren(h('span', { class: 'pill good' }, '⚡ Round complete!')); again.style.display = ''; finish('percent.lightning'); return; }
        setTimeout(() => { input.disabled = go.disabled = false; ask(); }, 1100);
      } else {
        fb.className = 'fb bad'; root.classList.remove('shake'); void root.offsetWidth; root.classList.add('shake');
        fb.textContent = v >= 3 ? '🤔 A multiplier is a decimal: 70% is × 0.70, not × 70.' : '🤔 Hint: “off / reduced” → 100% minus it. “added / increase” → 100% plus it. Then move the decimal point two places.';
      }
    }
    go.onclick = check; input.addEventListener('keydown', (e) => { if (e.key === 'Enter') check(); }); again.onclick = start;
    start();
  }

  function labChain() {
    const root = $('#chain-lab'), chain = [];
    const chips = [['−50%', 0.5], ['+50%', 1.5], ['−20%', 0.8], ['−25%', 0.75], ['−30%', 0.7], ['−40%', 0.6], ['+20%', 1.2], ['+15% tax', 1.15]];
    const view = h('div', { class: 'chain' }), pills = h('div', { class: 'readout' });
    const bar = h('div', { class: 'chipbar' }, chips.map(([label, f]) => h('button', { class: 'chipbtn ' + (f < 1 ? 'down' : 'up'), onclick: () => { if (chain.length < 6) { chain.push({ label, f }); draw(); } else MC.toast('Six changes is the max — press Clear.'); } }, label)),
      h('button', { class: 'btn ghost small', onclick: () => { chain.pop(); draw(); } }, '↶ Undo'), h('button', { class: 'btn ghost small', onclick: () => { chain.length = 0; draw(); } }, 'Clear'));
    root.append(bar, h('div', { class: 'stage' }, view), pills);
    const finalPrice = () => chain.reduce((p, c) => p * c.f, 100);
    function draw() {
      let p = 100; const vals = [100]; chain.forEach((c) => { p *= c.f; vals.push(p); });
      const mx = Math.max(...vals, 100), col = (v, cls) => h('div', { class: 'col ' + (cls || ''), style: { height: Math.max(6, (v / mx) * 130) + 'px' } });
      view.replaceChildren(h('div', { class: 'tagcol' }, h('div', { class: 'val' }, '$100'), col(100), h('div', { class: 'op' }, 'start')),
        ...chain.map((c, i) => h('div', { class: 'tagcol' }, h('div', { class: 'val' }, money(vals[i + 1])), col(vals[i + 1], c.f > 1 ? 'up' : ''), h('div', { class: 'op' }, `${c.label}  (× ${c.f})`))));
      const f = chain.reduce((x, c) => x * c.f, 1);
      MC.fill(pills, chain.length ? h('span', { class: 'pill' }, `Multiplier: ${chain.map((c) => num(c.f)).join(' × ')} = ${num(f)}`) : h('span', { class: 'pill' }, 'Tap a change above ☝️'),
        chain.length ? h('span', { class: 'pill hot' }, `Final: ${money(vals[vals.length - 1])}  (net ${f >= 1 ? '+' : '−'}${num(Math.abs(f - 1) * 100)}%)`) : null);
    }
    draw();
    guided('#chain-steps', 'percent.chain', {
      finale: '🎉 **Successive changes multiply.** +50% then −50% is × 1.5 × 0.5 = × 0.75 — a 25% loss, not 0%.',
      steps: [
        { type: 'choice', q: '**Predict:** a $100 tag goes **up 50%**, then **down 50%**. Where does it end up?', choices: ['Back at $100', 'Above $100', 'Below $100'], answer: 2, ok: 'Below! Let’s see exactly how far below…', wrongMsgs: { 0: 'Tempting — but is the “−50%” taken off the same number the “+50%” was added to?', 1: 'Hmm — the second change takes money off. Which number is it taken from?' } },
        { type: 'action', q: 'Build it: tap **+50%** and then **−50%** (press Clear first).', btn: 'Check my chain', check: () => (chain.length === 2 && chain[0].f === 1.5 && chain[1].f === 0.5) || 'Tap +50% first, then −50% — exactly two taps.', ok: '$100 → $150 → **$75**. The −50% is taken off $150 (a bigger number), so it removes more than the +50% added.' },
        { q: 'What **single multiplier** does the same job as “+50% then −50%”?', type: 'number', answer: 0.75, nudge: 'Multiply the two multipliers: 1.5 × 0.5.', ok: '1.5 × 0.5 = **0.75**.' },
        { type: 'action', q: 'Your turn: build a chain of **2 or more** changes that ends at exactly **$60**. (Hint: which multipliers multiply to 0.6?)', btn: 'Check my chain', check: () => (chain.length >= 2 && Math.abs(finalPrice() - 60) < 0.005) || `Your chain ends at ${money(finalPrice())}. You need exactly $60 — try pairs like 0.8 × 0.75.`, ok: 'Nice — e.g. −20% then −25%: 0.8 × 0.75 = 0.6.' },
      ],
    });
  }

  function labShirt() {
    guided('#shirt-steps', 'percent.shirt', {
      finale: '🎉 **(C) 70%.** Multipliers: 0.5 × 0.6 = 0.3 → you pay 30%, so the discount is 100% − 30% = 70%. (Not 50 + 40 = 90!)',
      steps: [
        { q: 'Say the original price is **$100**. After the first sale (−50%), the second price is…', type: 'number', answer: 50, unit: '$', ok: '100 × 0.5 = $50.' },
        { q: 'The second price is reduced by 40%. What is the **multiplier**?', type: 'number', answer: 0.6, nudge: '100% − 40% = 60% → ?', ok: '× 0.6.' },
        { q: 'Third price = 50 × 0.6 = ?', type: 'number', answer: 30, unit: '$', ok: '$30.' },
        { q: 'You pay $30 of the original $100. The **discount** off the original price is…', type: 'number', answer: 70, unit: '%', nudge: 'Discount = original − what you pay = 100 − 30.', ok: '100 − 30 = **70%** → (C).' },
      ],
    });
  }

  function labUndo() {
    const root = $('#undo-lab'), seen = new Set();
    const out = h('div', { class: 'readout' });
    const tryBtn = (label, key, calc) => h('button', { class: 'btn warm', onclick: () => { seen.add(key); out.replaceChildren(...calc()); } }, label);
    root.append(h('div', { class: 'row' }, tryBtn('76 × 1.2', 'mul', () => [h('span', { class: 'pill' }, 'Guess: $91.20'), h('span', { class: 'pill hot' }, 'Check: 91.20 × 0.8 = $72.96 ≠ $76 ❌'),
      h('span', { class: 'pill' }, 'The 20% was taken off the ORIGINAL — so “add 20% to the sale price” isn’t the reverse.')]),
      tryBtn('76 ÷ 0.8', 'div', () => [h('span', { class: 'pill' }, 'Guess: $95'), h('span', { class: 'pill good' }, 'Check: 95 × 0.8 = $76 ✅'), h('span', { class: 'pill' }, 'To undo × 0.8, divide by 0.8.')])), out);
    guided('#undo-steps', 'percent.undo', {
      finale: '🎉 **To undo a multiplier, divide by it.** Always check by going forward again.',
      steps: [
        { type: 'action', q: 'Tap **both** buttons and see which one passes the check.', btn: 'I tried both', check: () => (seen.size === 2) || 'Tap both buttons first — one of them will fail the check!', ok: 'Dividing by 0.8 gets us back to $76 when we go forward again.' },
        { q: 'Your turn. A price goes **+50%** then **−40%** and ends at **$90**. What single multiplier is that? (1.5 × 0.6)', type: 'number', answer: 0.9, nudge: '1.5 × 0.6 = ?', ok: '× 0.9.' },
        { q: 'So original × 0.9 = 90. What was the **original** price?', type: 'number', answer: 100, unit: '$', nudge: 'Undo × 0.9 by dividing: 90 ÷ 0.9.', ok: '90 ÷ 0.9 = **$100**. Forward check: 100 × 1.5 = 150, × 0.6 = 90 ✓' },
      ],
    });
  }

  function labOrder() {
    const root = $('#order-lab'), seen = new Set();
    const opts = [['A', 'A: 20% off', [0.8]], ['B', 'B: 10%, then 10%', [0.9, 0.9]], ['C', 'C: 15%, then 5%', [0.85, 0.95]], ['D', 'D: 5%, then 15%', [0.95, 0.85]]];
    const cards = opts.map(([k, label, fs]) => {
      const res = h('span', { class: 'res' }, 'tap to see');
      const b = h('button', { class: 'optcard' }, label, res);
      b.onclick = () => {
        let p = 100; const path = ['$100']; fs.forEach((f) => { p *= f; path.push(money(p)); });
        res.textContent = path.join(' → '); b.classList.add('seen'); seen.add(k);
      };
      return b;
    });
    root.append(h('div', { class: 'optcards' }, cards));
    guided('#order-steps', 'percent.order', {
      finale: '🎉 **(A)** — 20% off gives $80, the lowest. 🧠 **Contest trick:** C and D come out identical, so neither can be *the one* right answer — cross them out right away! (And (E) is false because A ≠ B.)',
      steps: [
        { type: 'action', q: 'Tap **all four** options to see each final price.', btn: 'I tapped them all', check: () => (seen.size === 4) || 'Four cards, four taps — keep going!', ok: 'A: $80 · B: $81 · C: $80.75 · D: $80.75.' },
        { type: 'choice', q: 'Which option is the **best deal** (lowest price) for Sara?', choices: ['A', 'B', 'C', 'D', 'All four are the same'], answer: 0, ok: '$80 is the lowest.', wrongMsgs: { 1: 'B costs $81 — more than A.', 2: 'C costs $80.75 — A is lower.', 3: 'D costs $80.75 — A is lower.', 4: 'Look at the prices you just found: they are not all equal.' } },
        { type: 'choice', q: 'C and D swap the order (15% then 5% vs 5% then 15%) but end at the same price. Why?', choices: ['Lucky coincidence', 'Multiplication works in any order: 0.85 × 0.95 = 0.95 × 0.85'], answer: 1, ok: 'Right: successive percent changes multiply, and multiplying doesn’t care about order.', wrongMsgs: { 0: 'It works for *any* two percent changes — it’s not luck. What operation links the two multipliers?' } },
      ],
    });
  }

  /* ========================================================================== mean */
  /** Persistent bar chart: bars grow/shrink smoothly; optional dashed mean line. */
  function Bars(stage, unit) {
    stage.classList.add('barstage'); stage.style.setProperty('--u', unit + 'px');
    const line = h('div', { class: 'meanline' }, h('em', {})); stage.append(line);
    const els = [];
    return {
      update(vals, o = {}) {
        while (els.length < vals.length) { const b = h('div', { class: 'mbar' }, h('span', {})); stage.insertBefore(b, line); els.push(b); }
        while (els.length > vals.length) els.pop().remove();
        vals.forEach((v, i) => {
          const b = els[i]; b.style.height = v * unit + 'px'; b.firstChild.textContent = v;
          b.classList.toggle('sel', i === o.sel); b.classList.toggle('gone', (o.gone || []).includes(i)); b.onclick = o.onClick ? () => o.onClick(i) : null;
        });
        if (o.mean == null) line.style.display = 'none';
        else { line.style.display = ''; line.style.bottom = o.mean * unit + 'px'; line.firstChild.textContent = 'mean = ' + num(o.mean); }
      },
    };
  }

  function labLevel() {
    const root = $('#level-lab'), start = [2, 8, 5, 9, 1];
    let vals = start.slice(), sel = -1, busy = false;
    const stage = h('div'), bars = Bars(stage, 18), pills = h('div', { class: 'readout' });
    const btn = (label, fn, cls) => h('button', { class: 'btn small ' + (cls || ''), onclick: fn }, label);
    root.append(stage, pills, h('div', { class: 'row', style: { marginTop: '10px' } },
      btn('⚖️ Level it out', levelOut, 'go'), btn('＋ Add a bar', () => { if (vals.length < 8) { vals.push(1 + Math.floor(Math.random() * 9)); draw(); } }), btn('🗑 Remove picked bar', () => { if (sel >= 0 && vals.length > 1) { vals.splice(sel, 1); sel = -1; draw(); } else MC.toast('Pick a bar first'); }), btn('↺ Reset', () => { vals = start.slice(); sel = -1; draw(); }, 'ghost')));
    function click(i) {
      if (busy) return;
      if (sel < 0) { if (vals[i] > 0) sel = i; }
      else if (sel === i) sel = -1;
      else { vals[sel]--; vals[i]++; sel = -1; }
      draw();
    }
    function draw() {
      const t = sum(vals), n = vals.length;
      bars.update(vals, { mean: t / n, sel, onClick: click });
      pills.replaceChildren(h('span', { class: 'pill' }, `Total: ${t}`), h('span', { class: 'pill' }, `Count: ${n}`), h('span', { class: 'pill hot' }, `Mean = ${t} ÷ ${n} = ${num(t / n)}`));
    }
    function levelOut() {
      if (busy) return; busy = true; sel = -1;
      const step = () => {
        const mx = vals.indexOf(Math.max(...vals)), mn = vals.indexOf(Math.min(...vals));
        if (vals[mx] - vals[mn] <= 1) { busy = false; draw(); return; }
        vals[mx]--; vals[mn]++; draw(); setTimeout(step, 260);
      };
      step();
    }
    draw();
    const mean = () => sum(vals) / vals.length;
    guided('#level-steps', 'mean.level', {
      finale: '🎉 **Moving cubes never changes the total** — so “levelling out” shows the mean: what every bar would be if the total were shared equally.',
      steps: [
        { q: 'Add up all the cubes. What is the **total** right now?', type: 'number', answer: () => sum(vals), nudge: 'Add the numbers on top of the bars.', ok: 'Total = the number of cubes.' },
        { q: 'How many bars are there?', type: 'number', answer: () => vals.length, ok: 'That’s the **count**.' },
        { q: 'Mean = total ÷ count. What is it? (Match the orange line!)', type: 'number', answer: () => mean(), tol: 0.06, nudge: 'Total ÷ count — it should match the orange line.', ok: 'Yes: mean = total ÷ count.' },
        { type: 'choice', q: 'Now move a cube from a tall bar to a short bar. The **total** and the **mean**…', choices: ['both stay the same', 'the total stays, the mean changes', 'both change'], answer: 0, ok: 'Try it above! Cubes only move around — none are added or removed, so the total (and mean) stay put.', wrongMsgs: { 1: 'The mean is total ÷ count. If neither total nor count changes, can the mean change?', 2: 'Did any cube appear or vanish when you moved one?' } },
      ],
    });
  }

  function labRemove() {
    const root = $('#remove-lab'), all = [25, 5, 8, 10, 6, 6];
    let gone = [], showMean = true;
    const stage = h('div'), bars = Bars(stage, 8), pills = h('div', { class: 'readout' });
    root.append(stage, pills);
    function draw() {
      const live = all.filter((_, i) => !gone.includes(i)), t = sum(live);
      bars.update(all, { gone, mean: showMean ? t / live.length : null });
      MC.fill(pills, h('span', { class: 'pill' }, `Count: ${live.length}`), h('span', { class: 'pill' }, `Total: ${t}`), showMean ? h('span', { class: 'pill hot' }, `Mean: ${num(t / live.length)}`) : null);
    }
    draw();
    guided('#remove-steps', 'mean.remove', {
      onStep(i) { if (i === 1) { gone = [0]; showMean = false; draw(); } if (i === 3) { showMean = true; draw(); } },
      finale: '🎉 **(B) 7.** The mean dropped because 25 was a big number pulling the average up. Work with totals!',
      steps: [
        { q: 'Six numbers, mean 10. What must the **total** be? (mean × count)', type: 'number', answer: 60, nudge: '10 × 6.', ok: '6 × 10 = 60 — the bars really do add up to 60.' },
        { q: 'Remove the 25. What is the new **total**?', type: 'number', answer: 35, nudge: '60 − 25.', ok: '60 − 25 = 35. (The 25 bar just vanished!)' },
        { q: 'How many numbers are left?', type: 'number', answer: 5, ok: '6 − 1 = 5.' },
        { q: 'New mean = new total ÷ new count = 35 ÷ 5 = ?', type: 'number', answer: 7, ok: '**7** → (B). The orange line fell from 10 to 7.' },
      ],
    });
  }

  function labCumulative() {
    MC.widgets.barchart($('#cum-chart'), { data: [5, 7, 6, 8, 7], ymax: 8, xlabel: 'Days of Practice', ylabel: 'Mean Tosses Scored', alt: 'Cumulative mean tosses scored: 5, 7, 6, 8, 7' });
    const means = [5, 7, 6, 8, 7], totals = [5, 14, 18, 32, 35], daily = [5, 9, 4, 14, 3];
    let okCount = 0, started = false;
    const mkIn = (want) => {
      const inp = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off' });
      inp.addEventListener('input', () => {
        if (!inp.readOnly && near(parseNum(inp.value), want, 0.001)) { inp.classList.add('ok'); inp.readOnly = true; if (++okCount === 10) done(); }
      });
      return inp;
    };
    const rows = means.map((m, i) => h('tr', {}, h('td', {}, `Day ${i + 1}`), h('td', {}, m), h('td', {}, mkIn(totals[i])), h('td', {}, mkIn(daily[i]))));
    $('#cum-table').append(
      h('p', { class: 'tip' }, 'Fill in the table: the total tosses after each day is mean × days. Then each day’s own score is the total minus yesterday’s total.'),
      h('table', { class: 'decode' }, h('thead', {}, h('tr', {}, h('th', {}, 'Day'), h('th', {}, 'Mean so far'), h('th', { html: 'Total so far<br>(mean × days)' }), h('th', { html: 'Score that day<br>(total − previous)' }))), h('tbody', {}, rows)));
    function done() {
      if (started) return; started = true; MC.confetti(40);
      guided('#cum-steps', 'mean.cumulative', {
        finale: '🎉 **(E) day 5** — only 3 tosses. Notice: the bar for day 3 is low because day 3’s score (4) was below the mean so far — but day 5 was even lower (3). A cumulative-mean bar tells you about the *total*, never directly about that day.',
        steps: [{ type: 'choice', q: 'Look at your “Score that day” column (5, 9, 4, 14, 3). Which day did Zaria score the **fewest**?', choices: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5'], answer: 4, ok: 'Day 5: only **3** tosses scored.', wrongMsgs: { 2: 'Day 3’s *bar* is low, but the bar is the **mean so far**. Compare the scores in your last column instead.' } }],
      });
    }
  }

  function labTug() {
    const root = $('#tug-lab'), st = { n1: 2, m1: 80, n2: 8, m2: 90 };
    const sliders = [
      slider('Group A size', 1, 10, 1, st.n1, 'kids', (v) => { st.n1 = v; draw(); }), slider('Group A mean', 60, 100, 1, st.m1, '', (v) => { st.m1 = v; draw(); }),
      slider('Group B size', 1, 10, 1, st.n2, 'kids', (v) => { st.n2 = v; draw(); }), slider('Group B mean', 60, 100, 1, st.m2, '', (v) => { st.m2 = v; draw(); })];
    const stage = h('div', { class: 'stage' }), pills = h('div', { class: 'readout' });
    root.append(...sliders.map((s) => s.row), stage, pills);
    const X = (v) => 40 + ((v - 60) / 40) * 520, S = (t, a = {}, ...k) => MC.svg(t, a, ...k);
    const truth = () => (st.n1 * st.m1 + st.n2 * st.m2) / (st.n1 + st.n2), naive = () => (st.m1 + st.m2) / 2;
    function draw() {
      const svg = S('svg', { viewBox: '0 0 600 170', width: '100%', class: 'numline' });
      svg.append(S('line', { x1: 40, x2: 560, y1: 100, y2: 100, stroke: '#1f2766', 'stroke-width': 3 }));
      for (let v = 60; v <= 100; v += 10) svg.append(S('line', { x1: X(v), x2: X(v), y1: 94, y2: 106, stroke: '#1f2766', 'stroke-width': 2 }), S('text', { x: X(v), y: 126, 'text-anchor': 'middle', 'font-size': 14, fill: '#6b7194' }, v));
      [[st.n1, st.m1, '#8b5cf6', 'A'], [st.n2, st.m2, '#f59e0b', 'B']].forEach(([n, m, c, l]) => {
        const r = 8 + n * 3.2;
        svg.append(S('circle', { cx: X(m), cy: 100 - r, r, fill: c, opacity: 0.85 }), S('text', { x: X(m), y: 100 - r + 5, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, fill: '#fff' }, `${l}·${n}`));
      });
      svg.append(S('line', { x1: X(naive()), x2: X(naive()), y1: 14, y2: 100, stroke: '#e5484d', 'stroke-width': 3, 'stroke-dasharray': '6 5' }), S('text', { x: X(naive()), y: 11, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, fill: '#e5484d' }, 'avg of averages'));
      svg.append(S('line', { x1: X(truth()), x2: X(truth()), y1: 24, y2: 100, stroke: '#17b26a', 'stroke-width': 4 }), S('text', { x: X(truth()), y: 152, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, fill: '#0c7a47' }, 'true mean'));
      stage.replaceChildren(svg);
      pills.replaceChildren(h('span', { class: 'pill' }, `Totals: ${st.n1}×${st.m1} = ${st.n1 * st.m1} and ${st.n2}×${st.m2} = ${st.n2 * st.m2}`), h('span', { class: 'pill good' }, `True mean = ${st.n1 * st.m1 + st.n2 * st.m2} ÷ ${st.n1 + st.n2} = ${num(truth())}`), h('span', { class: 'pill hot' }, `Average of averages = ${num(naive())}`));
    }
    draw();
    guided('#tug-steps', 'mean.tug', {
      finale: '🎉 **Combine groups with totals:** add the totals, add the counts, then divide. Never just average the averages.',
      steps: [
        { type: 'action', q: 'Make both groups the **same size** with the size sliders. What do the two markers do?', btn: 'Done — they’re the same size', check: () => st.n1 === st.n2 || 'Set Group A size and Group B size to the same number.', ok: 'Equal sizes pull equally, so the true mean lands exactly halfway: both markers sit on the same spot.' },
        { type: 'choice', q: 'Now make one group **much bigger** than the other. The green true mean moves…', choices: ['toward the bigger group', 'toward the smaller group', 'stays exactly halfway'], answer: 0, ok: 'The bigger group has more kids, so it counts for more — it pulls the mean toward itself.', wrongMsgs: { 1: 'Try it with the sliders: which group does the green line sit closer to when one group is huge?', 2: 'That only happens when the groups are the same size.' } },
        { q: 'No picture this time. **3 kids** have a mean of **12**; **5 kids** have a mean of **16**. What is the mean of all 8 kids? (Use totals!)', type: 'number', answer: 14.5, nudge: 'Totals first: 3 × 12 and 5 × 16. Add them, then divide by 8.', ok: '36 + 80 = 116, and 116 ÷ 8 = **14.5**. (Averaging the averages would wrongly give 14.)' },
      ],
    });
  }

  function labStats() {
    const root = $('#stats-lab');
    const input = h('input', { type: 'text', class: 'ans', value: '2, 2, 3, 4, 5', style: { width: '100%', maxWidth: '360px' }, autocomplete: 'off' });
    const chips = h('div', { class: 'chipnums' }), pills = h('div', { class: 'readout' });
    root.append(h('div', { class: 'row' }, 'Numbers:', input), chips, pills);
    const read = () => input.value.split(/[\s,;]+/).map(parseFloat).filter((x) => isFinite(x));
    function stats() {
      const xs = read().sort((a, b) => a - b), n = xs.length;
      if (!n) return null;
      const mean = sum(xs) / n, mid = n % 2 ? [(n - 1) / 2] : [n / 2 - 1, n / 2], median = sum(mid.map((i) => xs[i])) / mid.length;
      const counts = {}; xs.forEach((x) => { counts[x] = (counts[x] || 0) + 1; });
      const top = Math.max(...Object.values(counts)), modes = top > 1 ? Object.keys(counts).filter((k) => counts[k] === top).map(Number) : [];
      return { xs, n, mean, mid, median, modes };
    }
    function draw() {
      const s = stats();
      if (!s) { chips.replaceChildren(); pills.replaceChildren(h('span', { class: 'pill' }, 'Type some numbers')); return; }
      chips.replaceChildren(...s.xs.map((x, i) => h('div', { class: 'num' + (s.mid.includes(i) ? ' med' : '') + (s.modes.includes(x) ? ' mode' : '') }, x)));
      pills.replaceChildren(h('span', { class: 'pill' }, `Mean = ${num(s.mean)}`), h('span', { class: 'pill' }, `Median = ${num(s.median)} (green outline)`), h('span', { class: 'pill' }, `Mode = ${s.modes.length ? s.modes.join(', ') : 'none'} (orange)`));
    }
    input.addEventListener('input', draw); draw();
    guided('#stats-steps', 'mean.stats', {
      finale: '🎉 You just built the same kind of puzzle as the optional challenge in the homework (Gauss 2018 Q19): mean = median = mode!',
      steps: [{ type: 'action', q: 'Challenge: type **exactly 5 numbers** whose **mean, median and mode are all equal**. (Tip: repeat the middle number.)', btn: 'Check my numbers', check: () => {
        const s = stats();
        if (!s || s.n !== 5) return 'You need exactly 5 numbers, separated by commas.';
        if (s.modes.length !== 1) return 'There needs to be exactly one mode — one number that appears most often.';
        return (near(s.mean, s.median) && near(s.median, s.modes[0])) || `Mean ${num(s.mean)}, median ${num(s.median)}, mode ${s.modes[0]} — not all equal yet. Try numbers balanced around the middle one.`;
      }, ok: 'All three equal — nicely done!' }],
    });
  }

  /* ------------------------------------------------------------------- boot */
  [labMatch, labPrinter, labWalk, labMeet, labCake, labDressing, labLightning, labChain, labShirt, labUndo, labOrder, labLevel, labRemove, labCumulative, labTug, labStats]
    .forEach((fn) => { try { fn(); } catch (e) { console.error('lab failed:', fn.name, e); } });
  refreshSkills(false);
})();
