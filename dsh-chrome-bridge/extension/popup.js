// Popup UI for DSH Chrome Bridge.
// Opening the popup grants "activeTab", which is how we can read the current
// tab's URL here without asking for the broader "tabs" permission.

import {
  NO_EXPIRY,
  scriptUntilFor,
  getEvalOrigins,
  allowEval,
  removeEval,
  actionsUntilFor,
  originOf,
  checkAllowable,
  getShared,
  getAllowed,
  addShared,
  unshareTab,
  allowOrigin,
  removeOrigin,
  stopAll,
  getLog,
  clearLog,
} from './core.js';

const $ = (id) => document.getElementById(id);

// The https origin of the active tab, kept up to date by render() so the
// "Allow this site" click can call chrome.permissions.request without any
// awaits first (Chrome requires a fresh user gesture).
let allowCandidate = null;

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function say(text) {
  $('msg').textContent = text;
}

async function render() {
  const local = await chrome.storage.local.get(['port', 'token']);
  // render() runs every second, so never overwrite a field the user is editing.
  if (document.activeElement !== $('port')) $('port').value = local.port ?? 17373;
  $('token').placeholder = local.token
    ? 'saved. Paste a new token to replace it'
    : 'paste from: node server/index.js --print-token';

  const { status = 'disconnected', actionsUntil = 0 } = await chrome.storage.session.get(['status', 'actionsUntil']);
  const st = $('status');
  st.textContent = status;
  st.className = status === 'connected' ? 'ok' : /rejected|error|no token/.test(status) ? 'bad' : 'muted';

  const tab = await activeTab();
  const origin = tab && originOf(tab.url);
  const shared = await getShared();
  const info = $('tabinfo');
  if (!origin) {
    info.textContent = 'This page cannot be shared (only http and https pages).';
    $('share').disabled = true;
  } else {
    $('share').disabled = false;
    const isShared = shared.includes(tab.id);
    info.textContent = `${isShared ? 'Shared: ' : 'Not shared: '}${new URL(tab.url).host}`;
    $('share').textContent = isShared ? 'Stop sharing this tab' : 'Share this tab';
  }

  const chk = origin ? checkAllowable(origin) : { ok: false };
  allowCandidate = chk.ok ? chk.origin : null;
  const allowed = await getAllowed();
  $('allowsite').disabled = !allowCandidate || allowed.includes(allowCandidate);
  $('allowsite').textContent = allowCandidate && allowed.includes(allowCandidate) ? 'Site is allowed' : 'Allow this site';
  renderAllowed(allowed);
  renderLog(await getLog());

  const { actionsNoExpiry = false } = await chrome.storage.local.get('actionsNoExpiry');
  $('noexpiry').checked = actionsNoExpiry;
  await renderDebugger(allowed, origin);

  const left = Math.max(0, actionsUntil - Date.now());
  $('allow').checked = left > 0;
  $('left').textContent =
    left <= 0
      ? actionsNoExpiry
        ? 'Read-only. Actions stay on until you switch them off.'
        : 'Read-only. Switches itself off after 10 minutes.'
      : actionsUntil >= NO_EXPIRY
        ? 'Actions are on until you switch them off.'
        : `Actions on for ${Math.floor(left / 60000)}m ${Math.floor((left % 60000) / 1000)}s more.`;
}

// render() runs every second; only rebuild a list when its data changed, so a
// click on a button is never lost to a re-render.
const lastDrawn = {};
function changed(key, data) {
  const s = JSON.stringify(data);
  if (lastDrawn[key] === s) return false;
  lastDrawn[key] = s;
  return true;
}

const hasDebugger = typeof chrome.debugger !== 'undefined' && !!chrome.debugger.attach;

async function renderDebugger(allowed, origin) {
  $('debugnote').textContent = hasDebugger
    ? 'Debugger build. Chrome shows a "started debugging this browser" banner on attached tabs; Cancel there revokes access.'
    : 'Default build: no debugger. Load the debugger build to use screenshots, page_read and input_*.';
  $('allowscript').disabled = !hasDebugger;
  $('allowscriptsite').disabled = !hasDebugger || !origin || !allowed.includes(origin);

  const { cdpAttached = [], scriptUntil = 0 } = await chrome.storage.session.get(['cdpAttached', 'scriptUntil']);
  const { debuggerNoIdle = false, scriptNoExpiry = false } = await chrome.storage.local.get(['debuggerNoIdle', 'scriptNoExpiry']);
  $('noidle').checked = debuggerNoIdle;
  $('noscriptexpiry').checked = scriptNoExpiry;
  $('noidle').disabled = !hasDebugger;
  $('noscriptexpiry').disabled = !hasDebugger;
  const scriptLeft = Math.max(0, scriptUntil - Date.now());
  $('allowscript').checked = scriptLeft > 0;
  $('scriptleft').textContent =
    scriptLeft <= 0
      ? scriptNoExpiry
        ? 'Off. Once on, it stays on until you switch it off.'
        : 'Off. By default it switches itself off after 5 minutes.'
      : scriptUntil >= NO_EXPIRY
        ? 'Script is on until you switch it off.'
        : `Script on for ${Math.floor(scriptLeft / 60000)}m ${Math.floor((scriptLeft % 60000) / 1000)}s more.`;

  const evalOrigins = await getEvalOrigins();
  if (changed('scriptsites', evalOrigins)) {
    const ul = $('scriptsites');
    ul.replaceChildren();
    for (const o of evalOrigins) {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = 'script: ' + o;
      const btn = document.createElement('button');
      btn.textContent = 'Remove';
      btn.onclick = async () => {
        await removeEval(o);
        render();
      };
      li.append(name, btn);
      ul.append(li);
    }
  }

  if (changed('attached', cdpAttached)) {
    const ul = $('attached');
    ul.replaceChildren();
    for (const id of cdpAttached) {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = `Debugger attached to tab ${id}`;
      const btn = document.createElement('button');
      btn.textContent = 'Detach';
      btn.onclick = async () => {
        await chrome.runtime.sendMessage({ type: 'detach-debugger', tabId: id });
        render();
      };
      li.append(name, btn);
      ul.append(li);
    }
  }
}

