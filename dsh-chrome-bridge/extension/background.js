// DSH Chrome Bridge: service worker.
//
// Connects out to the local bridge server (ws://127.0.0.1:<port>) and answers
// its commands, but only for tabs the user shared from the popup, and only for
// sites the user approved in Chrome's own permission prompt.

import { snapshotFn, linksFn, clickFn, typeFn, scrollFn } from './page_fns.js';
import {
  MAX_AGENT_TABS,
  DENYLIST,
  originOf,
  getShared,
  getAgentTabs,
  getAllowed,
  addShared,
  removeShared,
  addAgentTab,
  allowOrigin,
  stopAll,
  refreshBadges,
  logActivity,
} from './core.js';

const VERSION = '0.2.0';
const DEFAULT_PORT = 17373;
const PING_MS = 20000;
const NAV_TIMEOUT_MS = 20000;

let ws = null;
let pingTimer = null;

// ----------------------------------------------------------------- state ----

async function setStatus(status) {
  await chrome.storage.session.set({ status });
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

async function logOrigin(method, params) {
  if (method === 'page.open') return originOf(params.url || '');
  if (params.tabId == null) return null;
  try {
    return originOf((await chrome.tabs.get(params.tabId)).url || '');
  } catch {
    return null;
  }
}

async function handleCommand(sock, msg) {
  const params = msg.params || {};
  const origin = await logOrigin(msg.method, params);
  try {
    const result = await dispatch(msg.method, params);
    await logActivity({ method: msg.method, tabId: params.tabId, origin, ok: true });
    sock.send(JSON.stringify({ id: msg.id, result }));
  } catch (e) {
    const message = e && e.message ? e.message : String(e);
    await logActivity({ method: msg.method, tabId: params.tabId, origin, ok: false, error: message });
    sock.send(JSON.stringify({ id: msg.id, error: { message } }));
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
    // The tab may have finished loading before the listener was added.
    chrome.tabs
      .get(tabId)
      .then((t) => {
        if (t && t.status === 'complete') finish();
      })
      .catch(() => {});
  });
}

async function dispatch(method, params) {
  switch (method) {
    case 'tabs.list': {
      const { actionsUntil = 0 } = await chrome.storage.session.get('actionsUntil');
      const left = Math.max(0, Math.round((actionsUntil - Date.now()) / 1000));
      const tabs = [];
      const agent = await getAgentTabs();
      for (const tabId of await getShared()) {
        try {
          const t = await chrome.tabs.get(tabId);
          tabs.push({ tabId, title: t.title || '', url: t.url || '(no access)', openedByAgent: agent.includes(tabId) });
        } catch {
          await removeShared(tabId);
        }
      }
      return { actionsEnabled: left > 0, actionsSecondsLeft: left, sharedTabs: tabs };
    }

    case 'page.snapshot': {
      await requireShared(params.tabId);
      await getAccessibleTab(params.tabId);
      return runInTab(params.tabId, snapshotFn, [params.maxChars ?? 8000, params.maxElements ?? 150]);
    }

    case 'page.links': {
      await requireShared(params.tabId);
      await getAccessibleTab(params.tabId);
      return runInTab(params.tabId, linksFn, [
        String(params.contains ?? ''),
        params.maxItems ?? 100,
        !!params.stripQuery,
      ]);
    }

    case 'page.open': {
      // Reading a page the user has allowlisted needs no actions tick (D1).
      const url = String(params.url || '');
      const origin = originOf(url);
      if (!origin || !url.startsWith('https:')) throw new Error('Only https URLs can be opened.');
      if (DENYLIST.includes(origin)) throw new Error(`${origin} is a sign-in site and cannot be opened.`);
      if (!(await getAllowed()).includes(origin)) {
        throw new Error(
          `${origin} is not on the allowlist. Ask the user to open that site and click "Allow this site" in the DSH Chrome Bridge popup, or to share a tab manually.`,
        );
      }
      if (!(await chrome.permissions.contains({ origins: [origin + '/*'] }))) {
        throw new Error(`Chrome no longer grants access to ${origin}. Ask the user to click "Allow this site" again.`);
      }
      if ((await getAgentTabs()).length >= MAX_AGENT_TABS) {
        throw new Error(`Too many tabs opened by the agent (limit ${MAX_AGENT_TABS}). Close one with page_close first.`);
      }
      const tab = await chrome.tabs.create({ url, active: false });
      await addAgentTab(tab.id);
      await addShared(tab.id);
      await waitForLoad(tab.id);
      // A redirect to a site the user never allowed must not stay readable.
      let finalUrl = url;
      try {
        finalUrl = (await chrome.tabs.get(tab.id)).url || url;
      } catch {
        throw new Error('The tab was closed while loading.');
      }
      const finalOrigin = originOf(finalUrl);
      if (finalOrigin !== origin && !(await getAllowed()).includes(finalOrigin)) {
        await chrome.tabs.remove(tab.id).catch(() => {});
        throw new Error(`The page redirected to ${finalOrigin || 'another site'}, which is not on the allowlist. The tab was closed.`);
      }
      return { tabId: tab.id, note: 'Opened in the background and shared. Call page_snapshot to read it.' };
    }

    case 'page.close': {
      if (!(await getAgentTabs()).includes(params.tabId)) {
        throw new Error('page_close only closes tabs that page_open created. Ask the user to close other tabs.');
      }
      await chrome.tabs.remove(params.tabId);
      await removeShared(params.tabId);
      return `Closed tab ${params.tabId}.`;
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
      return runInTab(params.tabId, scrollFn, [String(params.direction || ''), params.ref ? String(params.ref) : '']);
    }

    default:
      throw new Error('Unknown method: ' + method);
  }
}

// ---------------------------------------------------------------- events ----

// If the popup closes while Chrome shows its permission prompt, the popup's
// own code never finishes. This listener completes the share instead.
chrome.permissions.onAdded.addListener(async (permissions) => {
  const { pendingShare, pendingAllow } = await chrome.storage.session.get(['pendingShare', 'pendingAllow']);
  const granted = permissions.origins || [];
  if (pendingShare && granted.includes(pendingShare.origin + '/*')) {
    await addShared(pendingShare.tabId);
    await chrome.storage.session.remove('pendingShare');
  }
  if (pendingAllow && granted.includes(pendingAllow.origin + '/*')) {
    await allowOrigin(pendingAllow.origin);
    await chrome.storage.session.remove('pendingAllow');
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  removeShared(tabId);
});

// Kill switch: stop sharing everything and switch actions off.
chrome.commands.onCommand.addListener((command) => {
  if (command === 'kill-switch') stopAll();
});

// Keep badge colours in step with the "actions on" state.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'session' && (changes.actionsUntil || changes.shared)) refreshBadges();
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
  if (alarm.name === 'reconnect') {
    connect();
    refreshBadges(); // also resets the red badge once actions expire
  }
});

// Make sure the alarm exists after the worker restarts, then try to connect.
chrome.alarms.get('reconnect').then((a) => {
  if (!a) chrome.alarms.create('reconnect', { periodInMinutes: 0.5 });
});
connect();
