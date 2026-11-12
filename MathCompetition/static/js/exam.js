/* Mock-exam engine (page type "exam"): a timed paper with an answer sheet, the official scoring, and a marked review.
 *
 *   MC.exam(root, data)   data = the same JSON a quiz page uses, plus
 *     "exam":   { "title", "minutes": 90, "blank": 1, "review": "practice", "rules": ["…"] }
 *     "groups": [ { "id": "A", "label": "Part A", "points": 4 }, … ]      (a question's `skill` names its group)
 *   Scoring: correct = the group's points · wrong = 0 · left blank = exam.blank (1 in the CJMC), so guessing blindly does not pay.
 *   An attempt in progress survives a reload (localStorage "mc.exam.<week>.<page>"); the result is saved in MC.store.
 */
(function () {
  'use strict';
  const { h, $, $$ } = MC;

  MC.exam = function (root, data) {
    const d = document.body.dataset, week = d.week, page = d.pageSlug;
    const cfg = Object.assign({ minutes: 90, blank: 1, review: 'practice', rules: [] }, data.exam || {});
    const groups = data.groups || [], qs = data.questions;
    const grp = (q) => groups.find((g) => g.id === q.skill) || { id: q.skill, label: q.skill, points: 1 };
    const pts = (q) => grp(q).points;
    const maxScore = qs.reduce((s, q) => s + pts(q), 0);
    const letter = (i) => 'ABCDE'[i];
    const LS = `mc.exam.${week}.${page}`;
    const load = () => { try { return JSON.parse(localStorage.getItem(LS)); } catch (e) { return null; } };
    const save = () => { try { localStorage.setItem(LS, JSON.stringify(st)); } catch (e) { /* private mode: no resume, still works */ } };
    let st = load() || { phase: 'intro' };
    let tick = null;

    const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;
    const elapsed = () => Math.floor(((st.end || Date.now()) - st.start) / 1000);
    const remaining = () => (st.untimed ? null : Math.max(0, cfg.minutes * 60 - elapsed()));

    function figure(q) {
      if (!q.figure) return null;
      const f = h('div', { class: 'figure' });
      if (typeof q.figure === 'string') f.innerHTML = q.figure;
      else if (MC.widgets[q.figure.type]) MC.widgets[q.figure.type](f, q.figure, { q, exam: true });
      return f;
    }

    /* ------------------------------------------------------------------ intro */
    function intro() {
      clearInterval(tick);
      const prev = MC.store.get(week, page, 'result');
      const parts = groups.map((g) => `${g.label}: ${qs.filter((q) => q.skill === g.id).length} questions × ${g.points} points`);
      const untimed = h('input', { type: 'checkbox', id: 'ex-untimed' });
      root.replaceChildren(
        h('section', { class: 'hero' }, h('div', { class: 'eyebrow' }, data.eyebrow || 'Mock exam'), h('h1', {}, cfg.title || data.title || 'Mock exam'),
          (cfg.intro || data.intro) ? h('p', { html: MC.fmt(cfg.intro || data.intro) }) : null),
        h('div', { class: 'ex-card' },
          h('h2', {}, '📋 Before you start'),
          h('ul', { class: 'ex-rules' },
            h('li', { html: `⏱ <b>${cfg.minutes} minutes</b> for <b>${qs.length} questions</b>. The clock keeps running if you reload the page.` }),
            h('li', { html: '📊 ' + parts.join(' · ') + `. Top score: <b>${maxScore}</b>.` }),
            h('li', { html: `✅ Right answer = the points above. ❌ Wrong answer = <b>0</b>. ⬜ <b>Blank = ${cfg.blank} point</b> — so don’t guess if you’re really unsure!` }),
            ...cfg.rules.map((r) => h('li', { html: MC.fmt(r) }))),
          h('label', { class: 'ex-untimed' }, untimed, ' Practice without the timer'),
          h('div', { class: 'row' }, h('button', { class: 'btn warm', onclick: () => start(untimed.checked) }, '▶ Start the exam')),
          prev && prev.done ? h('p', { class: 'muted', html: `Your best so far: <b>${prev.best} / ${maxScore}</b> (${prev.attempts} attempt${prev.attempts > 1 ? 's' : ''}).` }) : null,
          h('p', { class: 'muted', html: `Stuck afterwards? <a href="${MC.base}/${d.track === 'study' ? 'study' : 'week'}/${week}/${cfg.review}">Question bank with hints &amp; solutions →</a>` })));
    }

    function start(untimedMode) {
      st = { phase: 'run', start: Date.now(), untimed: !!untimedMode, answers: {} };
      save(); run();
    }

    /* -------------------------------------------------------------------- run */
    function run() {
      const sheetBtns = {}, optBtns = {};
      const timerEl = h('span', { class: 'ex-timer' }), count = h('span', { class: 'ex-count' });
      const sheet = h('div', { class: 'ex-sheet' }, qs.map((q, i) => (sheetBtns[q.id] = h('button', { title: `Question ${i + 1}`, onclick: () => $(`#exq-${q.id}`).scrollIntoView({ behavior: 'smooth', block: 'start' }) }, i + 1))));
      const confirmBox = h('div', { class: 'ex-confirm', style: { display: 'none' } });
      const bar = h('div', { class: 'ex-bar' }, h('div', { class: 'ex-bar-top' }, timerEl, count, h('button', { class: 'btn small go', onclick: askFinish }, '🏁 Finish')), sheet, confirmBox);
      const sections = groups.map((g) => {
        const list = qs.filter((q) => q.skill === g.id);
        return h('section', { class: 'ex-part' },
          h('h2', {}, `${g.emoji ? g.emoji + ' ' : ''}${g.label}`),
          h('p', { class: 'muted' }, `Each correct answer is worth ${g.points} points. Unanswered questions are worth ${cfg.blank} point each.`),
          list.map((q) => card(q, qs.indexOf(q) + 1)));
      });
      root.replaceChildren(bar, ...sections);

      function card(q, n) {
        const opts = h('div', { class: 'choices' }, q.choices.map((c, i) => (
          (optBtns[q.id] = optBtns[q.id] || [])[i] = h('button', { class: 'opt', onclick: () => pick(q, i) },
            h('span', { class: 'letter' }, letter(i)), h('span', { class: 'ex-choice', html: MC.fmt(c) })))));
        return h('article', { class: 'ex-q', id: `exq-${q.id}` },
          h('div', { class: 'qhead' }, h('span', { class: 'src' }, `Question ${n}`), h('span', { class: 'tag' }, `${pts(q)} pts`)),
          h('div', { class: 'qtext', html: MC.fmt(q.text) }), figure(q), opts,
          h('button', { class: 'btn ghost small', onclick: () => pick(q, null) }, '✕ Clear (leave blank)'));
      }
      function paint() {
        qs.forEach((q) => {
          const a = st.answers[q.id];
          sheetBtns[q.id].classList.toggle('on', a != null);
          optBtns[q.id].forEach((b, i) => b.classList.toggle('picked', a === i));
        });
        const n = Object.values(st.answers).filter((v) => v != null).length;
        count.textContent = `${n} / ${qs.length} answered`;
      }
      function pick(q, i) {
        if (st.phase !== 'run') return;
        if (i == null || st.answers[q.id] === i) delete st.answers[q.id]; else st.answers[q.id] = i;
        save(); paint();
      }
      function askFinish() {
        const blanks = qs.filter((q) => st.answers[q.id] == null).length;
        confirmBox.style.display = '';
        confirmBox.replaceChildren(
          h('span', { html: blanks ? `You left <b>${blanks}</b> blank (${blanks * cfg.blank} point${blanks * cfg.blank > 1 ? 's' : ''}). Finish anyway?` : 'All questions answered. Mark the exam?' }),
          h('button', { class: 'btn small go', onclick: () => finish(false) }, 'Yes, mark it'),
          h('button', { class: 'btn small ghost', onclick: () => { confirmBox.style.display = 'none'; } }, 'Keep working'));
      }
      function clock() {
        const r = remaining();
        if (r == null) { timerEl.textContent = '⏱ no timer'; return; }
        timerEl.textContent = `⏱ ${mmss(r)}`;
        timerEl.classList.toggle('low', r <= 600);
        if (r <= 0) finish(true);
      }
      paint(); clock();
      clearInterval(tick); tick = setInterval(clock, 500);
    }

    /* ----------------------------------------------------------------- result */
    function mark() {
      return qs.map((q) => {
        const a = st.answers[q.id];
        const status = a == null ? 'blank' : a === q.answer ? 'right' : 'wrong';
        return { q, a, status, points: status === 'right' ? pts(q) : status === 'blank' ? cfg.blank : 0 };
      });
    }
    function finish(timeUp) {
      if (st.phase !== 'run') return;
      st.phase = 'done'; st.end = Date.now(); st.timeUp = !!timeUp; save();
      const rows = mark(), score = rows.reduce((s, r) => s + r.points, 0);
      const prev = MC.store.get(week, page, 'result') || {};
      MC.store.set(week, page, 'result', { done: 1, best: Math.max(prev.best || 0, score), last: score, attempts: (prev.attempts || 0) + 1 });
      if (!prev.done) { const xp = Math.max(10, Math.round(score / 2)); MC.store.addXP(xp); MC.toast(`+${xp} XP ⭐`); }
      if (score >= maxScore * 0.75) MC.confetti(120);
      result();
    }
    function result() {
      clearInterval(tick);
      const rows = mark(), score = rows.reduce((s, r) => s + r.points, 0), n = (s) => rows.filter((r) => r.status === s).length;
      const best = (MC.store.get(week, page, 'result') || {}).best || score;
      const partRows = groups.map((g) => {
        const rs = rows.filter((r) => r.q.skill === g.id);
        return h('tr', {}, h('td', {}, g.label), h('td', {}, `${rs.filter((r) => r.status === 'right').length} / ${rs.length}`), h('td', {}, `${rs.reduce((s, r) => s + r.points, 0)} / ${rs.length * g.points}`));
      });
      const link = (q) => `${MC.base}/${d.track === 'study' ? 'study' : 'week'}/${week}/${cfg.review}#${q.id}`;
      const blankNote = n('blank') ? `${n('blank')} blank = ${n('blank') * cfg.blank} point${n('blank') * cfg.blank > 1 ? 's' : ''}.` : '';
      root.replaceChildren(
        h('section', { class: 'hero' }, h('div', { class: 'eyebrow' }, st.timeUp ? '⏰ Time is up' : 'Marked'), h('h1', {}, `${score} / ${maxScore} points`),
          h('p', {}, `${n('right')} right · ${n('wrong')} wrong · ${n('blank')} blank${st.untimed ? '' : ` · time used ${mmss(elapsed())} of ${cfg.minutes}:00`}. Your best: ${best}.`)),
        h('div', { class: 'ex-card' },
          h('table', { class: 'ex-table' }, h('tr', {}, h('th', {}, 'Part'), h('th', {}, 'Right'), h('th', {}, 'Points')), partRows),
          h('p', { class: 'muted' }, `${blankNote} A wrong answer scores 0 and a blank scores ${cfg.blank}: when you can’t narrow it down, leaving it blank is safer.`.trim())),
        h('div', { class: 'ex-card' }, h('h2', {}, 'Question by question'),
          h('table', { class: 'ex-table wide' },
            h('tr', {}, ['#', 'Part', 'You answered', 'Correct', 'Points', ''].map((t) => h('th', {}, t))),
            rows.map((r, i) => h('tr', { class: 'ex-' + r.status },
              h('td', {}, i + 1), h('td', {}, r.q.skill), h('td', {}, r.a == null ? '— blank' : letter(r.a)), h('td', {}, letter(r.q.answer)),
              h('td', {}, `${r.points} / ${pts(r.q)}`),
              h('td', {}, r.status === 'right' ? '✅' : h('a', { href: link(r.q) }, 'Hints & solution →')))))),
        h('div', { class: 'row' },
          h('button', { class: 'btn warm', onclick: () => { st = { phase: 'intro' }; save(); intro(); } }, '↺ Take it again'),
          h('a', { class: 'btn ghost', href: `${MC.base}/${d.track === 'study' ? 'study' : 'week'}/${week}/${cfg.review}` }, '🏋️ Question bank')));
      window.scrollTo(0, 0);
    }

    // route by saved phase (a reload in the middle of an exam resumes it)
    if (st.phase === 'run') { if (!st.untimed && remaining() <= 0) { run(); finish(true); } else run(); }
    else if (st.phase === 'done') result();
    else intro();
  };
})();