function renderAllowed(allowed) {
  if (!changed('allowed', allowed)) return;
  const ul = $('allowed');
  ul.replaceChildren();
  if (!allowed.length) {
    const li = document.createElement('li');
    li.textContent = 'None yet';
    li.className = 'muted';
    ul.append(li);
    return;
  }
  for (const origin of allowed) {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = origin;
    const btn = document.createElement('button');
    btn.textContent = 'Remove';
    btn.onclick = async () => {
      await removeOrigin(origin);
      render();
    };
    li.append(name, btn);
    ul.append(li);
  }
}

function renderLog(entries) {
  if (!changed('log', entries)) return;
  const ul = $('log');
  ul.replaceChildren();
  if (!entries.length) {
    const li = document.createElement('li');
    li.textContent = 'Nothing yet';
    li.className = 'muted';
    ul.append(li);
    return;
  }
  for (const e of entries.slice(-30).reverse()) {
    const li = document.createElement('li');
    const time = new Date(e.t).toLocaleTimeString();
    li.textContent = `${time} ${e.method}${e.tabId == null ? '' : ' #' + e.tabId}${e.origin ? ' ' + e.origin : ''} ${e.ok ? 'ok' : 'failed: ' + (e.error || '')}`;
    if (!e.ok) li.className = 'bad';
    ul.append(li);
  }
}

$('connect').onclick = async () => {
  const patch = { port: Number($('port').value) || 17373 };
  const token = $('token').value.trim();
  if (token) patch.token = token;
  await chrome.storage.local.set(patch);
  $('token').value = '';
  await chrome.runtime.sendMessage({ type: 'connect' });
  render();
};

$('disconnect').onclick = async () => {
  await chrome.runtime.sendMessage({ type: 'disconnect' });
  render();
};

$('share').onclick = async () => {
  const tab = await activeTab();
  const origin = tab && originOf(tab.url);
  if (!origin) return;
  const shared = await getShared();
  if (shared.includes(tab.id)) {
    await unshareTab(tab.id);
    render();
    return;
  }
  // Written first (not awaited) so the background worker can finish the share
  // if this popup closes while Chrome shows its permission prompt.
  chrome.storage.session.set({ pendingShare: { tabId: tab.id, origin } });
  const granted = await chrome.permissions.request({ origins: [origin + '/*'] });
  if (granted) await addShared(tab.id);
  await chrome.storage.session.remove('pendingShare');
  render();
};

$('allowsite').onclick = async () => {
  const origin = allowCandidate;
  if (!origin) return;
  // Both calls start before any await, so the click's user gesture is intact.
  chrome.storage.session.set({ pendingAllow: { origin } });
  const granted = await chrome.permissions.request({ origins: [origin + '/*'] });
  if (granted) {
    const r = await allowOrigin(origin);
    say(r.ok ? `Allowed ${origin}.` : r.error);
  } else {
    say('Chrome access was not granted.');
  }
  await chrome.storage.session.remove('pendingAllow');
  render();
};

$('allowscript').onchange = async () => {
  await chrome.storage.session.set({ scriptUntil: $('allowscript').checked ? scriptUntilFor($('noscriptexpiry').checked) : 0 });
  render();
};

$('noscriptexpiry').onchange = async () => {
  const noExpiry = $('noscriptexpiry').checked;
  await chrome.storage.local.set({ scriptNoExpiry: noExpiry });
  const { scriptUntil = 0 } = await chrome.storage.session.get('scriptUntil');
  if (scriptUntil > Date.now()) await chrome.storage.session.set({ scriptUntil: scriptUntilFor(noExpiry) });
  render();
};

$('noidle').onchange = async () => {
  await chrome.storage.local.set({ debuggerNoIdle: $('noidle').checked });
  render();
};

$('allowscriptsite').onclick = async () => {
  const origin = allowCandidate;
  if (!origin) return;
  const r = await allowEval(origin);
  say(r.ok ? `Script enabled for ${origin}.` : r.error);
  render();
};

$('clearlog').onclick = async () => {
  await clearLog();
  render();
};

$('stopall').onclick = async () => {
  await stopAll();
  render();
};

$('allow').onchange = async () => {
  const noExpiry = $('noexpiry').checked;
  await chrome.storage.session.set({ actionsUntil: $('allow').checked ? actionsUntilFor(noExpiry) : 0 });
  render();
};

$('noexpiry').onchange = async () => {
  const noExpiry = $('noexpiry').checked;
  await chrome.storage.local.set({ actionsNoExpiry: noExpiry });
  // Apply to actions that are already on.
  const { actionsUntil = 0 } = await chrome.storage.session.get('actionsUntil');
  if (actionsUntil > Date.now()) await chrome.storage.session.set({ actionsUntil: actionsUntilFor(noExpiry) });
  render();
};

chrome.storage.onChanged.addListener(() => render());
setInterval(render, 1000);
render();
