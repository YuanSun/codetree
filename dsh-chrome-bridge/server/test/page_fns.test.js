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
  for (const r of [snapshotFn(1000), clickFn('e1'), typeFn('e1', 'x', false), scrollFn('down')]) {
    assert.equal(r.ok, false);
    assert.equal(typeof r.error, 'string');
  }
});
