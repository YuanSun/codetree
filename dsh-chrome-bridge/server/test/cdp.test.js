// Tests the debugger lane (cdp.js, cdp_tools.js, and the gating in background.js)
// against a fake chrome.debugger and a scripted DevTools Protocol. This does NOT
// run in real Chrome. Run with: npm test

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const extDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'extension');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, ms = 2000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = fn();
    if (v) return v;
    await sleep(5);
  }
  throw new Error('timed out waiting for condition');
}

// ------------------------------------------------------------ fake Chrome ----

function makeStorage() {
  const data = {};
  return {
    data,
    async get(keys) {
      const ks = keys == null ? Object.keys(data) : Array.isArray(keys) ? keys : [keys];
      const out = {};
      for (const k of ks) if (k in data) out[k] = data[k];
      return out;
    },
    async set(obj) {
      Object.assign(data, obj);
    },
    async remove(keys) {
      for (const k of [].concat(keys)) delete data[k];
    },
  };
}

const local = makeStorage();
const session = makeStorage();
const listeners = { onMessage: [], onRemoved: [], onCommand: [], onAdded: [], onEvent: [], onDetach: [], onAlarm: [] };
const tabs = new Map(); // id -> { title, url }
const granted = new Set();
const sockets = [];
const badges = new Map();

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.sent = [];
    sockets.push(this);
  }
  send(d) {
    this.sent.push(JSON.parse(d));
  }
  close() {
    this.readyState = 3;
    if (this.onclose) this.onclose({ code: 1000 });
  }
  open() {
    this.readyState = 1;
    if (this.onopen) this.onopen();
  }
  receive(obj) {
    if (this.onmessage) this.onmessage({ data: JSON.stringify(obj) });
  }
}
globalThis.WebSocket = FakeWebSocket;

// --- scripted DevTools Protocol -------------------------------------------

const sent = []; // every sendCommand: { target, method, params }
const attached = new Set();
let attachError = null;
let dpr = 1; // extra scaling the "browser" applies to screenshots
let shotPadding = 0; // extra bytes appended to every screenshot
let axNodes = [];
let describe = {}; // backendNodeId -> attributes array
let focus = null; // what document.activeElement looks like
let userEval = () => ({ value: 42 });
let dropChars = 0; // simulate an editor that loses the last N characters of an insert
const insertCalls = [];

function fakeJpeg(width, height, pad = 0) {
  const bytes = new Uint8Array(20 + pad);
  bytes.set([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 255, width >> 8, width & 255, 3]);
  return Buffer.from(bytes).toString('base64');
}

const responders = {
  'Page.getLayoutMetrics': () => ({ cssVisualViewport: { clientWidth: 1400, clientHeight: 900, pageX: 0, pageY: 0 } }),
  'Page.captureScreenshot': (p) => {
    const w = Math.round(p.clip.width * p.clip.scale * dpr);
    const h = Math.round(p.clip.height * p.clip.scale * dpr);
    return { data: fakeJpeg(w, h, shotPadding) };
  },
  'Accessibility.getFullAXTree': () => ({ nodes: axNodes }),
  'DOM.describeNode': (p) => ({ node: { attributes: describe[p.backendNodeId] || [] } }),
  'DOM.scrollIntoViewIfNeeded': () => ({}),
  'DOM.getBoxModel': () => ({ model: { content: [10, 20, 110, 20, 110, 60, 10, 60] } }),
  'DOM.focus': () => ({}),
  'Input.dispatchKeyEvent': (p) => {
    if (p.commands && p.commands.includes('selectAll') && focus && focus.kind === 'field') {
      focus.start = 0;
      focus.end = focus.value.length;
    }
    return {};
  },
  'Input.insertText': (p) => {
    insertCalls.push(p.text);
    if (focus && focus.kind === 'field') {
      const text = dropChars ? p.text.slice(0, p.text.length - dropChars) : p.text;
      focus.value = focus.value.slice(0, focus.start) + text + focus.value.slice(focus.end);
      focus.start = focus.end = focus.start + text.length;
    }
    return {};
  },
};

globalThis.chrome = {
  runtime: {
    id: 'self',
    onMessage: { addListener: (f) => listeners.onMessage.push(f) },
    onStartup: { addListener() {} },
    onInstalled: { addListener() {} },
  },
  storage: { local, session, onChanged: { addListener() {} } },
  alarms: { create() {}, get: async () => null, onAlarm: { addListener: (f) => listeners.onAlarm.push(f) } },
  action: {
    setBadgeText: async ({ tabId, text }) => badges.set(tabId, text),
    setBadgeBackgroundColor: async () => {},
  },
  commands: { onCommand: { addListener: (f) => listeners.onCommand.push(f) } },
  permissions: {
    onAdded: { addListener: (f) => listeners.onAdded.push(f) },
    contains: async ({ origins }) => origins.every((o) => granted.has(o)),
    remove: async ({ origins }) => origins.forEach((o) => granted.delete(o)),
    getAll: async () => ({ origins: [...granted] }),
  },
  tabs: {
    onRemoved: { addListener: (f) => listeners.onRemoved.push(f) },
    onUpdated: { addListener() {}, removeListener() {} },
    get: async (id) => {
      const t = tabs.get(id);
      if (!t) throw new Error('No tab with id ' + id);
      return { id, title: t.title, url: t.url, status: 'complete' };
    },
    remove: async (id) => {
      tabs.delete(id);
      for (const f of listeners.onRemoved) f(id);
    },
  },
  scripting: { executeScript: async () => [{ result: { ok: true, value: false } }] },
  debugger: {
    attach: async ({ tabId }) => {
      if (attachError) throw new Error(attachError);
      attached.add(tabId);
    },
    detach: async ({ tabId }) => {
      attached.delete(tabId);
    },
    sendCommand: async (target, method, params) => {
      sent.push({ target, method, params });
      if (method === 'Runtime.evaluate') {
        const e = params.expression;
        if (e.includes('selectionStart')) return { result: { value: focus && focus.kind ? { kind: focus.kind, value: focus.value, start: focus.start, end: focus.end } : null } };
        if (e.includes('isContentEditable') && e.includes('autocomplete')) return { result: { value: focus ? focus.info : null } };
        return userEval(e);
      }
      const f = responders[method];
      return f ? f(params, target) : {};
    },
    onEvent: { addListener: (f) => listeners.onEvent.push(f) },
    onDetach: { addListener: (f) => listeners.onDetach.push(f) },
  },
};

