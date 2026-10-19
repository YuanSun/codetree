// Debugger lane (v0.3): a thin layer over chrome.debugger.
//
// Everything that talks to Chrome DevTools Protocol (CDP) goes through rawSend
// in this file, and rawSend only forwards methods from ALLOWED_METHODS. The
// two methods that run JavaScript (Runtime.evaluate) are reachable only through
// evalFixed (extension-authored expressions) and evalUser (page_eval, which
// background.js gates first). send() refuses them.
//
// Only exists in the debugger build: the default manifest has no "debugger"
// permission, so available() is false there.

export const CDP_VERSION = '1.3';
export const IDLE_MS = 5 * 60 * 1000;
export const EVENT_CAP = 200;

// Least privilege: only methods the tools actually use.
export const ALLOWED_METHODS = Object.freeze([
  'Page.enable',
  'Page.captureScreenshot',
  'Page.getLayoutMetrics',
  'Accessibility.enable',
  'Accessibility.getFullAXTree',
  'DOM.enable',
  'DOM.describeNode',
  'DOM.resolveNode',
  'DOM.getBoxModel',
  'DOM.scrollIntoViewIfNeeded',
  'DOM.focus',
  'Input.dispatchMouseEvent',
  'Input.dispatchKeyEvent',
  'Input.insertText',
  'Runtime.enable',
  'Runtime.evaluate',
  'Target.setAutoAttach',
  'Log.enable',
  'Network.enable',
]);

// Belt and braces (rule 12): these stay refused even if one is ever added to the
// table by mistake. Network.enable is the only Network method, for event capture.
const FORBIDDEN = /^(Storage\.|DOMStorage\.|Fetch\.|IO\.|Network\.(?!enable$)|Browser\.|Security\.|IndexedDB\.|CacheStorage\.)/;

export function isAllowed(method) {
  return ALLOWED_METHODS.includes(method) && !FORBIDDEN.test(method);
}

// Expressions written here, never built from model input.
const FIXED = Object.freeze({
  focus: `(() => {
    let a = document.activeElement;
    while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement;
    if (!a) return null;
    const attr = (n) => ((a.getAttribute && a.getAttribute(n)) || '').toLowerCase();
    return { tag: a.tagName, type: attr('type'), autocomplete: attr('autocomplete'), role: attr('role'),
      editable: !!a.isContentEditable, readOnly: !!a.readOnly, disabled: !!a.disabled };
  })()`,
  readFocused: `(() => {
    let a = document.activeElement;
    while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement;
    if (!a) return null;
    if (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') {
      return { kind: 'field', value: String(a.value), start: a.selectionStart, end: a.selectionEnd };
    }
    if (a.isContentEditable) return { kind: 'editable', value: String(a.innerText) };
    return null;
  })()`,
});

// ------------------------------------------------------------------- state ----

// tabId -> { lastUsed, sessions: Map, refs: Map, console: [], network: Map, networkOn }
const tabs = new Map();

export function available() {
  return typeof chrome !== 'undefined' && !!chrome.debugger && typeof chrome.debugger.attach === 'function';
}

export function isAttached(tabId) {
  return tabs.has(tabId);
}

export function attachedTabs() {
  return [...tabs.keys()];
}

function state(tabId) {
  const s = tabs.get(tabId);
  if (!s) throw new Error('The debugger is not attached to that tab.');
  s.lastUsed = Date.now();
  return s;
}

export function getState(tabId) {
  return state(tabId);
}

async function saveAttached() {
  await chrome.storage.session.set({ cdpAttached: [...tabs.keys()] });
}

// ------------------------------------------------------------------ sending ----

async function rawSend(tabId, method, params = {}, sessionId) {
  if (!isAllowed(method)) throw new Error(`CDP method ${method} is not allowed.`);
  const target = sessionId ? { tabId, sessionId } : { tabId };
  return chrome.debugger.sendCommand(target, method, params);
}

