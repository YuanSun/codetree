/* Parent view: every child's points and finished work, and the questions that needed the most help. */
(function () {
  'use strict';
  const { h } = MC;
  const BASE = MC.base || '';
  const root = document.getElementById('parent-root');
  const get = async (url) => { const r = await fetch(BASE + url, { credentials: 'same-origin' }); if (!r.ok) throw Object.assign(new Error(r.status), { status: r.status }); return r.json(); };
  const ago = (iso) => {
    if (!iso) return 'never';
    const m = Math.round((Date.now() - new Date(iso)) / 60000);
    return m < 2 ? 'just now' : m < 90 ? `${m} min ago` : m < 2880 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
  };
  const plain = (html) => { const d = document.createElement('div'); d.innerHTML = String(html || ''); return d.textContent.replace(/\s+/g, ' ').trim(); };

  async function units() {
    const [a, b] = await Promise.all([get('/api/weeks'), get('/api/study')]);
    const m = {};
    for (const u of [...a, ...b]) m[u.id] = u;
    return m;
  }

  function showLogin(text) {
    MC.fill(root, h('div', { class: 'account-card' }, h('p', {}, text), h('a', { class: 'btn', href: `${BASE}/login?next=${encodeURIComponent(location.pathname)}` }, 'Sign in as a parent')));
  }

  async function overview() {
    let data;
    try { data = await get('/api/parent/overview'); } catch (e) {
      return showLogin(e.status === 403 ? 'This page is for parent profiles.' : e.status === 404 ? 'Accounts are not set up on this server yet.' : 'Please sign in as a parent to see how everyone is doing.');
    }
    if (!data.children.length) return MC.fill(root, h('p', { class: 'muted' }, 'No child profiles yet. Create one with: python3 userctl.py create-user <name> --role child'));
    MC.fill(root, h('div', { class: 'kid-grid' }, data.children.map((c) =>
      h('button', { class: 'kid-card', type: 'button', onclick: () => detail(c) },
        h('div', { class: 'kid-name' }, `🙂 ${c.name}`),
        h('div', { class: 'kid-stats' }, h('span', {}, h('b', {}, c.xp), ' XP'), h('span', {}, h('b', {}, c.done), ' done'), h('span', {}, h('b', {}, c.stars), ' ⭐')),
        h('div', { class: 'muted small' }, `Last active: ${ago(c.last)}`)))));
  }

  async function detail(c) {
    MC.fill(root, h('p', { class: 'muted' }, 'Loading…'));
    let d, U;
    try { [d, U] = await Promise.all([get(`/api/parent/child/${c.id}`), units()]); } catch (e) { return MC.fill(root, h('p', {}, 'Could not load.')); }

    // group by unit -> page
    const by = {};
    for (const it of d.items) ((by[it.unit] = by[it.unit] || {})[it.page] = by[it.unit][it.page] || []).push(it);
    const needsHelp = d.items.filter((it) => it.data.done && ((it.data.hints || 0) >= 2 || (it.data.attempts || 0) >= 3) && it.page !== 'lesson');
    const bank = {};                       // unit/page -> question id -> text (only for units that need it)
    await Promise.all([...new Set(needsHelp.map((it) => `${it.unit}|${it.page}`))].map(async (k) => {
      const [unit, page] = k.split('|'); const u = U[unit]; const pg = u && u.pages.find((p) => p.slug === page);
      if (!pg || pg.type !== 'quiz') return;
      try { const j = await get(`/${u.track === 'study' ? 'study' : 'week'}/${unit}/${pg.file}`); bank[k] = Object.fromEntries(j.questions.map((q) => [q.id, q])); } catch (e) { /* titles are a nicety */ }
    }));

    const back = h('button', { class: 'btn ghost', type: 'button', onclick: overview }, '‹ All children');
    const unitBlocks = Object.keys(by).sort().reverse().map((unit) => {
      const u = U[unit];
      return h('section', { class: 'unit-block' },
        h('h3', {}, `${u ? u.emoji + ' ' + u.label + ' — ' + u.title : unit}`),
        h('div', { class: 'page-rows' }, Object.entries(by[unit]).map(([page, items]) => {
          const pg = u && u.pages.find((p) => p.slug === page);
          const done = items.filter((i) => i.data.done), total = pg ? pg.total : 0;
          const stars = done.reduce((n, i) => n + (i.data.stars || 0), 0), hints = items.reduce((n, i) => n + (i.data.hints || 0), 0);
          return h('div', { class: 'page-row' },
            h('b', {}, pg ? pg.title : page),
            h('div', { class: 'meter' }, h('i', { style: { width: total ? `${Math.min(100, Math.round(done.length / total * 100))}%` : '0%' } })),
            h('span', { class: 'muted' }, `${done.length}${total ? ` / ${total}` : ''} done`),
            page === 'lesson' ? null : h('span', { class: 'muted' }, `${stars} ⭐ · ${hints} hints`));
        })));
    });
    MC.fill(root,
      back,
      h('h2', { class: 'kid-title' }, `🙂 ${d.user.name}`, h('span', { class: 'pill' }, `${d.xp} XP`)),
      needsHelp.length ? h('section', { class: 'help-block' },
        h('h3', {}, '🧩 Worth a look together'), h('p', { class: 'muted small' }, 'Finished, but only after 2+ hints or 3+ tries.'),
        h('ul', {}, needsHelp.slice(0, 12).map((it) => {
          const q = (bank[`${it.unit}|${it.page}`] || {})[it.item]; const u = U[it.unit];
          return h('li', {}, h('b', {}, `${u ? u.label : it.unit} · ${it.item}`), q ? ` — ${plain(q.title || q.text).slice(0, 90)}…` : '',
            h('span', { class: 'muted small' }, ` (${it.data.hints || 0} hints, ${it.data.attempts || 0} tries)`));
        }))) : h('p', { class: 'muted' }, d.items.length ? '✅ Nothing is standing out — no question needed lots of hints.' : 'Nothing done yet.'),
      ...unitBlocks);
  }

  overview();
})();
