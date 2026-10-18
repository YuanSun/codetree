// Tool implementations for the debugger lane. background.js does the gating
// (shared tab, allowlisted origin, actions tick) before calling these.
//
// No function here logs or returns typed text.

import * as cdp from './cdp.js';
import { getAllowed } from './core.js';

const MAX_IMAGE_BYTES = 1024 * 1024;
const MAX_WIDTH_CAP = 1568;
const DEFAULT_WIDTH = 1024;
const MAX_TYPE_CHARS = 5000;

const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);

// ------------------------------------------------------------------- frames ----

// Returns the CDP session of a child frame, or undefined for the main frame.
// Frames on origins the user has not allowlisted are blocked (D12).
export async function resolveFrame(tabId, frame) {
  if (!frame) return undefined;
  const all = cdp.frames(tabId);
  const hit = all.find((f) => f.targetId === frame || f.origin === frame || f.sessionId === frame);
  if (!hit) {
    throw new Error(`No separate-process frame matches "${frame}". Call page_read to see the listed frames.`);
  }
  if (!hit.origin || !(await getAllowed()).includes(hit.origin)) {
    throw new Error(`The frame ${hit.origin || '(unknown)'} is blocked: that site is not on the allowlist.`);
  }
  return hit.sessionId;
}

async function frameLines(tabId) {
  const allowed = await getAllowed();
  return cdp.frames(tabId).map((f) => `  ${f.origin || '(no origin)'} ${f.origin && allowed.includes(f.origin) ? '' : '(blocked)'}`.trimEnd());
}

// --------------------------------------------------------------- screenshot ----

export function imageSize(bytes) {
  if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: dv.getUint32(16), height: dv.getUint32(20) };
  }
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i++;
      continue;
    }
    const m = bytes[i + 1];
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) {
      return { height: (bytes[i + 5] << 8) | bytes[i + 6], width: (bytes[i + 7] << 8) | bytes[i + 8] };
    }
    i += 2 + ((bytes[i + 2] << 8) | bytes[i + 3]);
  }
  throw new Error('Could not read the screenshot size.');
}

const decode = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

export async function screenshot(tabId, params = {}) {
  const sessionId = await resolveFrame(tabId, params.frame);
  const png = params.format === 'png';
  const width = clamp(Math.round(Number(params.maxWidth) || DEFAULT_WIDTH), 100, MAX_WIDTH_CAP);

  const m = await cdp.send(tabId, 'Page.getLayoutMetrics', {}, sessionId);
  const vp = m.cssVisualViewport || m.visualViewport || {};
  const vw = vp.clientWidth || (m.layoutViewport && m.layoutViewport.clientWidth);
  const vh = vp.clientHeight || (m.layoutViewport && m.layoutViewport.clientHeight);
  if (!vw || !vh) throw new Error('Could not read the viewport size.');
  const pageX = vp.pageX || 0;
  const pageY = vp.pageY || 0;

  // Regions are given in viewport CSS pixels; CDP clips are in page coordinates.
  const r = params.region;
  const box = r
    ? { x: Number(r.x), y: Number(r.y), width: Number(r.width), height: Number(r.height) }
    : { x: 0, y: 0, width: vw, height: vh };
  if (![box.x, box.y, box.width, box.height].every(Number.isFinite) || box.width < 1 || box.height < 1) {
    throw new Error('region needs numeric x, y, width and height (viewport CSS pixels).');
  }

  let scale = Math.min(1, width / box.width);
  let quality = 70;
  for (let attempt = 0; attempt < 5; attempt++) {
    const clip = { x: box.x + pageX, y: box.y + pageY, width: box.width, height: box.height, scale };
    const shot = await cdp.send(
      tabId,
      'Page.captureScreenshot',
      png ? { format: 'png', clip } : { format: 'jpeg', quality, clip },
      sessionId,
    );
    const bytes = decode(shot.data);
    const dims = imageSize(bytes);
    if (dims.width > width + 1) {
      scale *= width / dims.width; // the browser applied extra scaling (for example device pixel ratio)
      continue;
    }
    if (bytes.length > MAX_IMAGE_BYTES) {
      if (!png && quality > 30) {
        quality -= 20;
        continue;
      }
      if (attempt < 4) {
        scale *= 0.75;
        continue;
      }
      throw new Error('The screenshot is over 1 MB even when shrunk. Ask for a smaller region or width.');
    }
    const imgScale = dims.width / box.width;
    return {
      __content: [
        { type: 'image', data: shot.data, mimeType: png ? 'image/png' : 'image/jpeg' },
        {
          type: 'text',
          text:
            `Screenshot ${dims.width}x${dims.height} px. Viewport ${Math.round(vw)}x${Math.round(vh)} CSS px, ` +
            `scale ${imgScale.toFixed(3)} (image px per CSS px). Region origin in the viewport: (${Math.round(box.x)}, ${Math.round(box.y)}). ` +
            'To click an image point (ix, iy), use input_click x = ix / scale + origin x, y = iy / scale + origin y.',
        },
      ],
    };
  }
  throw new Error('Could not produce a screenshot of the requested size.');
}