const cdp = await import(pathToFileURL(path.join(extDir, 'cdp.js')).href);
const core = await import(pathToFileURL(path.join(extDir, 'core.js')).href);
await import(pathToFileURL(path.join(extDir, 'background.js')).href);

const sendRuntimeMessage = (msg) => new Promise((resolve) => listeners.onMessage[0](msg, { id: 'self' }, resolve));
const fire = (tabId, method, params, sessionId) => listeners.onEvent[0]({ tabId, sessionId }, method, params);

let msgId = 0;
async function cmd(sock, method, params = {}) {
  const id = ++msgId;
  sock.receive({ id, method, params });
  return waitFor(() => sock.sent.find((m) => m.id === id));
}

after(async () => {
  await sendRuntimeMessage({ type: 'disconnect' });
});

const SITE = 'https://app.example';
const T = 10; // shared, allowlisted tab

function fieldInfo(extra = {}) {
  return { tag: 'TEXTAREA', type: '', autocomplete: '', role: '', editable: false, readOnly: false, disabled: false, ...extra };
}

async function reset({ allow = true, actions = true } = {}) {
  await cdp.detachAll();
  attached.clear();
  sent.length = 0;
  insertCalls.length = 0;
  badges.clear();
  tabs.clear();
  tabs.set(T, { title: 'App', url: SITE + '/editor' });
  tabs.set(11, { title: 'Other', url: 'https://other.example/' });
  granted.clear();
  granted.add(SITE + '/*');
  await session.set({ shared: [T], agentTabs: [], actionsUntil: actions ? Date.now() + 600_000 : 0, scriptUntil: 0, activityLog: [], cdpAttached: [] });
  await session.remove('debuggerCanceled');
  await local.set({ allowedOrigins: allow ? [SITE] : [], evalOrigins: [] });
  dpr = 1;
  shotPadding = 0;
  dropChars = 0;
  attachError = null;
  axNodes = [];
  describe = {};
  focus = { kind: 'field', value: '', start: 0, end: 0, info: fieldInfo() };
  userEval = () => ({ result: { value: 42 } });
}

let sock;
test('setup: connect the fake extension', async () => {
  await local.set({ port: 4321, token: 't', enabled: false });
  await sendRuntimeMessage({ type: 'connect' });
  sock = sockets.at(-1);
  sock.open();
  sock.receive({ type: 'ready' });
  await waitFor(() => session.data.status === 'connected');
});

// ------------------------------------------------------------- C1 allowlist ----

test('C1: only allowlisted CDP methods are sent, and cookie/storage/body methods never are', async () => {
  await reset();
  await cdp.attach(T);
  for (const m of [
    'Network.getCookies', 'Network.getAllCookies', 'Network.getResponseBody', 'Network.setCookie',
    'Storage.getCookies', 'DOMStorage.getDOMStorageItems', 'Fetch.enable', 'IO.read', 'Browser.close',
    'Page.navigate', 'Emulation.setUserAgentOverride', 'Target.createTarget',
  ]) {
    await assert.rejects(() => cdp.send(T, m), /not allowed/, m);
  }
  assert.ok(!sent.some((s) => /Cookies|getResponseBody|Storage|Fetch|IO\.|Browser\./.test(s.method)));
  for (const m of cdp.ALLOWED_METHODS) assert.ok(cdp.isAllowed(m), m);
  assert.equal(cdp.isAllowed('Network.getCookies'), false);
  assert.equal(cdp.isAllowed('Network.enable'), true, 'event capture only');
  assert.ok(Object.isFrozen(cdp.ALLOWED_METHODS), 'the table cannot be edited at run time');
});

