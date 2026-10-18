// DSH Chrome Bridge: service worker.
//
// Connects out to the local bridge server (ws://127.0.0.1:<port>) and answers
// its commands, but only for tabs the user shared from the popup, and only for
// sites the user approved in Chrome's own permission prompt.

import { snapshotFn, clickFn, typeFn, scrollFn } from './page_fns.js';

const VERSION = '0.1.0';
const DEFAULT_PORT = 17373;
const PING_MS = 20000;
const NAV_TIMEOUT_MS = 20000;

let ws = null;
let pingTimer = null;

// ----------------------------------------------------------------- state ----

async function setStatus(status) {
  await chrome.storage.session.set({ status });
}

async function getShared() {
  const { shared = [] } = await chrome.storage.session.get('shared');
  return shared;
}

async function addShared(tabId) {
  const shared = await getShared();
  if (!shared.includes(tabId)) await chrome.storage.session.set({ shared: [...shared, tabId] });
  try {
    await chrome.action.setBadgeText({ tabId, text: 'ON' });
  } catch {
    // tab may be gone
  }
}

async function removeShared(tabId) {
  const shared = await getShared();
  await chrome.storage.session.set({ shared: shared.filter((id) => id !== tabId) });
}

function originOf(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.origin : null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------ connection ----

async function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  const { port = DEFAULT_PORT, token = '', enabled = false } = await chrome.storage.local.get([
    'port',
    'token',
    'enabled',
  ]);
  if (!enabled) return;
  if (!token) {
    await setStatus('no token set');
    return;
  }
  await setStatus('connecting');
  let sock;
  try {
    sock = new WebSocket(`ws://127.0.0.1:${Number(port)}`);
  } catch (e) {
    await setStatus('error: ' + e.message);
    return;
  }
  ws = sock;
  sock.onopen = () => sock.send(JSON.stringify({ type: 'hello', token, version: VERSION }));
  sock.onmessage = (ev) => onMessage(sock, ev);
  sock.onerror = () => {};
  sock.onclose = async (ev) => {
    if (ws !== sock) return;
    ws = null;
    clearInterval(pingTimer);
    await setStatus(ev.code === 1008 ? 'rejected: check the token' : 'disconnected');
  };
}

async function disconnect() {
  await chrome.storage.local.set({ enabled: false });
  clearInterval(pingTimer);
  if (ws) {
    const s = ws;
    ws = null;
    s.close(1000, 'user disconnected');
  }
  await setStatus('disconnected');
}

async function reconnect() {
  if (ws) {
    const s = ws;
    ws = null;
    clearInterval(pingTimer);
    s.close(1000, 'reconnecting');
  }
  await connect();
}

function onMessage(sock, ev) {
  let msg;
  try {
    msg = JSON.parse(ev.data);
  } catch {
    return;
  }
  if (msg.type === 'ready') {
    setStatus('connected');
    clearInterval(pingTimer);
    // Regular traffic also keeps this service worker alive.
    pingTimer = setInterval(() => {
      if (sock.readyState === WebSocket.OPEN) sock.send(JSON.stringify({ type: 'ping' }));
    }, PING_MS);
    return;
  }
  if (msg.type === 'pong') return;
  if (msg.id != null && msg.method) handleCommand(sock, msg);
}

async function handleCommand(sock, msg) {
  try {
    const result = await dispatch(msg.method, msg.params || {});
    sock.send(JSON.stringify({ id: msg.id, result }));
  } catch (e) {
    sock.send(JSON.stringify({ id: msg.id, error: { message: e && e.message ? e.message : String(e) } }));
  }
}

// -------------------------------------------------------------- commands ----

async function requireShared(tabId) {
  const shared = await getShared();
  if (!shared.includes(tabId)) {
    throw new Error(
      `Tab ${tabId} is not shared. Call tabs_list to see shared tabs, or ask the user to click "Share this tab" in the DSH Chrome Bridge popup.`,
    );
  }
}

async function requireActions() {
  const { actionsUntil = 0 } = await chrome.storage.session.get('actionsUntil');
  if (Date.now() > actionsUntil) {
    throw new Error(
      'Actions are disabled. Ask the user to tick "Allow actions" in the DSH Chrome Bridge popup (it switches itself off after 10 minutes).',
    );
  }
}

