// Tests the functions the extension injects into pages, using jsdom.
// Run with: npm test

import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import * as fns from '../../extension/page_fns.js';

// Chrome serializes injected functions with toString(), so they must not rely
// on anything outside their own body. Rebuilding them from source in a fresh
// scope proves that, and guards against future edits breaking it.
function detached(fn) {
  return new Function('return ' + fn.toString())();
}
const snapshotFn = detached(fns.snapshotFn);
const clickFn = detached(fns.clickFn);
const typeFn = detached(fns.typeFn);
const scrollFn = detached(fns.scrollFn);
const linksFn = detached(fns.linksFn);
const containsTextFn = detached(fns.containsTextFn);

function loadPage(html) {
  const dom = new JSDOM(html, { url: 'https://example.com/start', pretendToBeVisual: true });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  return dom;
}

const PAGE = `<!doctype html><html><head><title>Test page</title></head><body>
  <h1>Welcome</h1>
  <p>Some visible text.</p>
  <a href="/jobs" id="jobs">Jobs</a>
  <a href="javascript:alert(1)" id="js">Bad link</a>
  <button id="go">Search</button>
  <button id="off" disabled>Disabled</button>
  <label for="q">Search box</label><input id="q" type="text" value="hello">
  <input id="pw" type="password" value="secret123" aria-label="Password">
  <input id="cc" type="text" autocomplete="cc-number" aria-label="Card">
  <input id="cb" type="checkbox" aria-label="Agree">
  <input id="file" type="file" aria-label="Upload">
  <input id="hid" type="hidden" value="x">
  <textarea id="msg" aria-label="Message"></textarea>
  <select id="sel" aria-label="Sort"><option>New</option><option selected>Old</option></select>
  <div style="display:none"><button id="hiddenbtn">Hidden button</button></div>
  <form id="f"><input id="fq" type="text" aria-label="Form field"><button type="submit">Send</button></form>
</body></html>`;

function refOf(text, label) {
  const m = text.match(new RegExp(`\\[(e\\d+)\\][^\\n]*"${label}"`));
  assert.ok(m, `no element labelled ${label} in snapshot:\n${text}`);
  return m[1];
}

test('snapshot reports title, URL, text and visible interactive elements', () => {
  loadPage(PAGE);
  const r = snapshotFn(8000);
  assert.equal(r.ok, true);
  const t = r.value;
  assert.match(t, /Title: Test page/);
  assert.match(t, /URL: https:\/\/example\.com\/start/);
  assert.match(t, /Some visible text\./);
  assert.match(t, /link "Jobs" → https:\/\/example\.com\/jobs/);
  assert.match(t, /button "Search"/);
  assert.match(t, /input "Search box" \(type=text\) value="hello"/);
  assert.match(t, /checkbox "Agree" \[unchecked\]/);
  assert.match(t, /select "Sort" value="Old"/);
  assert.match(t, /button "Disabled" \[disabled\]/);
});

test('snapshot hides display:none elements and hidden inputs', () => {
  loadPage(PAGE);
  const t = snapshotFn(8000).value;
  // jsdom has no layout engine, so innerText is unavailable and the page-text
  // part may still contain hidden text here. Check the element list instead.
  const list = t.split('--- Interactive elements')[1];
  assert.doesNotMatch(list, /Hidden button/);
  assert.doesNotMatch(list, /type=hidden/);
});

test('snapshot never prints password field values', () => {
  loadPage(PAGE);
  const t = snapshotFn(8000).value;
  assert.match(t, /input "Password" \(type=password\)/);
  assert.doesNotMatch(t, /secret123/);
});

test('snapshot truncates long page text and caps the element list', () => {
  const many = Array.from({ length: 200 }, (_, i) => `<a href="/p${i}">Link ${i}</a>`).join('');
  loadPage(`<!doctype html><title>Big</title><body><p>${'x'.repeat(20000)}</p>${many}</body>`);
  const r = snapshotFn(600);
  assert.equal(r.ok, true);
  assert.match(r.value, /truncated to 600/);
  assert.match(r.value, /150 shown of 200/);
  assert.ok(r.value.length < 600 + 150 * 140 + 500);
});

test('click triggers the element and refs go stale after a new snapshot', () => {
  loadPage(PAGE);
  let clicks = 0;
  document.getElementById('go').addEventListener('click', () => clicks++);
  const first = snapshotFn(8000).value;
  const ref = refOf(first, 'Search');
  const ok = clickFn(ref);
  assert.equal(ok.ok, true);
  assert.equal(clicks, 1);

  // A new snapshot replaces the ref table. Removing the element makes the old ref stale.
  document.getElementById('go').remove();
  const stale = clickFn(ref);
  assert.equal(stale.ok, false);
  assert.match(stale.error, /stale|Unknown/i);
});