// ---------------------------------------------------------- accessibility ----

const INTERACTIVE = new Set([
  'button', 'link', 'textbox', 'searchbox', 'combobox', 'checkbox', 'radio', 'switch', 'tab', 'menuitem',
  'menuitemcheckbox', 'menuitemradio', 'option', 'slider', 'spinbutton', 'listbox', 'treeitem', 'scrollbar',
  'textarea', 'DisclosureTriangle', 'PopUpButton', 'ListBoxOption', 'MenuListOption', 'MenuListPopup',
]);
const SKIP_ROLES = new Set(['none', 'generic', 'InlineTextBox', 'LineBreak', 'presentation', 'GenericContainer']);
const TEXT_FIELDS = new Set(['textbox', 'searchbox', 'combobox', 'textarea']);
const STATES = ['disabled', 'checked', 'expanded', 'selected', 'pressed', 'required', 'readonly', 'invalid', 'focused'];
const MAX_PASSWORD_CHECKS = 40;

const val = (x) => (x && x.value !== undefined ? x.value : undefined);
const short = (s, n) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};

export async function readTree(tabId, params = {}) {
  const sessionId = await resolveFrame(tabId, params.frame);
  const s = cdp.getState(tabId);
  const filter = params.filter === 'all' ? 'all' : 'interactive';
  const limit = clamp(Math.round(Number(params.maxChars)) || 8000, 500, 30000);

  await cdp.send(tabId, 'Accessibility.enable', {}, sessionId);
  const { nodes = [] } = await cdp.send(tabId, 'Accessibility.getFullAXTree', {}, sessionId);
  const byId = new Map(nodes.map((n) => [n.nodeId, n]));

  let roots = nodes.filter((n) => !n.parentId || !byId.has(n.parentId)).map((n) => n.nodeId);
  if (params.refId) {
    const ref = s.refs.get(String(params.refId));
    if (!ref) throw new Error('Unknown or stale ref. Refs are lost when a new page_read is taken or the page navigates.');
    const hit = nodes.find((n) => n.backendDOMNodeId === ref.backendNodeId);
    if (!hit) throw new Error('That ref is no longer in the page. Take a new page_read.');
    roots = [hit.nodeId];
  }

  // Which text fields are password inputs? The accessibility tree does not say.
  const passwordIds = new Set();
  const unchecked = new Set();
  let checks = 0;
  for (const n of nodes) {
    if (n.ignored || !n.backendDOMNodeId || !TEXT_FIELDS.has(val(n.role))) continue;
    if (checks++ >= MAX_PASSWORD_CHECKS) {
      unchecked.add(n.nodeId);
      continue;
    }
    try {
      const d = await cdp.send(tabId, 'DOM.describeNode', { backendNodeId: n.backendDOMNodeId }, sessionId);
      const attrs = (d.node && d.node.attributes) || [];
      for (let i = 0; i + 1 < attrs.length; i += 2) {
        if (attrs[i] === 'type' && String(attrs[i + 1]).toLowerCase() === 'password') passwordIds.add(n.nodeId);
      }
    } catch {
      unchecked.add(n.nodeId);
    }
  }

  s.refs = new Map();
  let refN = 0;
  let used = 0;
  let omitted = 0;
  const lines = [];
  let title = '';

  const emit = (node, depth) => {
    const role = val(node.role) || '';
    const name = short(val(node.name), 100);
    if (role === 'RootWebArea') {
      title = name;
      return;
    }
    if (node.ignored || SKIP_ROLES.has(role)) return;
    if (role === 'StaticText') {
      const parent = byId.get(node.parentId);
      const covered = parent && short(val(parent.name), 400).includes(name);
      if (filter === 'interactive' || !name || covered) return;
    } else if (filter === 'interactive' && !INTERACTIVE.has(role)) {
      return;
    } else if (!name && !INTERACTIVE.has(role) && filter === 'all' && role !== 'heading') {
      return;
    }

    const states = [];
    let level = '';
    for (const p of node.properties || []) {
      const v = val(p.value);
      if (STATES.includes(p.name) && v && v !== 'false') states.push(v === true || v === 'true' ? p.name : `${p.name}=${v}`);
      if (p.name === 'level') level = ` level=${v}`;
    }
    let extra = '';
    const value = val(node.value);
    if (TEXT_FIELDS.has(role)) {
      if (passwordIds.has(node.nodeId)) extra = ' (password)';
      else if (!unchecked.has(node.nodeId) && value) extra = ` value="${short(value, 40)}"`;
    } else if (value !== undefined && value !== '') {
      extra = ` value="${short(value, 40)}"`;
    }

    let ref = '';
    if (node.backendDOMNodeId) {
      ref = `[ax${++refN}] `;
      s.refs.set(`ax${refN}`, { backendNodeId: node.backendDOMNodeId, sessionId });
    }
    const line =
      `${filter === 'all' ? '  '.repeat(Math.min(depth, 8)) : ''}${ref}${role}${level}${name ? ` "${name}"` : ''}` +
      `${states.length ? ` (${states.join(', ')})` : ''}${extra}`;
    if (used + line.length > limit) {
      omitted++;
      return;
    }
    used += line.length + 1;
    lines.push(line);
  };

  const walk = (id, depth) => {
    const node = byId.get(id);
    if (!node) return;
    emit(node, depth);
    for (const c of node.childIds || []) walk(c, depth + 1);
  };
  for (const id of roots) walk(id, 0);

  const frames = await frameLines(tabId);
  const head = [`Title: ${title}`, `--- Accessibility tree (${filter}, ${lines.length} nodes shown) ---`];
  const tail = [];
  if (omitted) tail.push(`[truncated: ${omitted} more nodes. Use filter "interactive", a larger maxChars, or a refId of a container.]`);
  if (frames.length) tail.push('Separate frames:', ...frames);
  return [...head, ...lines, ...tail].join('\n');
}