async function getAccessibleTab(tabId) {
  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    await removeShared(tabId);
    throw new Error(`Tab ${tabId} no longer exists.`);
  }
  const origin = originOf(tab.url || '');
  const ok = origin ? await chrome.permissions.contains({ origins: [origin + '/*'] }) : false;
  if (!ok) {
    throw new Error(
      'The extension has no access to this tab\'s current site. Ask the user to open the popup on that tab and click "Share this tab" again.',
    );
  }
  return tab;
}

async function runInTab(tabId, func, args) {
  let results;
  try {
    results = await chrome.scripting.executeScript({ target: { tabId }, func, args });
  } catch (e) {
    throw new Error('Could not run in that tab: ' + (e && e.message ? e.message : String(e)));
  }
  const r = results && results[0] && results[0].result;
  if (!r) throw new Error('The page returned no result.');
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

function waitForLoad(tabId) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      chrome.tabs.onUpdated.removeListener(listener);
      clearTimeout(timer);
      resolve();
    };
    const listener = (id, info) => {
      if (id === tabId && info.status === 'complete') finish();
    };
    const timer = setTimeout(finish, NAV_TIMEOUT_MS);
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function dispatch(method, params) {
  switch (method) {
    case 'tabs.list': {
      const { actionsUntil = 0 } = await chrome.storage.session.get('actionsUntil');
      const left = Math.max(0, Math.round((actionsUntil - Date.now()) / 1000));
      const tabs = [];
      for (const tabId of await getShared()) {
        try {
          const t = await chrome.tabs.get(tabId);
          tabs.push({ tabId, title: t.title || '', url: t.url || '(no access)' });
        } catch {
          await removeShared(tabId);
        }
      }
      return { actionsEnabled: left > 0, actionsSecondsLeft: left, sharedTabs: tabs };
    }

    case 'page.snapshot': {
      await requireShared(params.tabId);
      await getAccessibleTab(params.tabId);
      return runInTab(params.tabId, snapshotFn, [params.maxChars ?? 8000]);
    }

    case 'page.navigate': {
      await requireActions();
      await requireShared(params.tabId);
      await getAccessibleTab(params.tabId);
      const target = originOf(params.url || '') ? params.url : null;
      if (!target) throw new Error('Only http and https URLs are allowed.');
      await chrome.tabs.update(params.tabId, { url: target });
      await waitForLoad(params.tabId);
      return `Navigated to ${target}. If the site is new to the extension, page_snapshot will fail until the user clicks "Share this tab" on it and approves the site in Chrome.`;
    }

    case 'page.click': {
      await requireActions();
      await requireShared(params.tabId);
      await getAccessibleTab(params.tabId);
      return runInTab(params.tabId, clickFn, [String(params.ref || '')]);
    }

    case 'page.type': {
      await requireActions();
      await requireShared(params.tabId);
      await getAccessibleTab(params.tabId);
      return runInTab(params.tabId, typeFn, [String(params.ref || ''), String(params.text ?? ''), !!params.submit]);
    }

    case 'page.scroll': {
      await requireActions();
      await requireShared(params.tabId);
      await getAccessibleTab(params.tabId);
      return runInTab(params.tabId, scrollFn, [String(params.direction || '')]);
    }

    default:
      throw new Error('Unknown method: ' + method);
  }
}

// ---------------------------------------------------------------- events ----

// If the popup closes while Chrome shows its permission prompt, the popup's
// own code never finishes. This listener completes the share instead.
chrome.permissions.onAdded.addListener(async (permissions) => {
  const { pendingShare } = await chrome.storage.session.get('pendingShare');
  if (!pendingShare) return;
  if ((permissions.origins || []).includes(pendingShare.origin + '/*')) {
    await addShared(pendingShare.tabId);
    await chrome.storage.session.remove('pendingShare');
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  removeShared(tabId);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false;
  if (msg && msg.type === 'connect') {
    chrome.storage.local.set({ enabled: true }).then(reconnect).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg && msg.type === 'disconnect') {
    disconnect().then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});

chrome.runtime.onStartup.addListener(connect);
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('reconnect', { periodInMinutes: 0.5 });
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'reconnect') connect();
});

// Make sure the alarm exists after the worker restarts, then try to connect.
chrome.alarms.get('reconnect').then((a) => {
  if (!a) chrome.alarms.create('reconnect', { periodInMinutes: 0.5 });
});
connect();
