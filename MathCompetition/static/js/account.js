/* Sign-in page: log in, then (once) offer to move this device's saved stars into the account. */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const BASE = MC.base || '';
  const msg = $('#login-msg'), form = $('#login-form');
  const next = window.MC_NEXT || `${BASE}/`;
  try { $('#u').value = localStorage.getItem('mc.lastUser') || ''; } catch (e) { /* ignore */ }
  $('#skip').href = next;
  if (!MC.session.enabled) { msg.textContent = 'Accounts are not set up on this server yet — progress is saved on this device.'; form.querySelector('button').disabled = true; }

  const localProgress = () => { try { return JSON.parse(localStorage.getItem('mc.progress.v1')); } catch (e) { return null; } };
  const hasProgress = (p) => p && (p.xp > 0 || Object.values(p.weeks || {}).some((pages) => Object.values(pages).some((items) => Object.keys(items).length)));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.className = 'account-msg'; msg.textContent = 'Checking…';
    let r, data = {};
    try {
      r = await fetch(`${BASE}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ username: $('#u').value, password: $('#p').value }) });
      data = await r.json();
    } catch (err) { msg.className = 'account-msg bad'; msg.textContent = 'Could not reach the server. Try again.'; return; }
    if (!r.ok) { msg.className = 'account-msg bad'; msg.textContent = data.error || 'Could not sign in.'; $('#p').value = ''; return; }
    try { localStorage.setItem('mc.lastUser', data.user.username); } catch (err) { /* ignore */ }
    // A brand-new account + stars already saved on this device: offer to bring them along (never silently:
    // on a shared tablet they may belong to someone else).
    const local = localProgress();
    if (data.empty && hasProgress(local) && confirm(`Move the stars saved on this device into ${data.user.name}'s account?\n\nOK = yes, they're mine.  Cancel = leave them here.`)) {
      try {
        await fetch(`${BASE}/api/progress/import`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(local) });
        localStorage.removeItem('mc.progress.v1');
      } catch (err) { /* they can retry from the account later; nothing is lost */ }
    }
    location.href = data.user.role === 'parent' && next === `${BASE}/` ? `${BASE}/parent/` : next;
  });
})();