// -------------------------------------------------------------------- input ----

const MODIFIER_BITS = { alt: 1, ctrl: 2, meta: 4, shift: 8 };
const modBits = (mods = []) => mods.reduce((n, m) => n | (MODIFIER_BITS[String(m).toLowerCase()] || 0), 0);

const NAMED_KEYS = {
  Enter: { code: 'Enter', vk: 13, text: '\r' },
  Tab: { code: 'Tab', vk: 9 },
  Escape: { code: 'Escape', vk: 27 },
  Backspace: { code: 'Backspace', vk: 8 },
  Delete: { code: 'Delete', vk: 46 },
  ArrowLeft: { code: 'ArrowLeft', vk: 37 },
  ArrowUp: { code: 'ArrowUp', vk: 38 },
  ArrowRight: { code: 'ArrowRight', vk: 39 },
  ArrowDown: { code: 'ArrowDown', vk: 40 },
  Home: { code: 'Home', vk: 36 },
  End: { code: 'End', vk: 35 },
  PageUp: { code: 'PageUp', vk: 33 },
  PageDown: { code: 'PageDown', vk: 34 },
  ' ': { code: 'Space', vk: 32, text: ' ' },
};
const SHORTCUTS = { a: 'selectAll', c: 'copy', x: 'cut', z: 'undo', y: 'redo' };

async function ensureDom(tabId, sessionId) {
  const s = cdp.getState(tabId);
  s.domOn = s.domOn || new Set();
  const k = sessionId || 'main';
  if (!s.domOn.has(k)) {
    await cdp.send(tabId, 'DOM.enable', {}, sessionId);
    s.domOn.add(k);
  }
}

function lookupRef(tabId, ref) {
  const r = cdp.getState(tabId).refs.get(String(ref));
  if (!r) throw new Error('Unknown or stale ref. Refs are lost when a new page_read is taken or the page navigates. Call page_read and use a ref from it.');
  return r;
}