test('click refuses disabled elements, javascript: links and file choosers', () => {
  loadPage(PAGE);
  const t = snapshotFn(8000).value;
  assert.match(clickFn(refOf(t, 'Disabled')).error, /disabled/i);
  assert.match(clickFn(refOf(t, 'Bad link')).error, /javascript/i);
  assert.match(clickFn(refOf(t, 'Upload')).error, /file chooser/i);
  assert.match(clickFn('e9999').error, /Unknown or stale/);
});

test('type sets the value with input and change events', () => {
  loadPage(PAGE);
  const q = document.getElementById('q');
  const events = [];
  q.addEventListener('input', () => events.push('input'));
  q.addEventListener('change', () => events.push('change'));
  const t = snapshotFn(8000).value;
  const r = typeFn(refOf(t, 'Search box'), 'new text', false);
  assert.equal(r.ok, true);
  assert.equal(q.value, 'new text');
  assert.deepEqual(events, ['input', 'change']);

  const t2 = snapshotFn(8000).value;
  assert.equal(typeFn(refOf(t2, 'Message'), 'hello there', false).ok, true);
  assert.equal(document.getElementById('msg').value, 'hello there');
});

test('type refuses password, payment and non-text fields and leaves values untouched', () => {
  loadPage(PAGE);
  const t = snapshotFn(8000).value;
  const pw = typeFn(refOf(t, 'Password'), 'hunter2', false);
  assert.equal(pw.ok, false);
  assert.match(pw.error, /password/i);
  assert.equal(document.getElementById('pw').value, 'secret123');

  assert.match(typeFn(refOf(t, 'Card'), '4111111111111111', false).error, /payment|one-time|password/i);
  assert.equal(document.getElementById('cc').value, '');
  assert.match(typeFn(refOf(t, 'Agree'), 'x', false).error, /checkbox/i);
  assert.match(typeFn(refOf(t, 'Upload'), 'x', false).error, /file/i);
});

test('type with submit requests form submission', () => {
  loadPage(PAGE);
  let submitted = 0;
  document.getElementById('f').addEventListener('submit', (e) => {
    e.preventDefault();
    submitted++;
  });
  const t = snapshotFn(8000).value;
  const r = typeFn(refOf(t, 'Form field'), 'abc', true);
  assert.equal(r.ok, true);
  assert.equal(document.getElementById('fq').value, 'abc');
  assert.equal(submitted, 1);
});

test('scroll validates the direction and calls the window scroll APIs', () => {
  loadPage(PAGE);
  const calls = [];
  window.scrollBy = (x, y) => calls.push(['by', x, y]);
  window.scrollTo = (x, y) => calls.push(['to', x, y]);
  assert.equal(scrollFn('down').ok, true);
  assert.equal(scrollFn('top').ok, true);
  assert.equal(scrollFn('bottom').ok, true);
  assert.equal(scrollFn('sideways').ok, false);
  assert.equal(calls.length, 3);
  assert.equal(calls[0][0], 'by');
});

test('every injected function returns a result object instead of throwing', () => {
  // No DOM at all: the functions must catch their own errors.
  delete globalThis.window;
  delete globalThis.document;
  for (const r of [snapshotFn(1000), linksFn('', 10, false), containsTextFn('x'), clickFn('e1'), typeFn('e1', 'x', false), scrollFn('down'), scrollFn('down', 'e1')]) {
    assert.equal(r.ok, false);
    assert.equal(typeof r.error, 'string');
  }
});

// ------------------------------------------------------------------ v0.2 ----

// jsdom has no layout, so give an element a scroll geometry by hand.
function makeScrollable(el, { height = 1000, view = 200, top = 0 } = {}) {
  let t = top;
  Object.defineProperty(el, 'scrollHeight', { get: () => height, configurable: true });
  Object.defineProperty(el, 'clientHeight', { get: () => view, configurable: true });
  Object.defineProperty(el, 'scrollTop', {
    get: () => t,
    set: (v) => {
      t = Math.max(0, Math.min(height - view, v));
    },
    configurable: true,
  });
}