test('C1: the JavaScript-running method is reachable only through the two gated functions', async () => {
  await reset();
  await cdp.attach(T);
  await assert.rejects(() => cdp.send(T, 'Runtime.evaluate', { expression: '1' }), /evalFixed or evalUser/);
  await assert.rejects(() => cdp.evalFixed(T, 'document.cookie'), /Unknown internal expression/);

  const rd = (f) => fs.readFileSync(path.join(extDir, f), 'utf8');
  const count = (s, re) => (s.match(re) || []).length;
  assert.equal(count(rd('cdp.js'), /rawSend\(\s*tabId,\s*'Runtime\.evaluate'/g), 2, 'exactly evalFixed and evalUser');
  assert.equal(count(rd('cdp_tools.js'), /Runtime\.evaluate/g), 0);
  assert.equal(count(rd('background.js'), /Runtime\.evaluate/g), 0);
  assert.equal(count(rd('cdp_tools.js'), /evalUser\(/g), 1, 'one caller: evaluate()');
  assert.equal(count(rd('background.js'), /cdpTools\.evaluate\(/g), 1, 'one caller: the cdp.eval case');
  const evalCase = rd('background.js').match(/case 'cdp\.eval': \{[\s\S]*?\n    \}/)[0];
  assert.match(evalCase, /requireScript\(\)/);
  assert.match(evalCase, /checkExpression/);
  assert.ok(evalCase.indexOf('requireScript') < evalCase.indexOf('cdpTools.evaluate'));
});

test('C1: attach errors are explained, and attaching enables the event domains', async () => {
  await reset();
  attachError = 'Another debugger is already attached to the tab with id: 10.';
  await assert.rejects(() => cdp.attach(T), /Another debugger is attached.*DevTools/s);
  assert.equal(cdp.isAttached(T), false);
  attachError = null;
  await cdp.attach(T);
  assert.deepEqual(sent.map((s) => s.method), ['Target.setAutoAttach', 'Page.enable', 'Runtime.enable', 'Log.enable']);
  assert.deepEqual(session.data.cdpAttached, [T]);
  assert.equal(badges.get(T), 'DBG');
});

test('C1: idle sessions detach after 5 minutes', async () => {
  await reset();
  await cdp.attach(T);
  await cdp.detachIdle(Date.now() + 4 * 60_000);
  assert.equal(cdp.isAttached(T), true);
  await cdp.detachIdle(Date.now() + 6 * 60_000);
  assert.equal(cdp.isAttached(T), false);
  assert.equal(attached.has(T), false);
  assert.deepEqual(session.data.cdpAttached, []);
  assert.equal(badges.get(T), 'ON', 'back to the shared badge');
});

test('C1: Cancel on the Chrome banner revokes actions and script, and DSH is told once', async () => {
  await reset();
  await session.set({ scriptUntil: Date.now() + 60_000 });
  await cdp.attach(T);
  listeners.onDetach[0]({ tabId: T }, 'canceled_by_user');
  assert.equal(cdp.isAttached(T), false);
  assert.equal(session.data.actionsUntil, 0);
  assert.equal(session.data.scriptUntil, 0);
  const r = await cmd(sock, 'cdp.screenshot', { tabId: T });
  assert.match(r.error.message, /pressed Cancel/);
  const again = await cmd(sock, 'cdp.screenshot', { tabId: T });
  assert.equal(again.error, undefined, 'only reported once');
});

test('C1: other detach reasons just drop the session', async () => {
  await reset();
  await cdp.attach(T);
  listeners.onDetach[0]({ tabId: T }, 'target_closed');
  assert.equal(cdp.isAttached(T), false);
  assert.ok(session.data.actionsUntil > Date.now(), 'actions untouched');
});

// ------------------------------------------------------------------ gating ----

test('rule 15: the debugger only attaches to shared tabs on allowlisted sites', async () => {
  await reset();
  assert.match((await cmd(sock, 'cdp.screenshot', { tabId: 11 })).error.message, /not shared/);
  await session.set({ shared: [T, 11] });
  granted.add('https://other.example/*');
  const r = await cmd(sock, 'cdp.screenshot', { tabId: 11 });
  assert.match(r.error.message, /only works on tabs whose site is on the allowlist/);
  assert.equal(attached.has(11), false);

  await reset({ allow: false });
  assert.match((await cmd(sock, 'cdp.read', { tabId: T })).error.message, /allowlist/);
  assert.equal(attached.size, 0);
});

test('rule 15: a tab that moves off the allowlisted site is detached on the next call', async () => {
  await reset();
  assert.equal((await cmd(sock, 'cdp.read', { tabId: T })).error, undefined);
  assert.equal(cdp.isAttached(T), true);
  tabs.get(T).url = 'https://other.example/';
  granted.add('https://other.example/*');
  const r = await cmd(sock, 'cdp.read', { tabId: T });
  assert.match(r.error.message, /allowlist/);
  assert.equal(cdp.isAttached(T), false);
});

test('without the debugger permission every debugger tool explains how to get the right build', async () => {
  await reset();
  const saved = chrome.debugger;
  delete chrome.debugger;
  try {
    for (const m of ['cdp.screenshot', 'cdp.read', 'cdp.click', 'cdp.type', 'cdp.key', 'cdp.scroll', 'cdp.console', 'cdp.network']) {
      assert.match((await cmd(sock, m, { tabId: T })).error.message, /no debugger permission/, m);
    }
  } finally {
    chrome.debugger = saved;
  }
});

test('reading tools need no actions tick, input tools do, and tab close detaches', async () => {
  await reset({ actions: false });
  assert.equal((await cmd(sock, 'cdp.read', { tabId: T })).error, undefined);
  assert.equal((await cmd(sock, 'cdp.screenshot', { tabId: T })).error, undefined);
  for (const m of ['cdp.click', 'cdp.key', 'cdp.type', 'cdp.scroll', 'cdp.eval']) {
    const r = await cmd(sock, m, { tabId: T, x: 1, y: 1, key: 'a', text: 'x', deltaY: 5, expression: '1' });
    assert.match(r.error.message, /disabled/i, m);
  }
  listeners.onRemoved[0](T);
  await waitFor(() => !cdp.isAttached(T));
});

test('actions expiring detaches tabs that were used for actions, but not read-only ones', async () => {
  await reset();
  await cmd(sock, 'cdp.read', { tabId: T }); // read-only use
  await session.set({ actionsUntil: 0 });
  listeners.onAlarm[0]({ name: 'reconnect' });
  await sleep(20);
  assert.equal(cdp.isAttached(T), true, 'read-only sessions are not tied to the actions window');

  await session.set({ actionsUntil: Date.now() + 60_000 });
  await cmd(sock, 'cdp.scroll', { tabId: T, x: 5, y: 5, deltaY: 100 }); // used for actions
  listeners.onAlarm[0]({ name: 'reconnect' });
  await sleep(20);
  assert.equal(cdp.isAttached(T), true, 'still inside the window');
  await session.set({ actionsUntil: Date.now() - 1 });
  listeners.onAlarm[0]({ name: 'reconnect' });
  await waitFor(() => !cdp.isAttached(T));
  assert.equal(attached.has(T), false);
});

// -------------------------------------------------------------- C2 screenshot ----

test('C2: screenshot returns an image under the width cap with its scale, and needs no actions', async () => {
  await reset({ actions: false });
  const r = await cmd(sock, 'cdp.screenshot', { tabId: T });
  assert.equal(r.error, undefined);
  const [img, text] = r.result.__content;
  assert.equal(img.type, 'image');
  assert.equal(img.mimeType, 'image/jpeg');
  assert.match(text.text, /Screenshot 1024x658 px\. Viewport 1400x900 CSS px, scale 0\.731/);
  assert.match(text.text, /x = ix \/ scale \+ origin x/);
  const cap = sent.find((s) => s.method === 'Page.captureScreenshot');
  assert.equal(cap.params.format, 'jpeg');
  assert.equal(cap.params.quality, 70);
});

test('C2: maxWidth is honoured and capped at 1568; regions are converted to page coordinates', async () => {
  await reset();
  let r = await cmd(sock, 'cdp.screenshot', { tabId: T, maxWidth: 5000 });
  assert.match(r.result.__content[1].text, /Screenshot 1400x900/, 'viewport is narrower than the cap');
  sent.length = 0;
  r = await cmd(sock, 'cdp.screenshot', { tabId: T, maxWidth: 400, region: { x: 100, y: 50, width: 800, height: 400 } });
  const cap = sent.find((s) => s.method === 'Page.captureScreenshot');
  assert.deepEqual({ ...cap.params.clip }, { x: 100, y: 50, width: 800, height: 400, scale: 0.5 });
  assert.match(r.result.__content[1].text, /Screenshot 400x200 px.*scale 0\.500.*origin in the viewport: \(100, 50\)/s);
  const bad = await cmd(sock, 'cdp.screenshot', { tabId: T, region: { x: 0, y: 0, width: 0, height: 5 } });
  assert.match(bad.error.message, /region needs/);
});

test('C2: if the browser scales the image further (device pixel ratio), the capture is redone to fit', async () => {
  await reset();
  dpr = 2;
  sent.length = 0;
  const r = await cmd(sock, 'cdp.screenshot', { tabId: T });
  assert.equal(sent.filter((s) => s.method === 'Page.captureScreenshot').length, 2);
  const m = r.result.__content[1].text.match(/Screenshot (\d+)x/);
  assert.ok(Number(m[1]) <= 1025);
});

test('C2: an oversize image is retried smaller and then refused with a clear message', async () => {
  await reset();
  shotPadding = 2 * 1024 * 1024;
  const r = await cmd(sock, 'cdp.screenshot', { tabId: T });
  assert.match(r.error.message, /over 1 MB/);
  const qualities = sent.filter((s) => s.method === 'Page.captureScreenshot').map((s) => s.params.quality);
  assert.deepEqual(qualities.slice(0, 3), [70, 50, 30], 'quality steps down first');
});

// --------------------------------------------------------------- C3 page_read ----

function ax(nodes) {
  axNodes = nodes.map((n, i) => ({ nodeId: String(i + 1), ...n }));
}
const R = (v) => ({ type: 'role', value: v });
const N = (v) => ({ type: 'computedString', value: v });

test('C3: page_read lists blocks and controls with refs, and hides password values', async () => {
  await reset();
  ax([
    { role: R('RootWebArea'), name: N('MakeCode'), childIds: ['2', '3', '4', '5', '6'], backendDOMNodeId: 1 },
    { role: R('button'), name: N('Download'), parentId: '1', backendDOMNodeId: 2, properties: [{ name: 'disabled', value: { type: 'boolean', value: true } }] },
    { role: R('group'), name: N('Begin stack, on start'), parentId: '1', backendDOMNodeId: 3 },
    { role: R('textbox'), name: N('Search'), value: { value: 'micro' }, parentId: '1', backendDOMNodeId: 4 },
    { role: R('textbox'), name: N('Password'), value: { value: 'hunter2' }, parentId: '1', backendDOMNodeId: 5 },
    { role: R('generic'), name: N(''), parentId: '1', backendDOMNodeId: 6 },
  ]);
  describe = { 5: ['type', 'password'] };
  const all = await cmd(sock, 'cdp.read', { tabId: T, filter: 'all' });
  assert.equal(all.error, undefined);
  assert.match(all.result, /Title: MakeCode/);
  assert.match(all.result, /\[ax\d+\] group "Begin stack, on start"/);
  const inter = (await cmd(sock, 'cdp.read', { tabId: T })).result;
  assert.match(inter, /\[ax1\] button "Download" \(disabled\)/);
  assert.match(inter, /textbox "Search" value="micro"/);
  assert.match(inter, /textbox "Password" \(password\)/);
  assert.doesNotMatch(inter, /hunter2/);
  assert.doesNotMatch(inter, /Begin stack/, 'non-interactive group is only in the "all" view');
});

test('C3: page_read truncates, reports it, and can read a subtree by ref', async () => {
  await reset();
  const many = Array.from({ length: 400 }, (_, i) => ({ role: R('button'), name: N('Button number ' + i), parentId: '1', backendDOMNodeId: 100 + i }));
  ax([{ role: R('RootWebArea'), name: N('Big'), childIds: many.map((_, i) => String(i + 2)), backendDOMNodeId: 1 }, ...many]);
  const r = (await cmd(sock, 'cdp.read', { tabId: T, maxChars: 500 })).result;
  assert.match(r, /truncated: \d+ more nodes/);
  assert.ok(r.length < 1200);

  ax([
    { role: R('RootWebArea'), name: N('P'), childIds: ['2', '3'], backendDOMNodeId: 1 },
    { role: R('navigation'), name: N('Menu'), parentId: '1', childIds: ['4'], backendDOMNodeId: 2 },
    { role: R('button'), name: N('Outside'), parentId: '1', backendDOMNodeId: 3 },
    { role: R('link'), name: N('Inside'), parentId: '2', backendDOMNodeId: 4 },
  ]);
  const full = (await cmd(sock, 'cdp.read', { tabId: T, filter: 'all' })).result;
  const navRef = full.match(/\[(ax\d+)\] navigation "Menu"/)[1];
  const sub = (await cmd(sock, 'cdp.read', { tabId: T, filter: 'all', refId: navRef })).result;
  assert.match(sub, /link "Inside"/);
  assert.doesNotMatch(sub, /Outside/);
  const stale = await cmd(sock, 'cdp.read', { tabId: T, refId: 'ax999' });
  assert.match(stale.error.message, /Unknown or stale ref/);
});

test('C3/C8: frames in other processes are listed, and blocked unless their site is allowlisted', async () => {
  await reset();
  ax([{ role: R('RootWebArea'), name: N('P'), childIds: [], backendDOMNodeId: 1 }]);
  await cdp.attach(T);
  fire(T, 'Target.attachedToTarget', { sessionId: 'S1', targetInfo: { targetId: 'TG1', type: 'iframe', url: 'https://sim.example/run' } });
  const r = (await cmd(sock, 'cdp.read', { tabId: T })).result;
  assert.match(r, /Separate frames:\n\s+https:\/\/sim\.example \(blocked\)/);

  const blocked = await cmd(sock, 'cdp.read', { tabId: T, frame: 'https://sim.example' });
  assert.match(blocked.error.message, /blocked.*not on the allowlist/);
  assert.ok(!sent.some((s) => s.target.sessionId === 'S1' && s.method.startsWith('Accessibility')), 'nothing read from the blocked frame');

  await core.allowOrigin('https://sim.example');
  sent.length = 0;
  const ok = await cmd(sock, 'cdp.read', { tabId: T, frame: 'https://sim.example' });
  assert.equal(ok.error, undefined);
  assert.ok(sent.some((s) => s.target.sessionId === 'S1' && s.method === 'Accessibility.getFullAXTree'), 'commands are routed to the frame session');
  const none = await cmd(sock, 'cdp.read', { tabId: T, frame: 'https://nothing.example' });
  assert.match(none.error.message, /No separate-process frame/);

  fire(T, 'Target.detachedFromTarget', { sessionId: 'S1' });
  assert.deepEqual(cdp.frames(T), []);
});

test('C8: each child frame is asked for its own children (auto-attach is not recursive)', async () => {
  await reset();
  await cdp.attach(T);
  sent.length = 0;
  fire(T, 'Target.attachedToTarget', { sessionId: 'S2', targetInfo: { targetId: 'TG2', type: 'iframe', url: 'https://x.example/' } });
  await sleep(5);
  const auto = sent.find((s) => s.method === 'Target.setAutoAttach');
  assert.equal(auto.target.sessionId, 'S2');
  assert.equal(auto.params.flatten, true);
});

// ----------------------------------------------------------------- C4 input ----

async function readWithButton() {
  ax([
    { role: R('RootWebArea'), name: N('P'), childIds: ['2'], backendDOMNodeId: 1 },
    { role: R('button'), name: N('Go'), parentId: '1', backendDOMNodeId: 77 },
  ]);
  const r = (await cmd(sock, 'cdp.read', { tabId: T })).result;
  return r.match(/\[(ax\d+)\] button "Go"/)[1];
}

test('C4: click by ref sends move, press and release at the element centre', async () => {
  await reset();
  const ref = await readWithButton();
  sent.length = 0;
  const r = await cmd(sock, 'cdp.click', { tabId: T, ref, clickCount: 2, modifiers: ['shift'] });
  assert.equal(r.error, undefined);
  const methods = sent.map((s) => s.method).filter((m) => m !== 'DOM.enable');
  assert.deepEqual(methods, ['DOM.scrollIntoViewIfNeeded', 'DOM.getBoxModel', 'Input.dispatchMouseEvent', 'Input.dispatchMouseEvent', 'Input.dispatchMouseEvent']);
  const ev = sent.filter((s) => s.method === 'Input.dispatchMouseEvent').map((s) => s.params);
  assert.deepEqual(ev.map((e) => e.type), ['mouseMoved', 'mousePressed', 'mouseReleased']);
  assert.ok(ev.every((e) => e.x === 60 && e.y === 40 && e.modifiers === 8));
  assert.equal(ev[1].button, 'left');
  assert.equal(ev[1].clickCount, 2);
});

test('C4: click by coordinates, and a clear error for a stale ref or missing target', async () => {
  await reset();
  await cmd(sock, 'cdp.read', { tabId: T });
  sent.length = 0;
  assert.equal((await cmd(sock, 'cdp.click', { tabId: T, x: 300, y: 200, button: 'right' })).error, undefined);
  const press = sent.find((s) => s.params.type === 'mousePressed').params;
  assert.deepEqual([press.x, press.y, press.button], [300, 200, 'right']);
  assert.match((await cmd(sock, 'cdp.click', { tabId: T, ref: 'ax404' })).error.message, /Unknown or stale ref/);
  assert.match((await cmd(sock, 'cdp.click', { tabId: T })).error.message, /ref from page_read, or x and y/);
});

test('C4: a page load invalidates refs', async () => {
  await reset();
  const ref = await readWithButton();
  fire(T, 'Page.frameNavigated', { frame: { id: 'F' } });
  assert.match((await cmd(sock, 'cdp.click', { tabId: T, ref })).error.message, /stale/);
});

test('C4: keys: named keys, characters, select-all commands; paste and other shortcuts are refused', async () => {
  await reset();
  sent.length = 0;
  assert.equal((await cmd(sock, 'cdp.key', { tabId: T, key: 'Enter' })).error, undefined);
  let ev = sent.filter((s) => s.method === 'Input.dispatchKeyEvent').map((s) => s.params);
  assert.deepEqual(ev.map((e) => e.type), ['keyDown', 'keyUp']);
  assert.equal(ev[0].windowsVirtualKeyCode, 13);

  sent.length = 0;
  await cmd(sock, 'cdp.key', { tabId: T, key: 'a', modifiers: ['meta'] });
  ev = sent.filter((s) => s.method === 'Input.dispatchKeyEvent').map((s) => s.params);
  assert.deepEqual(ev[0].commands, ['selectAll']);
  assert.equal(ev[0].type, 'rawKeyDown');

  sent.length = 0;
  await cmd(sock, 'cdp.key', { tabId: T, key: 'z', modifiers: ['ctrl', 'shift'] });
  assert.deepEqual(sent.find((s) => s.method === 'Input.dispatchKeyEvent').params.commands, ['redo']);

  for (const [key, modifiers] of [['v', ['ctrl']], ['V', ['meta']], ['v', ['ctrl', 'shift']], ['Paste', []], ['q', ['ctrl']], ['l', ['meta']]]) {
    sent.length = 0;
    const r = await cmd(sock, 'cdp.key', { tabId: T, key, modifiers });
    assert.ok(r.error, `${modifiers.join('+')}+${key} must be refused`);
    if (key.toLowerCase() === 'v' && !modifiers.includes('shift') || key === 'Paste') assert.match(r.error.message, /Paste is refused/, `${modifiers.join('+')}+${key}`);
    assert.equal(sent.filter((s) => s.method === 'Input.dispatchKeyEvent').length, 0, 'nothing was sent');
  }
  assert.match((await cmd(sock, 'cdp.key', { tabId: T, key: 'F13' })).error.message, /not supported/);
});

test('rule 14: key and type refuse when a password, payment, one-time-code or file field has focus', async () => {
  await reset();
  const cases = [
    fieldInfo({ tag: 'INPUT', type: 'password' }),
    fieldInfo({ tag: 'INPUT', type: 'text', autocomplete: 'cc-number' }),
    fieldInfo({ tag: 'INPUT', type: 'text', autocomplete: 'one-time-code' }),
    fieldInfo({ tag: 'INPUT', type: 'text', autocomplete: 'new-password' }),
    fieldInfo({ tag: 'INPUT', type: 'file' }),
  ];
  for (const info of cases) {
    focus.info = info;
    sent.length = 0;
    const k = await cmd(sock, 'cdp.key', { tabId: T, key: 'a' });
    const t = await cmd(sock, 'cdp.type', { tabId: T, text: 'secret' });
    assert.ok(k.error && t.error, JSON.stringify(info));
    assert.equal(sent.filter((s) => /Input\.(dispatchKeyEvent|insertText)/.test(s.method)).length, 0, 'no input reached the page: ' + JSON.stringify(info));
  }
  // The refusal also covers the focus-by-ref path.
  focus.info = fieldInfo({ tag: 'INPUT', type: 'password' });
  const ref = await readWithButton();
  const viaRef = await cmd(sock, 'cdp.type', { tabId: T, ref, text: 'x' });
  assert.match(viaRef.error.message, /password/);
});

test('rule 14: type needs a focused text control; keys may go to a page with nothing focused', async () => {
  await reset();
  focus.info = null;
  assert.match((await cmd(sock, 'cdp.type', { tabId: T, text: 'x' })).error.message, /Nothing is focused/);
  assert.equal((await cmd(sock, 'cdp.key', { tabId: T, key: 'Escape' })).error, undefined);
  focus.info = fieldInfo({ tag: 'DIV' });
  assert.match((await cmd(sock, 'cdp.type', { tabId: T, text: 'x' })).error.message, /does not accept text/);
  focus.info = fieldInfo({ tag: 'INPUT', type: 'checkbox' });
  assert.match((await cmd(sock, 'cdp.type', { tabId: T, text: 'x' })).error.message, /checkbox/);
  focus.info = fieldInfo({ tag: 'IFRAME' });
  assert.match((await cmd(sock, 'cdp.key', { tabId: T, key: 'a' })).error.message, /inside an iframe/);
  focus.info = fieldInfo({ readOnly: true });
  assert.match((await cmd(sock, 'cdp.type', { tabId: T, text: 'x' })).error.message, /read-only/);
});

test('C4: scroll sends a mouse wheel event at the ref, the point, or the viewport centre', async () => {
  await reset();
  sent.length = 0;
  assert.equal((await cmd(sock, 'cdp.scroll', { tabId: T, x: 400, y: 300, deltaY: 900 })).error, undefined);
  let w = sent.find((s) => s.params && s.params.type === 'mouseWheel').params;
  assert.deepEqual([w.x, w.y, w.deltaX, w.deltaY], [400, 300, 0, 900]);
  sent.length = 0;
  await cmd(sock, 'cdp.scroll', { tabId: T, deltaY: -99999 });
  w = sent.find((s) => s.params && s.params.type === 'mouseWheel').params;
  assert.deepEqual([w.x, w.y, w.deltaY], [700, 450, -5000], 'viewport centre, delta clamped');
  assert.match((await cmd(sock, 'cdp.scroll', { tabId: T, x: 1, y: 1 })).error.message, /non-zero/);
});

// ------------------------------------------------------------- C5 verified typing ----

test('C5: insert at the cursor and replace both report verified: true', async () => {
  await reset();
  focus.value = 'hello world';
  focus.start = focus.end = 5;
  let r = await cmd(sock, 'cdp.type', { tabId: T, text: ',' });
  assert.match(r.result, /Typed 1 characters\. verified: true/);
  assert.equal(focus.value, 'hello, world');

  r = await cmd(sock, 'cdp.type', { tabId: T, text: 'fresh start', mode: 'replace' });
  assert.match(r.result, /verified: true/);
  assert.equal(focus.value, 'fresh start');
});

test('C5: replace over stale content leaves no residue (select all first)', async () => {
  await reset();
  focus.value = 'old line 1\nold line 2\nold line 3';
  focus.start = focus.end = focus.value.length;
  sent.length = 0;
  const r = await cmd(sock, 'cdp.type', { tabId: T, text: 'new', mode: 'replace' });
  assert.equal(r.error, undefined);
  assert.equal(focus.value, 'new');
  const keyIdx = sent.findIndex((s) => s.method === 'Input.dispatchKeyEvent');
  const insIdx = sent.findIndex((s) => s.method === 'Input.insertText');
  assert.ok(keyIdx >= 0 && keyIdx < insIdx, 'select all comes before the insert');
});

test('C5: an editor that drops input is reported as a failure, never as success, without echoing the text', async () => {
  await reset();
  dropChars = 3;
  const secretText = 'SECRET-PROGRAM-TEXT';
  const r = await cmd(sock, 'cdp.type', { tabId: T, text: secretText, mode: 'replace' });
  assert.ok(r.error, 'must be an error');
  assert.match(r.error.message, /did not produce the expected result/);
  assert.match(r.error.message, /first difference at index/);
  assert.doesNotMatch(r.error.message, /SECRET/);
  assert.equal(insertCalls.length, 2, 'replace retries once, then fails');
  assert.doesNotMatch(JSON.stringify(session.data.activityLog), /SECRET/, 'typed text is not logged either');
  assert.equal(session.data.activityLog.at(-1).ok, false);

  await reset();
  dropChars = 3;
  const ins = await cmd(sock, 'cdp.type', { tabId: T, text: 'abcdef' });
  assert.ok(ins.error, 'insert mode fails on mismatch too');
  assert.equal(insertCalls.length, 1, 'no retry for insert, it would double-type');
});

test('C5: a control that cannot be read back says verified: false instead of claiming success', async () => {
  await reset();
  focus.kind = null; // readFocused returns null (a custom widget)
  const r = await cmd(sock, 'cdp.type', { tabId: T, text: 'code', mode: 'replace' });
  assert.equal(r.error, undefined);
  assert.match(r.result, /verified: false \(this control cannot be read back/);
});

test('C5: text length is capped and empty text is refused', async () => {
  await reset();
  assert.match((await cmd(sock, 'cdp.type', { tabId: T, text: 'x'.repeat(5001) })).error.message, /longer than 5000/);
  assert.match((await cmd(sock, 'cdp.type', { tabId: T, text: '' })).error.message, /must not be empty/);
});

// --------------------------------------------------------------- C6 page_eval ----

async function evalReady() {
  await reset();
  await session.set({ scriptUntil: Date.now() + 60_000 });
  await core.allowEval(SITE);
}

test('C6: page_eval is refused unless the toggle, the actions tick and the per-origin entry are all on', async () => {
  await reset();
  assert.match((await cmd(sock, 'cdp.eval', { tabId: T, expression: '1+1' })).error.message, /Script is disabled/);
  await session.set({ scriptUntil: Date.now() + 60_000 });
  assert.match((await cmd(sock, 'cdp.eval', { tabId: T, expression: '1+1' })).error.message, /Script is not enabled for https:\/\/app\.example/);
  await core.allowEval(SITE);
  await session.set({ actionsUntil: 0 });
  assert.match((await cmd(sock, 'cdp.eval', { tabId: T, expression: '1+1' })).error.message, /Actions are disabled/);
  assert.equal(sent.filter((s) => s.method === 'Runtime.evaluate').length, 0, 'nothing ran');
  await session.set({ actionsUntil: Date.now() + 60_000, scriptUntil: Date.now() - 1 });
  assert.match((await cmd(sock, 'cdp.eval', { tabId: T, expression: '1+1' })).error.message, /Script is disabled/, 'expires');
});

test('C6: script can only be enabled on allowed https sites, and removing the site removes script', async () => {
  await reset();
  assert.equal((await core.allowEval('https://unlisted.example')).ok, false);
  assert.equal((await core.allowEval('http://app.example')).ok, false);
  assert.equal((await core.allowEval(SITE)).ok, true);
  assert.deepEqual(local.data.evalOrigins, [SITE]);
  await core.removeOrigin(SITE);
  assert.deepEqual(local.data.evalOrigins, []);
});

test('C6: the expression is length-capped and cookie, storage and network APIs are refused', async () => {
  await evalReady();
  const bad = [
    'document.cookie', 'document . cookie', 'localStorage.getItem("a")', 'sessionStorage.x', 'indexedDB.open("a")',
    'fetch("https://evil.example")', 'new XMLHttpRequest()', 'new WebSocket("wss://e")', 'navigator.sendBeacon("u")',
    'eval("1")', 'new Function("return 1")()',
  ];
  for (const expression of bad) {
    const r = await cmd(sock, 'cdp.eval', { tabId: T, expression });
    assert.match(r.error.message, /not allowed in page_eval/, expression);
  }
  assert.match((await cmd(sock, 'cdp.eval', { tabId: T, expression: '1+'.repeat(1500) })).error.message, /longer than 2000/);
  assert.equal(sent.filter((s) => s.method === 'Runtime.evaluate' && s.params.timeout).length, 0, 'none of them ran');
});

test('C6: a permitted expression runs with a timeout, returns JSON, caps the result, and is logged shortened', async () => {
  await evalReady();
  const r = await cmd(sock, 'cdp.eval', { tabId: T, expression: 'window.answer' });
  assert.equal(r.error, undefined);
  assert.equal(r.result, '42');
  const run = sent.find((s) => s.method === 'Runtime.evaluate' && s.params.timeout);
  assert.equal(run.params.returnByValue, true);
  assert.equal(run.params.timeout, 5000);
  assert.equal(run.params.userGesture, false);

  userEval = () => ({ result: { value: 'x'.repeat(50000) } });
  const big = await cmd(sock, 'cdp.eval', { tabId: T, expression: 'big()' });
  assert.ok(big.result.length < 20100 && /\[truncated\]$/.test(big.result));

  userEval = () => ({ exceptionDetails: { exception: { description: 'ReferenceError: nope is not defined' } } });
  const err = await cmd(sock, 'cdp.eval', { tabId: T, expression: 'nope' });
  assert.match(err.error.message, /Script error: ReferenceError/);

  const long = 'a.' + 'b'.repeat(300);
  await cmd(sock, 'cdp.eval', { tabId: T, expression: long });
  const entry = session.data.activityLog.at(-1);
  assert.equal(entry.method, 'cdp.eval');
  assert.equal(entry.detail.length, 120);
  await cmd(sock, 'cdp.read', { tabId: T });
  assert.ok(!('detail' in session.data.activityLog.at(-1)), 'other tools log no detail');
});

// ----------------------------------------------------- C7 console and network ----

test('C7: console messages are buffered, filtered and truncated', async () => {
  await reset();
  await cdp.attach(T);
  fire(T, 'Runtime.consoleAPICalled', { type: 'log', args: [{ value: 'hello' }, { value: 5 }] });
  fire(T, 'Runtime.consoleAPICalled', { type: 'error', args: [{ description: 'TypeError: x' }] });
  fire(T, 'Log.entryAdded', { entry: { level: 'warning', text: 'y'.repeat(1000), url: 'https://app.example/a.js?token=abc' } });
  const all = (await cmd(sock, 'cdp.console', { tabId: T })).result;
  assert.match(all, /\[log\] hello 5/);
  assert.match(all, /\[error\] TypeError: x/);
  assert.ok(all.split('\n').every((l) => l.length < 320), 'long messages are cut');
  assert.equal((await cmd(sock, 'cdp.console', { tabId: T, pattern: 'typeerror' })).result, '[error] TypeError: x');
  assert.match((await cmd(sock, 'cdp.console', { tabId: T, pattern: 'zzz' })).result, /No matching/);
  for (let i = 0; i < 300; i++) fire(T, 'Runtime.consoleAPICalled', { type: 'log', args: [{ value: 'm' + i }] });
  assert.equal(cdp.getState(T).console.length, cdp.EVENT_CAP, 'buffer is bounded');
});

test('C7: page_network keeps method, origin+path, status, type and size, and nothing else', async () => {
  await reset();
  await cdp.attach(T);
  const first = (await cmd(sock, 'cdp.network', { tabId: T })).result;
  assert.match(first, /recording started just now/);
  assert.ok(sent.some((s) => s.method === 'Network.enable'));
  fire(T, 'Network.requestWillBeSent', {
    requestId: 'R1',
    type: 'XHR',
    request: { url: 'https://app.example/api/items?token=SECRETTOKEN&user=me#frag', method: 'POST', headers: { Authorization: 'Bearer SECRETHEADER', Cookie: 'sid=SECRETCOOKIE' }, postData: 'password=SECRETPOST' },
  });
  fire(T, 'Network.responseReceived', { requestId: 'R1', type: 'XHR', response: { url: 'https://app.example/api/items?token=SECRETTOKEN', status: 201, headers: { 'Set-Cookie': 'sid=SECRETSET' } } });
  fire(T, 'Network.loadingFinished', { requestId: 'R1', encodedDataLength: 1234 });
  const r = (await cmd(sock, 'cdp.network', { tabId: T })).result;
  assert.equal(r, 'POST https://app.example/api/items 201 XHR 1234B');
  assert.doesNotMatch(JSON.stringify([...cdp.getState(T).network.values()]), /SECRET|Bearer|sid=/);
  assert.match((await cmd(sock, 'cdp.network', { tabId: T, urlContains: 'nomatch' })).result, /No matching/);
  await assert.rejects(() => cdp.send(T, 'Network.getResponseBody', { requestId: 'R1' }), /not allowed/);
  assert.equal(cdp.cleanUrl('https://u:p@a.example/x?y#z'), 'https://a.example/x');
});

// ------------------------------------------------------------ C9 user control ----

test('C9: the kill switch and "stop sharing all" detach every debugger session', async () => {
  await reset();
  await cmd(sock, 'cdp.read', { tabId: T });
  assert.equal(attached.has(T), true);
  assert.deepEqual(session.data.cdpAttached, [T]);
  listeners.onCommand[0]('kill-switch');
  await waitFor(() => !attached.has(T));
  assert.equal(session.data.actionsUntil, 0);
  assert.equal(session.data.scriptUntil, 0);
  assert.equal(cdp.isAttached(T), false);

  await reset();
  await cmd(sock, 'cdp.read', { tabId: T });
  await core.stopAll(); // what the popup button calls, possibly from another context
  assert.equal(attached.has(T), false);
  await session.set({ shared: [T], actionsUntil: Date.now() + 60_000 }); // the user shares the tab again
  const again = await cmd(sock, 'cdp.read', { tabId: T }); // the worker's memory was stale: it must re-attach, not trust it
  assert.equal(again.error, undefined);
  assert.equal(attached.has(T), true, 're-attached');
  assert.deepEqual(session.data.cdpAttached, [T]);
});

test('C9: the popup Detach button message detaches one tab', async () => {
  await reset();
  await cmd(sock, 'cdp.read', { tabId: T });
  const r = await sendRuntimeMessage({ type: 'detach-debugger', tabId: T });
  assert.equal(r.ok, true);
  assert.equal(attached.has(T), false);
});

// ----------------------------------------------------------------- C10 batch ----

test('C10: a batch runs steps in order, logs each one, and returns one result per step', async () => {
  await reset();
  const ref = await readWithButton();
  session.data.activityLog.length = 0;
  const r = await cmd(sock, 'page.batch', { tabId: T, steps: [{ tool: 'click', args: { ref } }, { tool: 'key', args: { key: 'Escape' } }, { tool: 'screenshot' }, { tool: 'read' }] });
  assert.equal(r.error, undefined);
  const texts = r.result.__content.filter((c) => c.type === 'text').map((c) => c.text);
  assert.match(texts[0], /Step 1 \(click\): Clicked/);
  assert.match(texts[1], /Step 2 \(key\): Pressed Escape/);
  assert.match(texts[2], /Step 3 \(screenshot\): ok/);
  assert.ok(r.result.__content.some((c) => c.type === 'image'));
  assert.match(texts.at(-1), /All 4 steps ran/);
  assert.deepEqual(session.data.activityLog.map((e) => e.method), ['cdp.click', 'cdp.key', 'cdp.screenshot', 'cdp.read', 'page.batch']);
});

test('C10: a failing step stops the batch', async () => {
  await reset();
  focus.info = fieldInfo({ tag: 'INPUT', type: 'password' });
  sent.length = 0;
  const r = await cmd(sock, 'page.batch', { tabId: T, steps: [{ tool: 'key', args: { key: 'a' } }, { tool: 'scroll', args: { x: 1, y: 1, deltaY: 10 } }] });
  const texts = r.result.__content.map((c) => c.text);
  assert.match(texts[0], /Step 1 \(key\): ERROR .*password.*Batch stopped/);
  assert.equal(texts.length, 1, 'step 2 never ran');
  assert.equal(sent.filter((s) => s.params && s.params.type === 'mouseWheel').length, 0);
});

test('C10: more than 10 steps, unknown tools and another tab are refused', async () => {
  await reset();
  const many = Array.from({ length: 11 }, () => ({ tool: 'key', args: { key: 'a' } }));
  assert.match((await cmd(sock, 'page.batch', { tabId: T, steps: many })).error.message, /at most 10/);
  assert.match((await cmd(sock, 'page.batch', { tabId: T, steps: [] })).error.message, /must not be empty/);
  for (const tool of ['eval', 'navigate', 'open', 'batch', 'detach', 'cdp.eval']) {
    const r = await cmd(sock, 'page.batch', { tabId: T, steps: [{ tool, args: { expression: '1', url: 'https://x.example' } }] });
    assert.match(r.result.__content[0].text, /not allowed in a batch/, tool);
  }
  assert.equal(sent.filter((s) => s.method === 'Runtime.evaluate' && s.params.timeout).length, 0);
  // A step cannot redirect itself to another tab: the batch's tabId wins.
  await session.set({ shared: [T, 11] });
  sent.length = 0;
  await cmd(sock, 'page.batch', { tabId: T, steps: [{ tool: 'scroll', args: { tabId: 11, x: 1, y: 1, deltaY: 5 } }] });
  assert.ok(sent.every((s) => s.target.tabId === T));
});

test('C10: batched steps keep the same gating (actions off refuses input steps)', async () => {
  await reset({ actions: false });
  const r = await cmd(sock, 'page.batch', { tabId: T, steps: [{ tool: 'screenshot' }, { tool: 'click', args: { x: 1, y: 1 } }] });
  const texts = r.result.__content.filter((c) => c.type === 'text' && c.text.startsWith('Step')).map((c) => c.text);
  assert.match(texts[0], /Step 1 \(screenshot\): ok/);
  assert.match(texts[1], /Step 2 \(click\): ERROR Actions are disabled/);
});

// ------------------------------------------------------------ static checks ----

test('manifests: the default build has no debugger; the debugger build adds exactly that and Chrome 125', () => {
  const def = JSON.parse(fs.readFileSync(path.join(extDir, 'manifest.json'), 'utf8'));
  const dbg = JSON.parse(fs.readFileSync(path.join(extDir, 'manifest.debugger.json'), 'utf8'));
  assert.ok(!def.permissions.includes('debugger'));
  assert.ok(!(def.optional_permissions || []).includes('debugger'));
  assert.deepEqual([...dbg.permissions].sort(), ['activeTab', 'alarms', 'debugger', 'scripting', 'storage']);
  assert.equal(Number(dbg.minimum_chrome_version) >= 125, true);
  assert.equal(dbg.key, def.key, 'same extension identity');
  assert.equal(dbg.host_permissions, undefined);
  assert.equal(dbg.content_scripts, undefined);
  assert.deepEqual([...dbg.optional_host_permissions].sort(), ['http://*/*', 'https://*/*']);
  for (const bad of ['tabs', 'cookies', 'history', 'webRequest', 'downloads', 'nativeMessaging', 'clipboardRead', 'tabGroups']) {
    assert.ok(!dbg.permissions.includes(bad), bad);
  }
  const strip = (m) => ({ ...m, name: 0, description: 0, permissions: 0, minimum_chrome_version: 0 });
  assert.deepEqual(strip(dbg), strip(def), 'the two manifests differ only in name, description, permissions and minimum version');
});

test('the CDP method table has nothing that reads cookies, storage, headers or bodies', () => {
  const src = fs.readFileSync(path.join(extDir, 'cdp.js'), 'utf8');
  const table = src.match(/ALLOWED_METHODS = Object\.freeze\(\[([\s\S]*?)\]\)/)[1];
  assert.doesNotMatch(table, /Cookie|Storage|Fetch|IO\.|getResponseBody|Browser\.|Security|Emulation|navigate/i);
  assert.deepEqual(
    [...table.matchAll(/'([^']+)'/g)].map((m) => m[1]).filter((m) => m.startsWith('Network.')),
    ['Network.enable'],
  );
});
