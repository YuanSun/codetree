// Tests the extension's safety gating (background.js) against a fake Chrome API,
// plus static checks on the manifest and popup. This does NOT run in real Chrome.
// Run with: npm test

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

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
const listeners = { onMessage: [], onAdded: [], onRemoved: [], onUpdated: new Set() };
const tabs = new Map(); // id -> { title, url, dom }
const granted = new Set(); // origin match patterns the user approved
const sockets = [];

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
  close(code = 1000) {
    this.readyState = 3;
    if (this.onclose) this.onclose({ code });
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

function setGlobals(dom) {
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
}

globalThis.chrome = {
  runtime: {
    id: 'self',
    onMessage: { addListener: (f) => listeners.onMessage.push(f) },
    onStartup: { addListener() {} },
    onInstalled: { addListener() {} },
  },
  storage: { local, session, onChanged: { addListener() {} } },
  alarms: { create() {}, get: async () => null, onAlarm: { addListener() {} } },
  action: { setBadgeText: async () => {} },
  permissions: {
    onAdded: { addListener: (f) => listeners.onAdded.push(f) },
    contains: async ({ origins }) => origins.every((o) => granted.has(o)),
  },
  tabs: {
    onRemoved: { addListener: (f) => listeners.onRemoved.push(f) },
    onUpdated: {
      addListener: (f) => listeners.onUpdated.add(f),
      removeListener: (f) => listeners.onUpdated.delete(f),
    },
    get: async (id) => {
      const t = tabs.get(id);
      if (!t) throw new Error('No tab with id ' + id);
      return { id, title: t.title, url: t.url };
    },
    update: async (id, { url }) => {
      const t = tabs.get(id);
      t.url = url;
      setTimeout(() => {
        for (const f of [...listeners.onUpdated]) f(id, { status: 'complete' });
      }, 0);
      return t;
    },
  },
  scripting: {
    executeScript: async ({ target, func, args }) => {
      const t = tabs.get(target.tabId);
      setGlobals(t.dom);
      return [{ result: func(...args) }];
    },
  },
};

function addTab(id, url, body) {
  const dom = new JSDOM(`<!doctype html><title>Tab ${id}</title><body>${body}</body>`, { url });
  tabs.set(id, { title: `Tab ${id}`, url, dom });
}

const sendRuntimeMessage = (msg) =>
  new Promise((resolve) => listeners.onMessage[0](msg, { id: 'self' }, resolve));

let msgId = 0;
async function cmd(sock, method, params = {}) {
  const id = ++msgId;
  sock.receive({ id, method, params });
  return waitFor(() => sock.sent.find((m) => m.id === id));
}

// ------------------------------------------------------------------ setup ----

await import(pathToFileURL(path.join(extDir, 'background.js')).href);

addTab(1, 'https://example.com/page', '<h1>Hello</h1><button id="b">Go</button>');
addTab(2, 'https://example.org/', '<p>Other site</p>');

let sock;

after(async () => {
  await sendRuntimeMessage({ type: 'disconnect' }); // clears the ping timer so node can exit
});

test('connect sends hello with the saved token to 127.0.0.1 only', async () => {
  await local.set({ port: 4321, token: 'tok-123' });
  await sendRuntimeMessage({ type: 'connect' });
  sock = sockets.at(-1);
  assert.equal(sock.url, 'ws://127.0.0.1:4321');
  sock.open();
  assert.deepEqual(
    { type: sock.sent[0].type, token: sock.sent[0].token },
    { type: 'hello', token: 'tok-123' },
  );
  sock.receive({ type: 'ready' });
  await waitFor(() => session.data.status === 'connected');
});

test('ignores runtime messages from other extensions', () => {
  const handled = listeners.onMessage[0]({ type: 'connect' }, { id: 'someone-else' }, () => {});
  assert.equal(handled, false);
});

test('an unshared tab cannot be read', async () => {
  const r = await cmd(sock, 'page.snapshot', { tabId: 1 });
  assert.match(r.error.message, /not shared/i);
});

test('a shared tab without Chrome site approval cannot be read', async () => {
  await session.set({ shared: [1] });
  const r = await cmd(sock, 'page.snapshot', { tabId: 1 });
  assert.match(r.error.message, /no access/i);
});

test('a shared, approved tab can be read', async () => {
  granted.add('https://example.com/*');
  const r = await cmd(sock, 'page.snapshot', { tabId: 1, maxChars: 2000 });
  assert.equal(r.error, undefined);
  assert.match(r.result, /Title: Tab 1/);
  assert.match(r.result, /Hello/);
  assert.match(r.result, /button "Go"/);
});

test('actions are refused unless the user switched them on, and expire', async () => {
  const snap = await cmd(sock, 'page.snapshot', { tabId: 1 });
  const ref = snap.result.match(/\[(e\d+)\] button "Go"/)[1];

  let r = await cmd(sock, 'page.click', { tabId: 1, ref });
  assert.match(r.error.message, /Actions are disabled/);

  await session.set({ actionsUntil: Date.now() + 60_000 });
  r = await cmd(sock, 'page.click', { tabId: 1, ref });
  assert.equal(r.error, undefined);
  assert.match(r.result, /Clicked/);

  await session.set({ actionsUntil: Date.now() - 1 });
  r = await cmd(sock, 'page.click', { tabId: 1, ref });
  assert.match(r.error.message, /Actions are disabled/);
});

test('actions still need the tab to be shared', async () => {
  await session.set({ actionsUntil: Date.now() + 60_000 });
  const r = await cmd(sock, 'page.scroll', { tabId: 2, direction: 'down' });
  assert.match(r.error.message, /not shared/i);
});

test('navigate only allows http(s) and loses read access on unapproved sites', async () => {
  await session.set({ actionsUntil: Date.now() + 60_000 });
  for (const url of ['javascript:alert(1)', 'file:///etc/passwd', 'chrome://settings', 'data:text/html,hi']) {
    const r = await cmd(sock, 'page.navigate', { tabId: 1, url });
    assert.match(r.error.message, /Only http and https/, url);
  }
  assert.equal(tabs.get(1).url, 'https://example.com/page', 'tab must not have moved');

  const ok = await cmd(sock, 'page.navigate', { tabId: 1, url: 'https://unapproved.example/' });
  assert.equal(ok.error, undefined);
  assert.equal(tabs.get(1).url, 'https://unapproved.example/');

  const after = await cmd(sock, 'page.snapshot', { tabId: 1 });
  assert.match(after.error.message, /no access/i, 'new site was never approved by the user');
});

test('tabs.list returns shared tabs and drops closed ones', async () => {
  tabs.get(1).url = 'https://example.com/page';
  await session.set({ shared: [1, 99], actionsUntil: 0 });
  const r = await cmd(sock, 'tabs.list');
  assert.equal(r.result.actionsEnabled, false);
  assert.deepEqual(r.result.sharedTabs.map((t) => t.tabId), [1]);
  assert.deepEqual(session.data.shared, [1]);
});

test('closing a tab unshares it', async () => {
  await session.set({ shared: [1, 2] });
  listeners.onRemoved[0](2);
  await waitFor(() => session.data.shared.length === 1);
  assert.deepEqual(session.data.shared, [1]);
});

test('a permission grant completes a pending share only for the matching site', async () => {
  await session.set({ shared: [], pendingShare: { tabId: 2, origin: 'https://example.org' } });
  await listeners.onAdded[0]({ origins: ['https://unrelated.example/*'] });
  assert.deepEqual(session.data.shared, []);
  await listeners.onAdded[0]({ origins: ['https://example.org/*'] });
  assert.deepEqual(session.data.shared, [2]);
  assert.equal(session.data.pendingShare, undefined);
});

test('unknown methods are rejected', async () => {
  const r = await cmd(sock, 'cookies.getAll', {});
  assert.match(r.error.message, /Unknown method/);
});

test('a rejected token is reported', async () => {
  sock.close(1008);
  await waitFor(() => /rejected/.test(session.data.status));
});

test('disconnect closes the socket and turns auto-reconnect off', async () => {
  await sendRuntimeMessage({ type: 'connect' });
  const s2 = sockets.at(-1);
  s2.open();
  s2.receive({ type: 'ready' });
  await sendRuntimeMessage({ type: 'disconnect' });
  assert.equal(s2.readyState, 3);
  assert.equal(local.data.enabled, false);
  assert.equal(session.data.status, 'disconnected');
});

// ---------------------------------------------------------- static checks ----

test('manifest requests only the intended permissions', () => {
  const m = JSON.parse(fs.readFileSync(path.join(extDir, 'manifest.json'), 'utf8'));
  assert.equal(m.manifest_version, 3);
  assert.deepEqual([...m.permissions].sort(), ['activeTab', 'alarms', 'scripting', 'storage']);
  for (const bad of ['tabs', 'cookies', 'debugger', 'history', 'webRequest', 'downloads', 'nativeMessaging', 'clipboardRead']) {
    assert.ok(!m.permissions.includes(bad), `${bad} must not be requested`);
  }
  assert.equal(m.host_permissions, undefined, 'no always-on host access');
  assert.equal(m.content_scripts, undefined, 'no content scripts on every page');
  assert.deepEqual([...m.optional_host_permissions].sort(), ['http://*/*', 'https://*/*']);
  assert.ok(fs.existsSync(path.join(extDir, m.background.service_worker)));
  assert.ok(fs.existsSync(path.join(extDir, m.action.default_popup)));
});

test('popup.js only references element ids that exist in popup.html', () => {
  const js = fs.readFileSync(path.join(extDir, 'popup.js'), 'utf8');
  const html = fs.readFileSync(path.join(extDir, 'popup.html'), 'utf8');
  const ids = new Set([...js.matchAll(/\$\('([^']+)'\)/g)].map((m) => m[1]));
  assert.ok(ids.size > 5);
  for (const id of ids) assert.ok(html.includes(`id="${id}"`), `popup.html is missing id="${id}"`);
  assert.ok(html.includes('src="popup.js"'));
  assert.ok(!/<script(?![^>]*src=)[^>]*>/i.test(html), 'MV3 forbids inline scripts');
});

test('all extension scripts parse as ES modules', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-syntax-'));
  try {
    for (const f of ['background.js', 'popup.js', 'page_fns.js']) {
      const copy = path.join(tmp, f.replace(/\.js$/, '.mjs'));
      fs.copyFileSync(path.join(extDir, f), copy);
      execFileSync(process.execPath, ['--check', copy]);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
