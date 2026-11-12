/* Week 9 lesson — rates & word problems. Each lab = something to play with + a "guided" worked example where YOU do each step. */
(function () {
  'use strict';
  const { h, $, $$ } = MC;
  const WEEK = 'week09', PAGE = 'lesson';
  const F = (s) => MC.fmt(s);

  $$('.mission .ask, .mission .orig, .nova .say, .big-idea small').forEach((el) => { el.innerHTML = MC.fmt(el.innerHTML); });

  /* ------------------------------------------------------------ badges / progress */
  const SKILLS = {
    rates:     { label: 'Rates',         emoji: '🚜', color: '#3b82f6', tasks: ['w9.share', 'w9.rice'] },
    kinds:     { label: 'Two kinds',     emoji: '🐔', color: '#10b981', tasks: ['w9.swap', 'w9.birds'] },
    carts:     { label: 'Compare carts', emoji: '🛒', color: '#f59e0b', tasks: ['w9.cart', 'w9.shop'] },
    detective: { label: 'What’s missing?', emoji: '🕵️', color: '#8b5cf6', tasks: ['w9.vend'] },
  };
  const BADGE_TEXT = {
    rates: 'You find the amount for ONE, then scale. Rates are yours!',
    kinds: 'All one kind, then swap. Two-kinds problems are yours!',
    carts: 'Match the carts, subtract, find ONE item. Carts are yours!',
    detective: 'List every possibility, then find the fact that splits them. Detective badge!',
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
  const num = (v) => String(+(+v).toFixed(3));

  /* ============================================================== world 1: share-out machine */
  function labShare() {
    const st = { kg: 20, bags: 10, q: 0.25 };
    const root = $('#share-lab'), bags = h('div', { class: 'bagrow' }), portions = h('div', { class: 'portions' }), out = h('div', { class: 'readout' });
    const sK = slider('🌾 Rice', 10, 200, 5, st.kg, 'kg', (v) => { st.kg = v; draw(); });
    const sB = slider('🛍️ Bags', 2, 40, 1, st.bags, 'bags', (v) => { st.bags = v; draw(); });
    const qs = h('div', { class: 'qtty' }, h('span', {}, '🏠 A family eats'), [0.25, 0.5, 1].map((q) => h('button', { 'data-q': q, class: q === st.q ? 'on' : '', onclick: () => { st.q = q; $$('button', qs).forEach((b) => b.classList.toggle('on', +b.dataset.q === q)); draw(); } }, `${q} kg a day`)));
    root.append(sK.row, sB.row, bags, qs, h('div', { class: 'flabel', style: { fontWeight: 800, color: 'var(--navy)' } }, 'One bag = daily portions:'), portions, out);
    labShare.st = st; labShare.set = (kg, b) => { st.kg = kg; st.bags = b; sK.inp.value = kg; sB.inp.value = b; sK.sync(); sB.sync(); draw(); };
    function draw() {
      const one = st.kg / st.bags, days = one / st.q;
      bags.replaceChildren(...Array.from({ length: st.bags }, () => h('span', {}, '🛍️')));
      portions.replaceChildren(...Array.from({ length: Math.min(60, Math.round(days)) }, (_, i) => h('span', {}, i + 1)));
      out.replaceChildren(pill(`${st.kg} kg ÷ ${st.bags} bags = <b>${num(one)} kg</b> in ONE bag`), pill(`${num(one)} ÷ ${st.q} = <b>${num(days)} days</b> per bag`, 'good'));
    }
    draw();
    guided('#share-steps', 'w9.share', {
      finale: '🎉 **ONE first, then scale.** And dividing by 0.25 is the same as multiplying by 4 (four quarters in every kilo).',
      steps: [
        { type: 'action', q: 'Set the machine to **60 kg** and **24 bags**.', btn: 'It is set', check: () => (st.kg === 60 && st.bags === 24) || 'Rice = 60 kg, bags = 24.', ok: 'Look at the first pill.' },
        { q: 'How many **kg go into ONE bag**?', type: 'number', answer: 2.5, nudge: '60 ÷ 24 — try 60 ÷ 12 = 5, then halve it.', ok: '60 ÷ 24 = **2.5 kg** per bag.' },
        { q: 'Tap **0.5 kg a day**. How many days does ONE bag last?', type: 'number', answer: 5, nudge: 'How many halves in 2.5? Count the daily squares.', ok: '2.5 ÷ 0.5 = 5 days.' },
        { type: 'choice', q: 'Dividing by **0.25** is the same as multiplying by…', choices: ['4', '0.25', '2'], answer: 0, ok: '**4** — there are four quarters in every kilo.', wrongMsgs: { 1: 'That would multiply by the same number. How many 0.25s fit in 1?', 2: 'Two halves make 1, but we need quarters.' } },
        { q: 'One bag holds **2.5 kg** and the family eats **0.25 kg** a day. How many days?', type: 'number', answer: 10, nudge: '2.5 × 4.', ok: '2.5 × 4 = **10 days**.' },
      ],
    });
  }
  function missionRice() {
    guided('#rice-steps', 'w9.rice', {
      finale: '🎉 **14 days.** One bag = 3.5 kg, and 3.5 ÷ 0.25 = 3.5 × 4 = 14. (Check: 3260 × 3.5 = 11 410 ✔)',
      steps: [
        { q: 'How many **kg in ONE bag**? (11 410 ÷ 3260)', type: 'number', answer: 3.5, nudge: 'Hint: 3260 × 3 = 9780. What is left over, and how does it compare with 3260?', hint: 'The leftover 1630 is exactly half of 3260.', ok: '**3.5 kg** per bag.' },
        { q: 'How many **days** does one bag last? (3.5 ÷ 0.25)', type: 'number', answer: 14, nudge: 'Four quarters in a kilo: 3.5 × 4.', ok: '**14 days.**' },
        { q: 'Check it: **14 days × 0.25 kg** = ? Does it match one bag?', type: 'number', answer: 3.5, nudge: '14 × 0.25 = 14 ÷ 4.', ok: '3.5 kg ✔ — matches one bag.' },
      ],
    });
  }

  /* ============================================================== world 2: swap lab */
  function labSwap() {
    const st = { cows: 0 }, N = 10, root = $('#swap-lab'), farm = h('div', { class: 'farmrow' }), out = h('div', { class: 'readout' }), meter = h('div', { class: 'meter-bar' }, h('i', {}));
    const s = slider('🐄 Cows', 0, N, 1, st.cows, '', (v) => { st.cows = v; draw(); });
    root.append(s.row, farm, meter, out);
    function draw() {
      const legs = 2 * (N - st.cows) + 4 * st.cows;
      farm.replaceChildren(...Array.from({ length: N }, (_, i) => h('span', {}, i < st.cows ? '🐄' : '🦆')));
      meter.firstChild.style.width = Math.min(100, (legs / 32) * 100) + '%'; meter.classList.toggle('hit', legs === 32);
      out.replaceChildren(pill(`🦆 ${N - st.cows} ducks × 2 = ${2 * (N - st.cows)}`), pill(`🐄 ${st.cows} cows × 4 = ${4 * st.cows}`), pill(`legs: ${legs} ${legs === 32 ? '✅ exactly 32!' : legs < 32 ? '— too few' : '— too many'}`, legs === 32 ? 'good' : 'hot'));
    }
    draw();
    guided('#swap-steps', 'w9.swap', {
      finale: '🎉 **All ducks first (20 legs), then each swap adds 2 legs.** 12 extra legs ÷ 2 = 6 swaps = 6 cows.',
      steps: [
        { q: 'If **all 10 animals are ducks**, how many legs?', type: 'number', answer: 20, nudge: '10 × 2.', ok: '20 legs (and the slider is at 0 cows).' },
        { q: 'Swap **one duck for one cow**. By how many do the legs go up?', type: 'number', answer: 2, nudge: 'A cow has 4 legs, a duck has 2. Slide to 1 cow and compare.', ok: '4 − 2 = **2 more legs** per swap.' },
        { q: 'We need **32 legs**. How many **extra** legs beyond 20?', type: 'number', answer: 12, nudge: '32 − 20.', ok: '12 extra legs.' },
        { q: 'So how many swaps (= how many cows)?', type: 'number', answer: 6, nudge: '12 extra legs, 2 more per swap.', ok: '12 ÷ 2 = **6 cows**.' },
        { type: 'action', q: 'Set the slider to that many cows. The bar should turn green!', btn: 'Check my farm', check: () => st.cows === 6 || 'Slide the cows until it says ✅ exactly 32.', ok: '6 cows + 4 ducks = 24 + 8 = 32 legs ✔' },
      ],
    });
  }
  function missionBirds() {
    guided('#birds-steps', 'w9.birds', {
      finale: '🎉 **20 chickens.** All emus → 60 treats; 40 extra treats; each swap adds 2 → 20 swaps. Check: 20 × 4 + 10 × 2 = 100 ✔',
      steps: [
        { q: 'Pretend **all 30 birds are emus**. How many treats?', type: 'number', answer: 60, nudge: '30 × 2.', ok: '60 treats.' },
        { q: 'Karl really gave out 100. How many **extra** treats are needed?', type: 'number', answer: 40, nudge: '100 − 60.', ok: '40 extra treats.' },
        { q: 'Swap **one emu for one chicken**: how many more treats?', type: 'number', answer: 2, nudge: 'Chicken 4, emu 2.', ok: 'Each swap adds 2.' },
        { q: 'How many swaps (= **chickens**)?', type: 'number', answer: 20, nudge: '40 ÷ 2.', ok: '**20 chickens**, so 10 emus.' },
        { q: 'Check: **20 × 4 + 10 × 2** = ?', type: 'number', answer: 100, nudge: '80 + 20.', ok: '100 treats ✔' },
      ],
    });
  }

  /* ============================================================== world 3: carts */
  function labCart() {
    const st = { pen: 3 }, root = $('#cart-lab'), carts = h('div', { class: 'carts' }), out = h('div', { class: 'readout' });
    const s = slider('✏️ Pen price', 0, 5, 1, st.pen, '$', (v) => { st.pen = v; draw(); });
    root.append(s.row, carts, out);
    function draw() {
      const nb = 5 - st.pen, b = st.pen + 2 * nb;
      carts.replaceChildren(
        h('div', { class: 'cart' }, h('b', {}, 'Cart A'), '✏️ 📓', h('small', {}, `$${st.pen} + $${nb} = $5 ✔ (always)`)),
        h('div', { class: 'cart' }, h('b', {}, 'Cart B'), '✏️ 📓 📓', h('small', {}, `$${st.pen} + $${nb} + $${nb} = $${b}`)));
      out.replaceChildren(pill(`notebook = $5 − $${st.pen} = $${nb}`), pill(`cart B = $${b} ${b === 8 ? '✅ matches $8!' : b > 8 ? '— too much' : '— too little'}`, b === 8 ? 'good' : 'hot'));
    }
    draw();
    guided('#cart-steps', 'w9.cart', {
      finale: '🎉 **Cart B is cart A plus one notebook, and it costs $3 more.** So a notebook = $3, and the pen = $5 − $3 = $2. No guessing needed!',
      steps: [
        { type: 'choice', q: 'Compare the carts. What is the **difference** between cart B and cart A?', choices: ['one more pen', 'one more notebook', 'two more pens'], answer: 1, ok: 'Cart B = cart A + **one notebook**.', wrongMsgs: { 0: 'Both carts have exactly one pen.', 2: 'Count the ✏️ in each cart.' } },
        { q: 'How much **more** does cart B cost than cart A?', type: 'number', answer: 3, nudge: '$8 − $5.', ok: '$3 more.' },
        { q: 'So one **notebook** costs…', type: 'number', answer: 3, nudge: 'The extra item costs the extra money.', ok: 'A notebook costs **$3**.' },
        { q: 'And the **pen** costs? (cart A is $5)', type: 'number', answer: 2, nudge: '$5 − $3.', ok: 'Pen = **$2**. Slide the pen to $2 to see cart B hit $8 ✅' },
      ],
    });
  }
  function missionShop() {
    guided('#shop-steps', 'w9.shop', {
      finale: '🎉 **$38.** Double cart 1 → 2 balls + 2 shirts = $200. Cart 2 has one more shirt for $62 more, so shirt = $62 and ball = $100 − $62 = $38.',
      steps: [
        { q: 'Double the first purchase: **2 balls + 2 shirts** cost?', type: 'number', answer: 200, nudge: '2 × $100.', ok: '$200.' },
        { type: 'choice', q: 'Compare with **2 balls + 3 shirts = $262**. What is the extra item?', choices: ['one extra ball', 'one extra shirt', 'one extra ball and one extra shirt'], answer: 1, ok: 'One extra **shirt**.', wrongMsgs: { 0: 'Both carts have 2 balls.', 2: 'Only the shirts differ: 3 versus 2.' } },
        { q: 'So **one shirt** costs…', type: 'number', answer: 62, nudge: '$262 − $200.', ok: '**$62** for a shirt.' },
        { q: 'Then **one ball** costs ($100 for ball + shirt)…', type: 'number', answer: 38, nudge: '$100 − $62.', ok: '**$38** for a ball.' },
        { q: 'Check: **2 × 38 + 3 × 62** = ?', type: 'number', answer: 262, nudge: '76 + 186.', ok: '$262 ✔' },
      ],
    });
  }

  /* ============================================================== world 4: vending detective */
  function missionVend() {
    const st = { c: 0, e: 0 }, found = new Map(), root = $('#vend-lab');
    const out = h('div', { class: 'readout' }), list = h('div', { class: 'found' });
    const sC = slider('🍗 Chicken sold', 0, 13, 1, 0, '', (v) => { st.c = v; draw(); });
    const sE = slider('🥚 Egg sold', 0, 15, 1, 0, '', (v) => { st.e = v; draw(); });
    root.append(h('div', { class: 'explorer-box' }, h('p', { html: F('<b>Detective board.</b> Cheese is easy ($21 ÷ $3 = 7 sold). Chicken + egg must make **$40**. Slide until the money matches — then note how many sandwiches are left.') }), sC.row, sE.row, out, h('div', { class: 'flabel', style: { fontWeight: 800 } }, 'Combos you found:'), list));
    function draw() {
      const money = 3 * st.c + 2.5 * st.e, ok = money === 40, left = 42 - 7 - st.c - st.e;
      if (ok) found.set(`${st.c},${st.e}`, left);
      out.replaceChildren(pill(`🍗 $${3 * st.c} + 🥚 $${2.5 * st.e} = <b>$${money}</b> ${ok ? '✅ = $40' : money < 40 ? '— too little' : '— too much'}`, ok ? 'good' : 'hot'), pill(`sandwiches left: 42 − 7 − ${st.c} − ${st.e} = <b>${left}</b>`));
      list.replaceChildren(...[...found].map(([k, l]) => pill(`${k.split(',')[0]} chicken + ${k.split(',')[1]} egg → ${l} left`)));
    }
    draw();
    guided('#vend-steps', 'w9.vend', {
      finale: '🎉 **(B) The number of remaining sandwiches.** Two combinations fit — they leave 21 or 20 sandwiches — so that one fact settles it. The others never change: money left = $57.50, cheese left = 7.',
      steps: [
        { q: 'Cheese sandwiches sold: **$21 ÷ $3** = ?', type: 'number', answer: 7, nudge: 'Each cheese sandwich is $3.', ok: '7 cheese sold, 7 left.' },
        { q: 'Money from chicken + egg = **$61 − $21** = ?', type: 'number', answer: 40, nudge: 'Cheese is already counted.', ok: '$40 from chicken and egg.' },
        { type: 'action', q: 'Slide to **one** chicken/egg combination that makes exactly **$40**.', btn: 'I found one', check: () => found.size >= 1 || 'Try 10 chicken: that is $30 — how many egg sandwiches make the other $10?', ok: 'One combination found.' },
        { type: 'action', q: 'Find a **second, different** combination.', btn: 'I found another', check: () => found.size >= 2 || 'There is exactly one more. Hint: change the egg number by 6 and the chicken number by 5.', ok: 'Two combinations — (10 chicken, 4 egg) and (5 chicken, 10 egg).' },
        { type: 'choice', q: 'The two combinations leave **different numbers of sandwiches**. Which extra fact tells them apart?',
          choices: ['Total price of remaining sandwiches', 'Number of remaining sandwiches', 'Total price of sandwiches at the beginning', 'Number of remaining cheese sandwiches', 'No additional information is needed'], answer: 1,
          ok: '**The number of remaining sandwiches** (21 or 20).',
          wrongMsgs: { 0: 'The money left is always $118.50 − $61 = $57.50, the same for both.', 2: 'We can already add up the starting stock: it is the same for both.', 3: 'Cheese left is 7 in both cases.', 4: 'Two combinations fit — so we do need one more fact.' } },
      ],
    });
  }

  [labShare, missionRice, labSwap, missionBirds, labCart, missionShop, missionVend].forEach((fn) => { try { fn(); } catch (e) { console.error('lab failed:', fn.name, e); } });
  refreshSkills(false);
})();