const PANEL = `<!doctype html><title>Jobs</title><body>
  <div id="panel" aria-label="Results" style="overflow-y:auto">
    <ul><li><a href="/jobs/view/1?trk=a" id="card1">Staff Engineer, Acme</a></li>
        <li><a href="/jobs/view/2?trk=b">Principal Engineer, Globex</a></li></ul>
  </div>
  <div id="plain">not scrollable</div>
  <button id="go">Go</button></body>`;

test('snapshot lists scrollable containers with a ref and position', () => {
  loadPage(PANEL);
  makeScrollable(document.getElementById('panel'), { height: 3200, view: 400, top: 80 });
  const t = snapshotFn(8000).value;
  assert.match(t, /\[e\d+\] scrollable "Results" \(scrolled 80 of 3200\)/);
  assert.doesNotMatch(t, /scrollable "div"/, 'a div that does not overflow is not listed');
});

test('scroll with a ref scrolls that container, not the window, and reports position', () => {
  loadPage(PANEL);
  const panel = document.getElementById('panel');
  makeScrollable(panel, { height: 1000, view: 200 });
  let windowCalls = 0;
  window.scrollBy = () => windowCalls++;
  window.scrollTo = () => windowCalls++;
  const t = snapshotFn(8000).value;
  const ref = t.match(/\[(e\d+)\] scrollable "Results"/)[1];

  let r = scrollFn('down', ref);
  assert.equal(r.ok, true);
  assert.equal(panel.scrollTop, 160, '80% of the visible height');
  assert.match(r.value, /Position is now 160 of 1000 \(more content below\)/);
  r = scrollFn('bottom', ref);
  assert.equal(panel.scrollTop, 800);
  assert.match(r.value, /at the bottom/);
  r = scrollFn('up', ref);
  assert.equal(panel.scrollTop, 640);
  r = scrollFn('top', ref);
  assert.equal(panel.scrollTop, 0);
  assert.equal(windowCalls, 0, 'the window must not scroll when a container is targeted');
});

test('scroll with the ref of an element inside a panel uses the nearest scrollable ancestor', () => {
  loadPage(PANEL);
  const panel = document.getElementById('panel');
  makeScrollable(panel, { height: 1000, view: 200 });
  const t = snapshotFn(8000).value;
  const r = scrollFn('down', refOf(t, 'Staff Engineer, Acme'));
  assert.equal(r.ok, true);
  assert.equal(panel.scrollTop, 160);
});

test('scroll with a ref that has no scrollable ancestor falls back to the window and says so', () => {
  loadPage(PANEL);
  const calls = [];
  window.scrollBy = (x, y) => calls.push(y);
  const t = snapshotFn(8000).value;
  const r = scrollFn('down', refOf(t, 'Go'));
  assert.equal(r.ok, true);
  assert.equal(calls.length, 1);
  assert.match(r.value, /No scrollable container found/);
});

test('scroll with a stale ref explains how refs are lost', () => {
  loadPage(PANEL);
  const r = scrollFn('down', 'e42');
  assert.equal(r.ok, false);
  assert.match(r.error, /Unknown or stale ref.*reloads or navigates/);
  assert.equal(scrollFn('sideways', 'e1').ok, false);
});

test('window scroll reports position and whether more content is below', () => {
  loadPage(PANEL);
  window.scrollBy = () => {};
  const r = scrollFn('down');
  assert.match(r.value, /Position is now 0 of \d+ \((more content below|at the bottom)\)/);
});

test('page_links lists visible http(s) links deduplicated in page order', () => {
  loadPage(`<!doctype html><title>L</title><body>
    <a href="/a?x=1">First</a><a href="/a?x=1">First again</a><a href="/a?x=2">Second</a>
    <a href="mailto:me@example.com">Mail</a><a href="javascript:alert(1)">JS</a><a href="tel:123">Tel</a>
    <div style="display:none"><a href="/hidden">Hidden</a></div>
    <a href="/img"><img alt="Logo link" src="x.png"></a></body>`);
  const r = linksFn('', 100, false);
  assert.equal(r.ok, true);
  const lines = r.value.split('\n');
  assert.equal(lines[0], '3 links');
  assert.deepEqual(lines.slice(1), [
    'First → https://example.com/a?x=1',
    'Second → https://example.com/a?x=2',
    'Logo link → https://example.com/img',
  ]);
  assert.doesNotMatch(r.value, /mailto|javascript|tel:|hidden/i);
});