async function pointOf(tabId, params, sessionId) {
  if (params.ref) {
    const r = lookupRef(tabId, params.ref);
    await ensureDom(tabId, r.sessionId);
    try {
      await cdp.send(tabId, 'DOM.scrollIntoViewIfNeeded', { backendNodeId: r.backendNodeId }, r.sessionId);
      const { model } = await cdp.send(tabId, 'DOM.getBoxModel', { backendNodeId: r.backendNodeId }, r.sessionId);
      const q = model.content;
      return { x: (q[0] + q[2] + q[4] + q[6]) / 4, y: (q[1] + q[3] + q[5] + q[7]) / 4, sessionId: r.sessionId };
    } catch (e) {
      throw new Error('That element is gone or not visible. Take a new page_read. (' + short(e && e.message, 80) + ')');
    }
  }
  if (Number.isFinite(Number(params.x)) && Number.isFinite(Number(params.y)) && params.x !== undefined && params.y !== undefined) {
    return { x: Number(params.x), y: Number(params.y), sessionId };
  }
  throw new Error('Give a ref from page_read, or x and y in viewport CSS pixels.');
}

// Rules for text and key input (rule 14): look at what is focused first.
async function assertFocus(tabId, sessionId, needText) {
  const f = await cdp.evalFixed(tabId, 'focus', sessionId);
  if (!f) {
    if (needText) throw new Error('Nothing is focused. Click a text field first, or pass a ref.');
    return;
  }
  if (f.tag === 'IFRAME' || f.tag === 'FRAME') {
    throw new Error('Focus is inside an iframe. Pass frame to target it.');
  }
  if (f.tag === 'INPUT') {
    if (f.type === 'password') throw new Error('Refusing to send input to a password field.');
    if (f.type === 'file') throw new Error('Refusing to send input to a file chooser.');
    if (/(^|\s)(cc-|one-time-code|current-password|new-password)/.test(f.autocomplete)) {
      throw new Error('Refusing to send input to a payment, one-time-code or password field.');
    }
    const blocked = ['checkbox', 'radio', 'button', 'submit', 'reset', 'image', 'hidden', 'range', 'color'];
    if (needText && blocked.includes(f.type)) throw new Error(`Cannot type into an input of type ${f.type}.`);
  } else if (needText && f.tag !== 'TEXTAREA' && !f.editable && f.role !== 'textbox') {
    throw new Error('The focused element does not accept text.');
  }
  if (needText && (f.readOnly || f.disabled)) throw new Error('The focused element is disabled or read-only.');
}