// Public sender: everything except the JavaScript-running method.
export async function send(tabId, method, params = {}, sessionId) {
  if (method === 'Runtime.evaluate') throw new Error('Use evalFixed or evalUser for Runtime.evaluate.');
  state(tabId);
  return rawSend(tabId, method, params, sessionId);
}

export async function evalFixed(tabId, name, sessionId) {
  if (!Object.hasOwn(FIXED, name)) throw new Error('Unknown internal expression.');
  state(tabId);
  const r = await rawSend(tabId, 'Runtime.evaluate', { expression: FIXED[name], returnByValue: true }, sessionId);
  if (r.exceptionDetails) throw new Error('Internal page check failed.');
  return r.result ? r.result.value : null;
}

// Runs model-supplied JavaScript. background.js calls this only after the
// page_eval gating (toggle, per-origin list, length, denylist).
export async function evalUser(tabId, expression, sessionId) {
  state(tabId);
  const r = await rawSend(
    tabId,
    'Runtime.evaluate',
    { expression: String(expression), returnByValue: true, awaitPromise: true, timeout: 5000, userGesture: false },
    sessionId,
  );
  if (r.exceptionDetails) {
    const d = r.exceptionDetails;
    throw new Error('Script error: ' + String((d.exception && d.exception.description) || d.text || 'unknown').slice(0, 300));
  }
  return r.result ? r.result.value : undefined;
}

// ---------------------------------------------------------------- lifecycle ----

export async function attach(tabId) {
  if (!available()) {
    throw new Error('This build of the extension has no debugger permission. Load the debugger build (see README).');
  }
  if (tabs.has(tabId)) {
    // The popup or kill switch may have detached from another context; storage is the shared record.
    const { cdpAttached = [] } = await chrome.storage.session.get('cdpAttached');
    if (cdpAttached.includes(tabId)) {
      tabs.get(tabId).lastUsed = Date.now();
      return;
    }
    tabs.delete(tabId);
  }
  try {
    await chrome.debugger.attach({ tabId }, CDP_VERSION);
  } catch (e) {
    const m = e && e.message ? e.message : String(e);
    if (/another debugger|already attached/i.test(m)) {
      throw new Error(
        'Another debugger is attached to this tab (DevTools, another extension, or a session this extension lost). Close DevTools on the tab, or press Detach in the popup, then retry.',
      );
    }
    throw new Error('Could not attach the debugger: ' + m);
  }
  tabs.set(tabId, {
    lastUsed: Date.now(),
    sessions: new Map(),
    refs: new Map(),
    console: [],
    network: new Map(),
    networkOn: false,
  });
  await saveAttached();
  try {
    await rawSend(tabId, 'Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: true });
    await rawSend(tabId, 'Page.enable');
    await rawSend(tabId, 'Runtime.enable');
    await rawSend(tabId, 'Log.enable');
  } catch (e) {
    await detach(tabId);
    throw new Error('Could not start the debugger session: ' + (e && e.message ? e.message : String(e)));
  }
  try {
    await chrome.action.setBadgeText({ tabId, text: 'DBG' });
  } catch {
    // tab may be gone
  }
}

export async function detach(tabId) {
  const had = tabs.delete(tabId);
  if (had) {
    try {
      await chrome.debugger.detach({ tabId });
    } catch {
      // already detached
    }
    await saveAttached();
    try {
      const { shared = [] } = await chrome.storage.session.get('shared');
      await chrome.action.setBadgeText({ tabId, text: shared.includes(tabId) ? 'ON' : '' });
    } catch {
      // tab may be gone
    }
  }
}

export async function detachAll() {
  for (const id of [...tabs.keys()]) await detach(id);
}

// Called from an alarm and before every command.
export async function detachIdle(now = Date.now()) {
  // The user can turn the idle timeout off in the popup (like "Keep actions on").
  const { debuggerNoIdle = false } = await chrome.storage.local.get('debuggerNoIdle');
  if (debuggerNoIdle) return;
  for (const [id, s] of [...tabs]) if (now - s.lastUsed > IDLE_MS) await detach(id);
}

// -------------------------------------------------------------------- events ----

const originOf = (url) => {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.origin : null;
  } catch {
    return null;
  }
};