test('page_links filters with contains, strips queries, and enforces caps', () => {
  const many = Array.from({ length: 600 }, (_, i) => `<a href="/p/${i}?s=${i}">Item ${i}</a>`).join('');
  loadPage(`<!doctype html><title>L</title><body><a href="/jobs/view/1?trk=a">Staff Engineer</a><a href="/jobs/view/1?trk=b">Staff Engineer</a><a href="/about">About us</a>${many}</body>`);

  const f = linksFn('JOBS/VIEW', 100, true).value.split('\n');
  assert.deepEqual(f, ['1 links', 'Staff Engineer → https://example.com/jobs/view/1']);

  assert.match(linksFn('about', 100, false).value, /About us → https:\/\/example\.com\/about/);
  assert.match(linksFn('staff engineer', 100, false).value, /^2 links/, 'differing queries stay separate without stripQuery');

  const dflt = linksFn('', undefined, false).value;
  assert.match(dflt, /^100 of 60\d links/);
  assert.equal(dflt.split('\n').length, 101);
  const hard = linksFn('', 9999, false).value;
  assert.match(hard, /^500 of 60\d links/);
  assert.equal(hard.split('\n').length, 501);
  assert.equal(linksFn('zzz-nothing', 10, false).value, 'No matching links found.');
});

test('snapshot and links see into open shadow roots, and refs from there work', () => {
  loadPage(`<!doctype html><title>S</title><body><div id="host"></div><button id="light">Light</button></body>`);
  const host = document.getElementById('host');
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = '<button id="deep">Deep button</button><a href="/inside">Inside link</a>';
  let clicked = 0;
  root.getElementById('deep').addEventListener('click', () => clicked++);

  const t = snapshotFn(8000).value;
  assert.match(t, /button "Deep button"/);
  assert.match(t, /link "Inside link"/);
  assert.match(t, /button "Light"/);
  assert.equal(clickFn(refOf(t, 'Deep button')).ok, true);
  assert.equal(clicked, 1);
  assert.match(linksFn('', 10, false).value, /Inside link → https:\/\/example\.com\/inside/);
});

test('snapshot maxElements limits the list and says it truncated', () => {
  const many = Array.from({ length: 60 }, (_, i) => `<a href="/p${i}">Link ${i}</a>`).join('');
  loadPage(`<!doctype html><title>Big</title><body>${many}</body>`);
  const small = snapshotFn(8000, 10).value;
  assert.match(small, /10 shown of 60, list truncated/);
  assert.equal((small.match(/^\[e\d+\] link/gm) || []).length, 10);
  const all = snapshotFn(8000, 400).value;
  assert.match(all, /60 shown of 60\)/);
  assert.doesNotMatch(all, /truncated: pass/);
  assert.match(snapshotFn(8000, 99999).value, /60 shown of 60/, 'clamped to 400');
});

test('containsTextFn matches case-insensitively and rejects empty text', () => {
  loadPage('<!doctype html><title>T</title><body><p>Showing 25 Results</p></body>');
  assert.deepEqual(containsTextFn('showing 25 RESULTS'), { ok: true, value: true });
  assert.deepEqual(containsTextFn('nope'), { ok: true, value: false });
  assert.equal(containsTextFn('').ok, false);
});

test('type (page lane) verifies the result and refuses code-editor widgets instead of reporting a false success', () => {
  loadPage(`<!doctype html><title>E</title><body>
    <input id="short" aria-label="Short">
    <input id="num" type="number" aria-label="Num">
    <div class="monaco-editor"><textarea id="inputarea" aria-label="Editor input"></textarea></div>
    <div id="rich" contenteditable="true" aria-label="Rich"></div></body>`);
  const t = snapshotFn(8000).value;

  // A masking script cuts the text after the input event: the old code said ok, now it must say no.
  document.getElementById('short').addEventListener('input', (e) => (e.target.value = e.target.value.slice(0, 3)));
  const short = typeFn(refOf(t, 'Short'), 'abcdef', false);
  assert.equal(short.ok, false);
  assert.match(short.error, /did not take effect.*3 characters, expected 6/);
  assert.doesNotMatch(short.error, /abcdef/, 'the typed text is not echoed');

  assert.equal(typeFn(refOf(t, 'Num'), 'abc', false).ok, false, 'a number input drops letters');
  assert.equal(typeFn(refOf(t, 'Num'), '42', false).ok, true);

  const editor = typeFn(refOf(t, 'Editor input'), 'code', false);
  assert.equal(editor.ok, false);
  assert.match(editor.error, /code editor widget.*input_type/);
  assert.equal(document.getElementById('inputarea').value, '', 'the widget was left untouched');
});