export async function click(tabId, params = {}) {
  const sessionId = await resolveFrame(tabId, params.frame);
  const p = await pointOf(tabId, params, sessionId);
  const button = ['left', 'right', 'middle'].includes(params.button) ? params.button : 'left';
  const clickCount = clamp(Math.round(Number(params.clickCount)) || 1, 1, 3);
  const modifiers = modBits(params.modifiers);
  const base = { x: p.x, y: p.y, button, modifiers };
  await cdp.send(tabId, 'Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y, modifiers }, p.sessionId);
  await cdp.send(tabId, 'Input.dispatchMouseEvent', { type: 'mousePressed', ...base, clickCount }, p.sessionId);
  await cdp.send(tabId, 'Input.dispatchMouseEvent', { type: 'mouseReleased', ...base, clickCount }, p.sessionId);
  return `Clicked at (${Math.round(p.x)}, ${Math.round(p.y)}). The page may have changed, so take a new page_read.`;
}

async function dispatchKey(tabId, key, mods, sessionId) {
  const modifiers = modBits(mods);
  const ctrlOrMeta = (modifiers & (MODIFIER_BITS.ctrl | MODIFIER_BITS.meta)) !== 0;
  const lower = key.toLowerCase();
  if (lower === 'paste' || (ctrlOrMeta && lower === 'v')) {
    throw new Error('Paste is refused: it would put the clipboard into the page.');
  }
  let ev;
  if (ctrlOrMeta) {
    let command = SHORTCUTS[lower];
    if (!command) throw new Error('Only select all, copy, cut, undo and redo are allowed with Ctrl or Cmd.');
    if (lower === 'z' && modifiers & MODIFIER_BITS.shift) command = 'redo';
    ev = { key, code: 'Key' + lower.toUpperCase(), windowsVirtualKeyCode: lower.toUpperCase().charCodeAt(0), modifiers, commands: [command] };
    await cdp.send(tabId, 'Input.dispatchKeyEvent', { type: 'rawKeyDown', ...ev }, sessionId);
    await cdp.send(tabId, 'Input.dispatchKeyEvent', { type: 'keyUp', ...ev, commands: undefined }, sessionId);
    return;
  }
  const named = NAMED_KEYS[key];
  if (named) {
    ev = { key, code: named.code, windowsVirtualKeyCode: named.vk, modifiers };
    await cdp.send(tabId, 'Input.dispatchKeyEvent', { type: named.text ? 'keyDown' : 'rawKeyDown', ...ev, ...(named.text ? { text: named.text } : {}) }, sessionId);
    await cdp.send(tabId, 'Input.dispatchKeyEvent', { type: 'keyUp', ...ev }, sessionId);
    return;
  }
  if ([...key].length === 1) {
    const up = key.toUpperCase();
    ev = { key, code: /[a-z]/i.test(key) ? 'Key' + up : /[0-9]/.test(key) ? 'Digit' + key : '', windowsVirtualKeyCode: up.charCodeAt(0), modifiers };
    await cdp.send(tabId, 'Input.dispatchKeyEvent', { type: 'keyDown', ...ev, text: key }, sessionId);
    await cdp.send(tabId, 'Input.dispatchKeyEvent', { type: 'keyUp', ...ev }, sessionId);
    return;
  }
  throw new Error(`Key "${short(key, 20)}" is not supported. Use Enter, Tab, Escape, Backspace, Delete, arrows, Home, End, PageUp, PageDown, a space, or a single character.`);
}

export async function key(tabId, params = {}) {
  const sessionId = await resolveFrame(tabId, params.frame);
  const k = String(params.key ?? '');
  if (!k) throw new Error('key must not be empty.');
  await assertFocus(tabId, sessionId, false);
  await dispatchKey(tabId, k, params.modifiers, sessionId);
  return `Pressed ${short(k, 20)}.`;
}

const norm = (s) => String(s).replace(/\r\n?/g, '\n');
const squash = (s) => norm(s).replace(/\s+/g, ' ').trim();

function firstDiff(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

// Compares what the control holds now with what typing should have produced.
// Only lengths and an index are reported, never the text itself.
function check(before, after, text, replace) {
  if (!before || !after) return { verified: false, unverifiable: true };
  if (after.kind === 'field') {
    const b = norm(before.value);
    const a = norm(after.value);
    let expected;
    if (replace) expected = norm(text);
    else if (Number.isInteger(before.start) && Number.isInteger(before.end)) {
      expected = b.slice(0, before.start) + norm(text) + b.slice(before.end);
    } else {
      return a.includes(norm(text)) ? { verified: true } : { verified: false, detail: 'the typed text is not in the field' };
    }
    return a === expected
      ? { verified: true }
      : { verified: false, detail: `expected ${expected.length} characters, the control has ${a.length}, first difference at index ${firstDiff(a, expected)}` };
  }
  const a = squash(after.value);
  const t = squash(text);
  const ok = replace ? a === t : a.includes(t);
  return ok ? { verified: true } : { verified: false, detail: `expected ${t.length} characters${replace ? '' : ' to be present'}, the editable area has ${a.length}` };
}

export async function type(tabId, params = {}) {
  const sessionId = await resolveFrame(tabId, params.frame);
  const text = String(params.text ?? '');
  if (!text) throw new Error('text must not be empty.');
  if (text.length > MAX_TYPE_CHARS) throw new Error(`text is longer than ${MAX_TYPE_CHARS} characters.`);
  const replace = params.mode === 'replace';

  let focusSession = sessionId;
  if (params.ref) {
    const r = lookupRef(tabId, params.ref);
    await ensureDom(tabId, r.sessionId);
    try {
      await cdp.send(tabId, 'DOM.focus', { backendNodeId: r.backendNodeId }, r.sessionId);
    } catch {
      throw new Error('Could not focus that element. Take a new page_read.');
    }
    focusSession = r.sessionId;
  }
  await assertFocus(tabId, focusSession, true);

  const apply = async () => {
    if (replace) await dispatchKey(tabId, 'a', ['ctrl'], focusSession); // select all
    const before = await cdp.evalFixed(tabId, 'readFocused', focusSession);
    await cdp.send(tabId, 'Input.insertText', { text }, focusSession);
    const after = await cdp.evalFixed(tabId, 'readFocused', focusSession);
    return check(replace ? { ...before, start: 0, end: before && before.kind === 'field' ? before.value.length : 0 } : before, after, text, replace);
  };

  let result = await apply();
  if (replace && result.verified === false && !result.unverifiable) result = await apply(); // one retry, then fail
  if (result.unverifiable) {
    return `Typed ${text.length} characters. verified: false (this control cannot be read back, so check it with page_read or a screenshot).`;
  }
  if (!result.verified) {
    throw new Error(`Typing did not produce the expected result (${result.detail}). The control may hold partial or stale text.`);
  }
  return `Typed ${text.length} characters. verified: true`;
}

export async function scroll(tabId, params = {}) {
  const sessionId = await resolveFrame(tabId, params.frame);
  let p;
  if (params.ref || (params.x !== undefined && params.y !== undefined)) {
    p = await pointOf(tabId, params, sessionId);
  } else {
    const m = await cdp.send(tabId, 'Page.getLayoutMetrics', {}, sessionId);
    const vp = m.cssVisualViewport || m.visualViewport || {};
    p = { x: (vp.clientWidth || 800) / 2, y: (vp.clientHeight || 600) / 2, sessionId };
  }
  const deltaX = clamp(Math.round(Number(params.deltaX)) || 0, -5000, 5000);
  const deltaY = clamp(Math.round(Number(params.deltaY)) || 0, -5000, 5000);
  if (!deltaX && !deltaY) throw new Error('Give a non-zero deltaX or deltaY in CSS pixels (positive deltaY scrolls down).');
  await cdp.send(tabId, 'Input.dispatchMouseEvent', { type: 'mouseWheel', x: p.x, y: p.y, deltaX, deltaY }, p.sessionId);
  return `Scrolled by (${deltaX}, ${deltaY}) at (${Math.round(p.x)}, ${Math.round(p.y)}).`;
}

// ------------------------------------------------------------ eval/console ----

const EVAL_DENY = /\b(document\s*\.\s*cookie|localStorage|sessionStorage|indexedDB|fetch|XMLHttpRequest|WebSocket|sendBeacon|importScripts|eval|Function)\b/;
export const EVAL_MAX_EXPRESSION = 2000;
export const EVAL_MAX_RESULT = 20000;

// A speed bump, not a sandbox (see README): the real controls are the toggle,
// the per-origin list, the expiry and the log.
export function checkExpression(expression) {
  if (!expression || typeof expression !== 'string') return 'expression must be a non-empty string.';
  if (expression.length > EVAL_MAX_EXPRESSION) return `expression is longer than ${EVAL_MAX_EXPRESSION} characters.`;
  const hit = expression.match(EVAL_DENY);
  if (hit) return `"${hit[1].replace(/\s+/g, '')}" is not allowed in page_eval.`;
  return null;
}

export async function evaluate(tabId, params = {}) {
  const sessionId = await resolveFrame(tabId, params.frame);
  const value = await cdp.evalUser(tabId, params.expression, sessionId);
  let out;
  try {
    out = value === undefined ? 'undefined' : JSON.stringify(value, null, 2);
  } catch {
    out = '(result is not JSON)';
  }
  if (out.length > EVAL_MAX_RESULT) out = out.slice(0, EVAL_MAX_RESULT) + '\n[truncated]';
  return out;
}

export async function consoleLog(tabId, params = {}) {
  const s = cdp.getState(tabId);
  const needle = String(params.pattern || '').toLowerCase();
  const max = clamp(Math.round(Number(params.maxItems)) || 50, 1, 200);
  const rows = s.console.filter((e) => !needle || e.text.toLowerCase().includes(needle)).slice(-max);
  if (!rows.length) return 'No matching console messages since the debugger attached.';
  return rows.map((e) => `[${e.level}] ${e.text}`).join('\n');
}

export async function networkLog(tabId, params = {}) {
  const s = cdp.getState(tabId);
  const first = !s.networkOn;
  await cdp.startNetwork(tabId);
  const needle = String(params.urlContains || '').toLowerCase();
  const max = clamp(Math.round(Number(params.maxItems)) || 50, 1, 200);
  const rows = [...s.network.values()].filter((e) => e.url && (!needle || e.url.toLowerCase().includes(needle))).slice(-max);
  const note = first ? 'Network recording started just now; call again after the page does something.\n' : '';
  if (!rows.length) return note + 'No matching requests recorded.';
  return (
    note +
    rows.map((e) => `${e.method || '?'} ${e.url} ${e.failed ? 'failed' : e.status ?? '...'} ${e.type || ''} ${e.size != null ? e.size + 'B' : ''}`.trim()).join('\n')
  );
}
