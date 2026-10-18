// Popup UI for DSH Chrome Bridge.
// Opening the popup grants "activeTab", which is how we can read the current
// tab's URL here without asking for the broader "tabs" permission.

const ACTION_WINDOW_MS = 10 * 60 * 1000;
const $ = (id) => document.getElementById(id);

function originOf(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.origin : null;
  } catch {
    return null;
  }
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function getShared() {
  const { shared = [] } = await chrome.storage.session.get('shared');
  return shared;
}

async function addShared(tabId) {
  const shared = await getShared();
  if (!shared.includes(tabId)) await chrome.storage.session.set({ shared: [...shared, tabId] });
  await chrome.action.setBadgeText({ tabId, text: 'ON' });
}

async function unshare(tab) {
  const origin = originOf(tab.url);
  const others = (await getShared()).filter((id) => id !== tab.id);
  await chrome.storage.session.set({ shared: others });
  await chrome.action.setBadgeText({ tabId: tab.id, text: '' });
  if (!origin) return;
  let stillUsed = false;
  for (const id of others) {
    try {
      const t = await chrome.tabs.get(id);
      if (originOf(t.url) === origin) stillUsed = true;
    } catch {
      // tab closed
    }
  }
  if (!stillUsed) {
    try {
      await chrome.permissions.remove({ origins: [origin + '/*'] });
    } catch {
      // nothing to remove
    }
  }
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

  const left = Math.max(0, actionsUntil - Date.now());
  $('allow').checked = left > 0;
  $('left').textContent =
    left > 0
      ? `Actions on for ${Math.floor(left / 60000)}m ${Math.floor((left % 60000) / 1000)}s more.`
      : 'Read-only. Switches itself off after 10 minutes.';
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
    await unshare(tab);
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

$('stopall').onclick = async () => {
  for (const id of await getShared()) {
    try {
      await chrome.action.setBadgeText({ tabId: id, text: '' });
    } catch {
      // tab closed
    }
  }
  await chrome.storage.session.set({ shared: [], actionsUntil: 0 });
  const perms = await chrome.permissions.getAll();
  if (perms.origins && perms.origins.length) {
    try {
      await chrome.permissions.remove({ origins: perms.origins });
    } catch {
      // ignore
    }
  }
  render();
};

$('allow').onchange = async () => {
  await chrome.storage.session.set({ actionsUntil: $('allow').checked ? Date.now() + ACTION_WINDOW_MS : 0 });
  render();
};

chrome.storage.onChanged.addListener(() => render());
setInterval(render, 1000);
render();
