// Tests the extension's safety gating (background.js) against a fake Chrome API,
// plus static checks on the manifest and popup. This does NOT run in real Chrome.
// Run with: npm test

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const core = await import(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'extension', 'core.js')).href);

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
const listeners = { onMessage: [], onAdded: [], onRemoved: [], onUpdated: new Set(), onCommand: [] };
const redirects = new Map(); // url -> url a newly created tab ends up on
let nextTabId = 100;
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
  action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
  commands: { onCommand: { addListener: (f) => listeners.onCommand.push(f) } },
  permissions: {
    onAdded: { addListener: (f) => listeners.onAdded.push(f) },
    contains: async ({ origins }) => origins.every((o) => granted.has(o)),
    remove: async ({ origins }) => {
      for (const o of origins) granted.delete(o);
      return true;
    },
    getAll: async () => ({ origins: [...granted] }),
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
      return { id, title: t.title, url: t.url, status: 'complete' };
    },
    create: async ({ url, active }) => {
      const id = nextTabId++;
      addTab(id, redirects.get(url) || url, '<p>New tab</p>');
      tabs.get(id).active = active;
      return { id, url, status: 'loading' };
    },
    goBack: async (id) => {
      const t = tabs.get(id);
      if (!t.history || !t.history.length) throw new Error('Cannot find a next page in history.');
      t.url = t.history.pop();
      setTimeout(() => {
        for (const f of [...listeners.onUpdated]) f(id, { status: 'complete' });
      }, 0);
    },
    remove: async (id) => {
      tabs.delete(id);
      for (const f of listeners.onRemoved) f(id);
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
addTab(3, 'https://jobs.example/', '<input id="q" type="text" aria-label="Query"><a href="/job/1?trk=x">Staff Engineer</a><a href="/job/1?trk=y">Staff Engineer</a><a href="mailto:a@b.c">Mail</a>');

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

test('actions with no expiry stay on, show as such in tabs_list, and stop with the kill switch', async () => {
  tabs.get(1).url = 'https://example.com/page';
  granted.add('https://example.com/*');
  await session.set({ shared: [1], actionsUntil: core.actionsUntilFor(true) });
  const list = await cmd(sock, 'tabs.list');
  assert.equal(list.result.actionsEnabled, true);
  assert.equal(list.result.actionsNoExpiry, true);
  assert.equal(list.result.actionsSecondsLeft, null);
  const snap = await cmd(sock, 'page.snapshot', { tabId: 1 });
  const ref = snap.result.match(/\[(e\d+)\] button "Go"/)[1];
  assert.equal((await cmd(sock, 'page.click', { tabId: 1, ref })).error, undefined);

  await core.stopAll();
  assert.equal(session.data.actionsUntil, 0);
  assert.match((await cmd(sock, 'page.click', { tabId: 1, ref })).error.message, /Actions are disabled/);
  // The default is still a 10-minute window.
  const t0 = Date.now();
  const timed = core.actionsUntilFor(false);
  assert.ok(timed > t0 + 9 * 60_000 && timed <= t0 + 10 * 60_000 + 50);
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

// ------------------------------------------------- v0.2: allowlist and tabs ----

async function reset() {
  await session.set({ shared: [], agentTabs: [], actionsUntil: 0, activityLog: [] });
  await local.set({ allowedOrigins: [] });
  granted.clear();
  redirects.clear();
  for (const id of [...tabs.keys()]) if (id >= 100) tabs.delete(id);
}

test('only https, non-sign-in origins can be allowlisted', async () => {
  await reset();
  assert.equal(core.checkAllowable('http://jobs.example/').ok, false);
  assert.match(core.checkAllowable('http://jobs.example/').error, /https/);
  assert.equal(core.checkAllowable('https://accounts.google.com/').ok, false);
  assert.equal(core.checkAllowable('file:///etc/passwd').ok, false);
  assert.equal((await core.allowOrigin('https://accounts.google.com')).ok, false);
  assert.equal((await core.allowOrigin('http://jobs.example')).ok, false);
  assert.deepEqual(local.data.allowedOrigins, []);

  const r = await core.allowOrigin('https://jobs.example/some/path');
  assert.equal(r.origin, 'https://jobs.example');
  await core.allowOrigin('https://jobs.example');
  assert.deepEqual(local.data.allowedOrigins, ['https://jobs.example'], 'exact origin, no duplicates');
});

test('page_open refuses sites that are not allowlisted, http, and sign-in sites', async () => {
  await reset();
  granted.add('https://jobs.example/*');
  for (const url of ['https://jobs.example/', 'http://jobs.example/', 'https://accounts.google.com/']) {
    const r = await cmd(sock, 'page.open', { url });
    assert.ok(r.error, url);
  }
  assert.match((await cmd(sock, 'page.open', { url: 'https://jobs.example/' })).error.message, /allowlist/);
  assert.equal([...tabs.keys()].filter((id) => id >= 100).length, 0, 'no tab may have been created');
});

test('page_open on an allowlisted site opens an inactive, shared tab without the actions tick', async () => {
  await reset();
  await core.allowOrigin('https://jobs.example');
  granted.add('https://jobs.example/*');
  const r = await cmd(sock, 'page.open', { url: 'https://jobs.example/search' });
  assert.equal(r.error, undefined);
  const id = r.result.tabId;
  assert.equal(tabs.get(id).active, false);
  assert.deepEqual(session.data.shared, [id]);
  assert.deepEqual(session.data.agentTabs, [id]);
  const snap = await cmd(sock, 'page.snapshot', { tabId: id });
  assert.match(snap.result, /New tab/);
  const list = await cmd(sock, 'tabs.list');
  assert.equal(list.result.sharedTabs[0].openedByAgent, true);
});

test('page_open without Chrome permission is refused even if allowlisted', async () => {
  await reset();
  await core.allowOrigin('https://jobs.example');
  const r = await cmd(sock, 'page.open', { url: 'https://jobs.example/' });
  assert.match(r.error.message, /no longer grants access/);
});

test('page_open enforces the cap on agent-opened tabs', async () => {
  await reset();
  await core.allowOrigin('https://jobs.example');
  granted.add('https://jobs.example/*');
  for (let i = 0; i < core.MAX_AGENT_TABS; i++) {
    assert.equal((await cmd(sock, 'page.open', { url: `https://jobs.example/${i}` })).error, undefined);
  }
  const r = await cmd(sock, 'page.open', { url: 'https://jobs.example/extra' });
  assert.match(r.error.message, /Too many tabs/);
  assert.equal(session.data.agentTabs.length, core.MAX_AGENT_TABS);
});

test('page_open closes a tab that redirects to a site that is not allowlisted', async () => {
  await reset();
  await core.allowOrigin('https://jobs.example');
  granted.add('https://jobs.example/*');
  redirects.set('https://jobs.example/go', 'https://elsewhere.example/');
  const r = await cmd(sock, 'page.open', { url: 'https://jobs.example/go' });
  assert.match(r.error.message, /redirected/);
  assert.deepEqual(session.data.shared, []);
  assert.deepEqual(session.data.agentTabs, []);
  assert.equal([...tabs.keys()].filter((id) => id >= 100).length, 0);
});

test('page_close only closes tabs the agent opened', async () => {
  await reset();
  await core.allowOrigin('https://jobs.example');
  granted.add('https://jobs.example/*');
  granted.add('https://example.com/*');
  await session.set({ shared: [1] }); // user-shared
  assert.match((await cmd(sock, 'page.close', { tabId: 1 })).error.message, /only closes tabs that page_open created/);
  assert.ok(tabs.has(1));

  const id = (await cmd(sock, 'page.open', { url: 'https://jobs.example/' })).result.tabId;
  const r = await cmd(sock, 'page.close', { tabId: id });
  assert.equal(r.error, undefined);
  assert.equal(tabs.has(id), false);
  assert.deepEqual(session.data.shared, [1]);
  assert.deepEqual(session.data.agentTabs, []);
});

test('closing an agent tab by hand cleans its state', async () => {
  await reset();
  await session.set({ shared: [7, 8], agentTabs: [7] });
  listeners.onRemoved[0](7);
  await waitFor(() => session.data.shared.length === 1);
  assert.deepEqual(session.data.shared, [8]);
  assert.deepEqual(session.data.agentTabs, []);
});

test('an agent tab that navigates off the allowlist loses read access', async () => {
  await reset();
  await core.allowOrigin('https://jobs.example');
  granted.add('https://jobs.example/*');
  const id = (await cmd(sock, 'page.open', { url: 'https://jobs.example/' })).result.tabId;
  await session.set({ actionsUntil: Date.now() + 60_000 });
  const nav = await cmd(sock, 'page.navigate', { tabId: id, url: 'https://other.example/' });
  assert.equal(nav.error, undefined);
  assert.match((await cmd(sock, 'page.snapshot', { tabId: id })).error.message, /no access/i);
});

test('removing an allowed site unshares its tabs, closes agent tabs and drops the permission', async () => {
  await reset();
  await core.allowOrigin('https://jobs.example');
  granted.add('https://jobs.example/*');
  const agentId = (await cmd(sock, 'page.open', { url: 'https://jobs.example/' })).result.tabId;
  await session.set({ shared: [...session.data.shared, 3] }); // tab 3 is a user-shared jobs.example tab
  await core.removeOrigin('https://jobs.example');
  assert.deepEqual(local.data.allowedOrigins, []);
  assert.deepEqual(session.data.shared, []);
  assert.equal(tabs.has(agentId), false, 'agent tab closed');
  assert.ok(tabs.has(3), 'a tab the user opened stays open');
  assert.equal(granted.has('https://jobs.example/*'), false);
});

test('unsharing keeps the permission for allowlisted sites and drops it otherwise', async () => {
  await reset();
  await core.allowOrigin('https://jobs.example');
  granted.add('https://jobs.example/*');
  granted.add('https://example.com/*');
  await session.set({ shared: [1, 3] });
  await core.unshareTab(3);
  assert.equal(granted.has('https://jobs.example/*'), true);
  await core.unshareTab(1);
  assert.equal(granted.has('https://example.com/*'), false);
});

test('stop sharing all keeps the allowlist and its permissions, drops the rest', async () => {
  await reset();
  await core.allowOrigin('https://jobs.example');
  granted.add('https://jobs.example/*');
  granted.add('https://example.com/*');
  const agentId = (await cmd(sock, 'page.open', { url: 'https://jobs.example/' })).result.tabId;
  await session.set({ shared: [...session.data.shared, 1], actionsUntil: Date.now() + 60_000 });
  await core.stopAll();
  assert.deepEqual(session.data.shared, []);
  assert.equal(session.data.actionsUntil, 0);
  assert.equal(tabs.has(agentId), false);
  assert.deepEqual(local.data.allowedOrigins, ['https://jobs.example']);
  assert.equal(granted.has('https://jobs.example/*'), true);
  assert.equal(granted.has('https://example.com/*'), false);
});

test('the kill switch command stops everything', async () => {
  await reset();
  granted.add('https://example.com/*');
  await session.set({ shared: [1], actionsUntil: Date.now() + 60_000 });
  listeners.onCommand[0]('some-other-command');
  await sleep(20);
  assert.deepEqual(session.data.shared, [1], 'other commands do nothing');
  listeners.onCommand[0]('kill-switch');
  await waitFor(() => session.data.shared.length === 0);
  assert.equal(session.data.actionsUntil, 0);
});

test('a permission grant completes a pending allow only for the matching site', async () => {
  await reset();
  await session.set({ pendingAllow: { origin: 'https://jobs.example' } });
  await listeners.onAdded[0]({ origins: ['https://unrelated.example/*'] });
  assert.deepEqual(local.data.allowedOrigins, []);
  await listeners.onAdded[0]({ origins: ['https://jobs.example/*'] });
  assert.deepEqual(local.data.allowedOrigins, ['https://jobs.example']);
  assert.equal(session.data.pendingAllow, undefined);
  // The same completion path still refuses a sign-in site.
  await session.set({ pendingAllow: { origin: 'https://accounts.google.com' } });
  await listeners.onAdded[0]({ origins: ['https://accounts.google.com/*'] });
  assert.deepEqual(local.data.allowedOrigins, ['https://jobs.example']);
});

test('page_links is read-only, dedupes, strips queries and skips mailto links', async () => {
  await reset();
  granted.add('https://jobs.example/*');
  await session.set({ shared: [3] });
  const r = await cmd(sock, 'page.links', { tabId: 3, stripQuery: true });
  assert.equal(r.error, undefined);
  assert.match(r.result, /Staff Engineer → https:\/\/jobs\.example\/job\/1\n?/);
  assert.doesNotMatch(r.result, /mailto|trk=/);
  const unshared = await cmd(sock, 'page.links', { tabId: 1 });
  assert.match(unshared.error.message, /not shared/);
});

test('the activity log records outcomes but never typed text or full URLs', async () => {
  await reset();
  granted.add('https://jobs.example/*');
  await session.set({ shared: [3], actionsUntil: Date.now() + 60_000 });
  const snap = await cmd(sock, 'page.snapshot', { tabId: 3 });
  const ref = snap.result.match(/\[(e\d+)\] input "Query"/)[1];
  await cmd(sock, 'page.type', { tabId: 3, ref, text: 'SECRET-TYPED-TEXT-123' });
  await cmd(sock, 'page.navigate', { tabId: 3, url: 'file:///etc/passwd' });
  await cmd(sock, 'page.snapshot', { tabId: 2 }); // not shared: failure

  const log = session.data.activityLog;
  assert.deepEqual(log.map((e) => [e.method, e.ok]), [
    ['page.snapshot', true],
    ['page.type', true],
    ['page.navigate', false],
    ['page.snapshot', false],
  ]);
  assert.equal(log[0].origin, 'https://jobs.example');
  assert.equal(log[0].tabId, 3);
  assert.match(log[3].error, /not shared/);
  const dump = JSON.stringify(log);
  assert.doesNotMatch(dump, /SECRET-TYPED-TEXT-123/);
  assert.doesNotMatch(dump, /passwd|\/job\/|trk=/);
  assert.deepEqual(Object.keys(log[0]).sort(), ['error', 'method', 'ok', 'origin', 't', 'tabId']);
});

test('the activity log keeps only the last 100 entries and can be cleared', async () => {
  await reset();
  for (let i = 0; i < 130; i++) await core.logActivity({ method: 'm' + i, ok: true });
  assert.equal(session.data.activityLog.length, 100);
  assert.equal(session.data.activityLog[0].method, 'm30');
  assert.equal(session.data.activityLog.at(-1).method, 'm129');
  await core.clearLog();
  assert.deepEqual(await core.getLog(), []);
});

test('page_wait_for finds text that is already there or appears later, and times out otherwise', async () => {
  await reset();
  granted.add('https://example.com/*');
  await session.set({ shared: [1] });
  const dom = tabs.get(1).dom;

  let r = await cmd(sock, 'page.wait_for', { tabId: 1, text: 'hello' }); // matches "Hello", case-insensitive
  assert.match(r.result, /appeared/);

  setTimeout(() => dom.window.document.body.insertAdjacentHTML('beforeend', '<p>Results loaded</p>'), 300);
  const t0 = Date.now();
  r = await cmd(sock, 'page.wait_for', { tabId: 1, text: 'results loaded', timeoutMs: 3000 });
  assert.match(r.result, /appeared/);
  assert.ok(Date.now() - t0 >= 250 && Date.now() - t0 < 2500, 'returns soon after the text shows up');

  r = await cmd(sock, 'page.wait_for', { tabId: 1, text: 'never-there-xyz', timeoutMs: 100 });
  assert.equal(r.error, undefined);
  assert.match(r.result, /did not appear within 100 ms/);
});

test('page_wait_for needs a shared tab, site access and non-empty text, and ignores the actions tick', async () => {
  await reset();
  assert.match((await cmd(sock, 'page.wait_for', { tabId: 1, text: 'x', timeoutMs: 100 })).error.message, /not shared/);
  await session.set({ shared: [1] });
  assert.match((await cmd(sock, 'page.wait_for', { tabId: 1, text: 'x', timeoutMs: 100 })).error.message, /no access/i);
  granted.add('https://example.com/*');
  assert.match((await cmd(sock, 'page.wait_for', { tabId: 1, text: '' })).error.message, /must not be empty/);
  assert.equal((await cmd(sock, 'page.wait_for', { tabId: 1, text: 'hello', timeoutMs: 100 })).error, undefined);
  assert.equal(session.data.actionsUntil, 0, 'read-only, no actions tick was needed');
});

test('page_wait_for stops reading when the tab leaves an approved site mid-wait', async () => {
  await reset();
  granted.add('https://example.com/*');
  await session.set({ shared: [1] });
  setTimeout(() => (tabs.get(1).url = 'https://unapproved.example/'), 150);
  const r = await cmd(sock, 'page.wait_for', { tabId: 1, text: 'never-there-xyz', timeoutMs: 3000 });
  assert.match(r.error.message, /no access/i);
  tabs.get(1).url = 'https://example.com/page';
});

test('page_back needs actions and a shared tab, goes back, and reports an empty history', async () => {
  await reset();
  granted.add('https://example.com/*');
  await session.set({ shared: [1] });
  tabs.get(1).history = ['https://example.com/earlier'];
  assert.match((await cmd(sock, 'page.back', { tabId: 1 })).error.message, /Actions are disabled/);
  assert.equal(tabs.get(1).url, 'https://example.com/page', 'must not have moved');

  await session.set({ actionsUntil: Date.now() + 60_000 });
  assert.match((await cmd(sock, 'page.back', { tabId: 2 })).error.message, /not shared/);
  const r = await cmd(sock, 'page.back', { tabId: 1 });
  assert.equal(r.error, undefined);
  assert.equal(tabs.get(1).url, 'https://example.com/earlier');
  assert.match((await cmd(sock, 'page.back', { tabId: 1 })).error.message, /no earlier page/);
  tabs.get(1).url = 'https://example.com/page';
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
  assert.deepEqual(Object.keys(m.commands), ['kill-switch']);
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
    for (const f of ['background.js', 'popup.js', 'page_fns.js', 'core.js']) {
      const copy = path.join(tmp, f.replace(/\.js$/, '.mjs'));
      fs.copyFileSync(path.join(extDir, f), copy);
      execFileSync(process.execPath, ['--check', copy]);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('manifest pins the extension identity with a key that maps to a valid ID', () => {
  const m = JSON.parse(fs.readFileSync(path.join(extDir, 'manifest.json'), 'utf8'));
  assert.ok(m.key && m.key.length > 300, 'manifest needs a "key"');
  const der = Buffer.from(m.key, 'base64');
  const id = [...crypto.createHash('sha256').update(der).digest().subarray(0, 16)]
    .map((b) => 'abcdefghijklmnop'[b >> 4] + 'abcdefghijklmnop'[b & 15])
    .join('');
  assert.match(id, /^[a-p]{32}$/);
  const readme = fs.readFileSync(path.join(extDir, '..', 'README.md'), 'utf8');
  assert.ok(readme.includes(id), 'README must document the pinned extension ID ' + id);
});

test('manifest, package.json and the extension code agree on the version', () => {
  const m = JSON.parse(fs.readFileSync(path.join(extDir, 'manifest.json'), 'utf8'));
  const p = JSON.parse(fs.readFileSync(path.join(extDir, '..', 'server', 'package.json'), 'utf8'));
  assert.equal(m.version, p.version);
  assert.match(fs.readFileSync(path.join(extDir, 'background.js'), 'utf8'), new RegExp(`VERSION = '${m.version}'`));
});

test('the sign-in denylist and https-only rule are enforced in the one shared place', () => {
  for (const o of ['https://accounts.google.com', 'https://login.microsoftonline.com', 'https://appleid.apple.com']) {
    assert.ok(core.DENYLIST.includes(o), o);
  }
});
