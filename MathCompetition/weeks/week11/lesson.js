/* Week 11 lesson — Views & Surface Area. Labs come from figures.js (MC.widgets); each ends in a guided worked example. */
(function () {
  'use strict';
  const { $, $$ } = MC;
  const WEEK = 'week11', PAGE = 'lesson';
  $$('.mission .ask, .mission .orig, .nova .say, .big-idea small, .callout').forEach((el) => { el.innerHTML = MC.fmt(el.innerHTML); });

  const SKILLS = {
    read:  { label: 'Reading views',   emoji: '🔭', color: '#3b82f6', tasks: ['w11.plan', 'w11.viewer'] },
    count: { label: 'Counting cubes',  emoji: '🧊', color: '#10b981', tasks: ['w11.layers', 'w11.ceiling', 'w11.cross'] },
    surf:  { label: 'Surface area',    emoji: '📦', color: '#f59e0b', tasks: ['w11.box', 'w11.prism', 'w11.glue'] },
    scale: { label: 'Scaling & volume', emoji: '🔬', color: '#8b5cf6', tasks: ['w11.scale', 'w11.tilt'] },
  };
  const BADGE_TEXT = {
    read: 'The tallest stack in each line of sight — and which way you face. View-reader badge!',
    count: 'Layer by layer, ceiling and floor, fill the cube. Cube-counter badge!',
    surf: 'Pairs of faces, minus the hidden ones. Surface-area badge!',
    scale: 'Length × k, area × k², volume × k³ — and the water never changes. Scaling badge!',
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
  const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  const W = MC.widgets;

  /* ---------------------------------------------------------------- World 1: views */
  const P1 = [[2, 1, 0], [1, 3, 1], [0, 2, 1]], STAIR = [[3, 3, 3], [2, 2, 2], [1, 1, 1]];
  W.stackbuilder($('#build-lab'), { mode: 'views', rows: 3, cols: 3, max: 4, plan: [[3, 1, 1], [2, 1, 0], [1, 0, 0]],
    presets: [{ label: 'Clear', plan: [[0, 0, 0], [0, 0, 0], [0, 0, 0]] }, { label: 'Slide-3 stack', plan: [[3, 1, 1], [2, 1, 0], [1, 0, 0]] }, { label: 'Together 1 plan', plan: P1 }] });

  W.stack($('#plan-fig'), { plan: P1, table: true });
  const dF = W.viewdraw($('#draw-front'), { n: 3, maxH: 3, label: 'FRONT view — tap to draw' });
  const dR = W.viewdraw($('#draw-right'), { n: 3, maxH: 3, fill: '#98aedb', label: 'RIGHT view (front row on the left)' });
  guided('#plan-steps', 'w11.plan', {
    finale: '🎉 Front **2, 3, 1**, right **2, 3, 2**, and **11** cubes. The stack plan shows the *true* height of every square — the views only show the tallest stack in each line of sight.',
    steps: [
      { q: 'Draw the **FRONT view**: the tallest stack in each **column** of the plan, left to right.', type: 'action', btn: 'Check my front view', ok: 'Front view: **2, 3, 1**.',
        check: () => same(dF.get(), [2, 3, 1]) || 'Take one column at a time. Column 1 is 2, 1, 0 → the tallest is 2. Then column 2 (1, 3, 2) and column 3 (0, 1, 1).' },
      { q: 'Draw the **RIGHT view**: the tallest stack in each **row**, starting with the **front** row (on the left).', type: 'action', btn: 'Check my right view', ok: 'Right view: **2, 3, 2**.',
        check: () => same(dR.get(), [2, 3, 2]) || 'Rows now! Front row (0 2 1) → 2, middle row (1 3 1) → 3, back row (2 1 0) → 2.' },
      num('How many cubes are there **in all**? Add every number in the stack plan.', 11, '**11** cubes — including the ones you cannot see.', 'Add all nine numbers: 2 + 1 + 0 + 1 + 3 + 1 + 0 + 2 + 1.'),
    ] });

  W.layers($('#layers-lab'), { plan: STAIR, u: 26 });
  guided('#layers-steps', 'w11.layers', {
    finale: '🎉 **18** cubes. Layer by layer: 9 + 6 + 3. Only 12 of them can be seen in the picture — the other 6 are hidden.',
    steps: [
      num('The **bottom** layer is 3 rows of 3. How many cubes?', 9, '**9** cubes.', '3 × 3.'),
      num('The **second** layer has only the 2 higher rows. How many cubes?', 6, '**6** cubes.', '2 rows × 3 cubes.'),
      num('The **top** layer is just the back row. How many cubes?', 3, '**3** cubes.', '1 row × 3 cubes.'),
      num('Add the layers: **9 + 6 + 3** =', 18, '**18** cubes.', '9 + 6 = 15, then 15 + 3.'),
    ] });

  W.stackbuilder($('#ceil-lab'), { mode: 'ceiling', rows: 2, cols: 2, max: 2, target: { front: [2, 2], right: [2, 2] }, u: 34 });
  guided('#ceil-steps', 'w11.ceiling', {
    finale: '🎉 Most **8**, fewest **4**. Views set a ceiling, not an exact count.',
    steps: [
      num('**Most** cubes: fill every square of the 2 × 2 base as high as both views allow (2). How many cubes?', 8, '**8** cubes (a 2 × 2 × 2 cube).', '4 squares × 2 cubes.'),
      num('**Fewest** cubes: add only what the views force. A 2-tall stack in each column and row needs how many cubes at least?', 4, '**4** cubes: two stacks of 2 on opposite corners.', 'Two tall stacks on opposite corners already show a 2-tall column AND a 2-tall row each time.'),
      { q: 'So the front and right views tell us…', type: 'choice', choices: ['the exact number of cubes', 'a most and a fewest — not one exact number', 'nothing about the number of cubes'], answer: 1, ok: 'Right — **a ceiling and a floor**.' },
    ] });

  const CJ = [[4, 3, 0], [0, 0, 1], [0, 2, 0]], NUMS = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
  W.viewer($('#viewer-lab'), { grid: CJ, nums: NUMS, side: 'front', backFront: false });
  W.tablemap($('#viewer-map'), { grid: NUMS, side: 'right', backFront: false });
  const dV = W.viewdraw($('#viewer-draw'), { n: 3, maxH: 4, label: 'What Sam draws — tap to draw' });
  guided('#viewer-steps', 'w11.viewer', {
    finale: '🎉 **(B)** 2, 1, 4. Stand where Sam stands: each row is one line of sight, and from the right his **left hand points to the bottom row**.',
    steps: [
      { q: 'Sam stands on the right, facing the table. His **left hand** points to…', type: 'choice', choices: ['the top row (1 2 3)', 'the bottom row (7 8 9)', 'the left column (1 4 7)'], answer: 1, ok: 'Yes — so the **bottom row** is on the **left** of his drawing.' },
      num('Tallest stack in the **bottom row** (7 8 9)?', 2, '**2** (the cubes on square 8).', 'Only square 8 has cubes: 2.'),
      num('Tallest stack in the **middle row** (4 5 6)?', 1, '**1** (square 6).', 'Only square 6 has a cube.'),
      num('Tallest stack in the **top row** (1 2 3)?', 4, '**4** (square 1 — the 3 on square 2 is hidden behind it).', 'Square 1 has 4, square 2 has 3: take the tallest.'),
      { q: 'Draw what Sam sees, left to right.', type: 'action', btn: 'Check my drawing', ok: 'Sam draws **2, 1, 4**.', check: () => same(dV.get(), [2, 1, 4]) || 'Left to right: bottom row, middle row, top row.' },
      { q: 'Which diagram is it?', type: 'choice', choices: ['(A) 4, 1, 2', '(B) 2, 1, 4', '(C) 4, 3, 1', '(D) 1, 3, 4'], answer: 1, ok: '**(B)**.' },
    ] });

  W.cross($('#cross-lab'), {});
  guided('#cross-steps', 'w11.cross', {
    finale: '🎉 **(E) 20**: 27 − 7. Layer check: 8 + 4 + 8 = 20.',
    steps: [
      num('A cube with edges of length 3 is made of 3 × 3 × 3 = how many unit cubes?', 27, '**27**.', '9 per layer, 3 layers.'),
      num('The **top** layer has 9 spots, George has **1** there. How many to add?', 8, '**8**.', '9 − 1.'),
      num('The **middle** layer has a plus of **5**. How many to add?', 4, '**4** (the four corners).', '9 − 5.'),
      num('The **bottom** layer has **1**. How many to add? Then **add all three layers**: 8 + 4 + ?', 8, '**8**. Total: 8 + 4 + 8 = **20** → (E).', '9 − 1 = 8.'),
    ] });

  /* ---------------------------------------------------------------- World 2: surface area & volume */
  W.boxsa($('#box-lab'), { l: 5, w: 3, h: 4 });
  guided('#box-steps', 'w11.box', {
    finale: '🎉 **94 cm²**. Find each pair of faces — then double. (Formula: 2(lw + lh + wh).)',
    steps: [
      num('**Top & bottom**: two faces of 5 × 3. Together?', 30, '**30**.', '2 × 15.'),
      num('**Front & back**: two faces of 5 × 4. Together?', 40, '**40**.', '2 × 20.'),
      num('**Left & right**: two faces of 3 × 4. Together?', 24, '**24**.', '2 × 12.'),
      num('Surface area in **cm²**: 30 + 40 + 24 =', 94, '**94 cm²**.', '30 + 40 = 70, then + 24.'),
    ] });
  guided('#prism-steps', 'w11.prism', {
    finale: '🎉 **(E) 16 cm²**. The trap is treating it like a 2 × 2 × 2 cube (24).',
    steps: [
      num('A 1 × 2 × 2 prism. **Top & bottom** are 2 × 2 squares. Together?', 8, '**8**.', '2 × 4.'),
      num('**Front & back** are 2 × 1. Together?', 4, '**4**.', '2 × 2.'),
      num('**Left & right** are 2 × 1 too. Together?', 4, '**4**.', '2 × 2.'),
      num('Add them: surface area in cm² =', 16, '**16 cm²** → (E).', '8 + 4 + 4.'),
    ] });

  W.stackbuilder($('#glue-lab'), { mode: 'glue', rows: 3, cols: 3, max: 3, plan: [[2, 1, 0], [1, 1, 0], [0, 0, 0]],
    presets: [{ label: 'The slide solid (5 cubes)', plan: [[2, 1, 0], [1, 1, 0], [0, 0, 0]] }, { label: '3 in a row', plan: [[1, 1, 1], [0, 0, 0], [0, 0, 0]] }, { label: 'An L of 3', plan: [[1, 1, 0], [1, 0, 0], [0, 0, 0]] }] });
  guided('#glue-steps', 'w11.glue', {
    finale: '🎉 **20 cm²**. SA = 6n − 2 × joints = 30 − 10.',
    steps: [
      num('5 separate cubes have how many faces in all? (6 each)', 30, '**30** faces.', '5 × 6.'),
      num('How many **glued joints**? (Neighbours in the 2 × 2 base, plus the top cube on the back cube.)', 5, '**5** joints: 4 in the base + 1 on top.', 'The 2 × 2 base has 4 touching pairs, and the top cube touches 1 cube.'),
      num('Each joint hides **2** faces. How many faces are hidden?', 10, '**10** hidden faces.', '5 × 2.'),
      num('Surface area in cm²: **30 − 10** =', 20, '**20 cm²**.', 'Take the hidden faces away.'),
    ] });

  W.scale($('#scale-lab'), { k: 2 });
  W.stretch($('#stretch-lab'), { dims: [5, 3, 2] });
  guided('#scale-steps', 'w11.scale', {
    finale: '🎉 **(E) 45 cm³**: 30 × 2 × 3 × ¼ = 30 × 1.5. Every change to a side multiplies the volume.',
    steps: [
      num('Length **doubled** → the volume is multiplied by…', 2, '× **2**.', 'Twice as long, twice as much.'),
      num('Width **tripled** → the volume is multiplied by…', 3, '× **3**.', 'Three times as wide.'),
      num('Height **divided by four** → the volume is multiplied by… (a fraction or decimal)', 0.25, '× **¼** (0.25).', 'Dividing by 4 is multiplying by ¼.', { tol: 0.001 }),
      num('Multiply the three factors: **2 × 3 × ¼** =', 1.5, '**1.5**.', '2 × 3 = 6, then ÷ 4.'),
      num('New volume: **30 × 1.5** =', 45, '**45 cm³** → (E).', '30 + 15.'),
    ] });

  W.tilt($('#tilt-lab'), { dims: [4, 5, 10], depth: 6 });
  guided('#tilt-steps', 'w11.tilt', {
    finale: '🎉 The **volume** of the water (120) never changes — only the base and the depth do. Depth = volume ÷ base.',
    steps: [
      num('The water starts on the 4 × 5 face, 6 deep. Water volume = 4 × 5 × 6 =', 120, '**120**.', '20 × 6.'),
      num('Tip it onto the **4 × 10** face (area 40). Depth = 120 ÷ 40 =', 3, '**3**.', '120 ÷ 40.'),
      num('Tip it onto the **5 × 10** face (area 50). Depth = 120 ÷ 50 =', 2.4, '**2.4**.', '120 ÷ 50 = 12 ÷ 5.'),
      { q: 'When you tip a **closed** box, what stays the same?', type: 'choice', choices: ['the depth of the water', 'the volume of the water', 'the area of the base'], answer: 1, ok: '**The volume of the water.**' },
    ] });

  refreshSkills(false);
})();