// Console text is page data: shortened here, wrapped as untrusted by the server.
function pushConsole(s, entry) {
  s.console.push({ ...entry, text: String(entry.text).slice(0, 300) });
  if (s.console.length > EVENT_CAP) s.console.shift();
}

function remember(s, requestId, patch) {
  const cur = s.network.get(requestId) || {};
  s.network.set(requestId, { ...cur, ...patch });
  if (s.network.size > EVENT_CAP) s.network.delete(s.network.keys().next().value);
}

// Origin plus path only: no query string, no fragment, no credentials.
export function cleanUrl(url) {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return '(unparsable url)';
  }
}

export function onEvent(source, method, params = {}) {
  const s = tabs.get(source.tabId);
  if (!s) return;

  switch (method) {
    case 'Target.attachedToTarget': {
      const info = params.targetInfo || {};
      if (info.type === 'iframe' || info.type === 'page') {
        s.sessions.set(params.sessionId, { sessionId: params.sessionId, targetId: info.targetId, url: info.url || '' });
        // Auto-attach is not recursive, so ask each child for its own children.
        rawSend(source.tabId, 'Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: true }, params.sessionId).catch(() => {});
      }
      return;
    }
    case 'Target.detachedFromTarget':
      s.sessions.delete(params.sessionId);
      return;
    case 'Page.frameNavigated':
      if (params.frame && !params.frame.parentId && !source.sessionId) s.refs.clear(); // refs die with a page load
      return;
    case 'Runtime.consoleAPICalled': {
      const text = (params.args || []).map((a) => (a.value !== undefined ? String(a.value) : a.description || a.type)).join(' ');
      pushConsole(s, { level: params.type, text });
      return;
    }
    case 'Log.entryAdded': {
      const e = params.entry || {};
      pushConsole(s, { level: e.level, text: e.text, origin: originOf(e.url || '') });
      return;
    }
    // Network events: keep method, origin+path, status, type and size. Drop
    // everything else (headers, post data, cookies) before storing anything.
    case 'Network.requestWillBeSent':
      remember(s, params.requestId, {
        method: params.request && params.request.method,
        url: cleanUrl(params.request && params.request.url),
        type: params.type,
      });
      return;
    case 'Network.responseReceived':
      remember(s, params.requestId, {
        status: params.response && params.response.status,
        type: params.type,
        url: cleanUrl(params.response && params.response.url),
      });
      return;
    case 'Network.loadingFinished':
      remember(s, params.requestId, { size: params.encodedDataLength });
      return;
    case 'Network.loadingFailed':
      remember(s, params.requestId, { failed: true });
      return;
    default:
  }
}

export function onDetach(source, reason) {
  const had = tabs.delete(source.tabId);
  if (!had) return;
  saveAttached();
  if (reason === 'canceled_by_user') {
    // The user pressed Cancel on Chrome's banner: treat it as revoking access.
    chrome.storage.session.set({ actionsUntil: 0, scriptUntil: 0, debuggerCanceled: true });
  }
}

export async function startNetwork(tabId) {
  const s = state(tabId);
  if (!s.networkOn) {
    await rawSend(tabId, 'Network.enable');
    s.networkOn = true;
  }
}

// ------------------------------------------------------------------- frames ----

// Child frames that live in their own process, with their origin. The caller
// decides whether an origin is readable (it must be allowlisted).
export function frames(tabId) {
  return [...state(tabId).sessions.values()].map((f) => ({ ...f, origin: originOf(f.url) }));
}

export function wire() {
  if (!available()) return;
  chrome.debugger.onEvent.addListener(onEvent);
  chrome.debugger.onDetach.addListener(onDetach);
}
