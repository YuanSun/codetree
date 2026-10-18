// Functions that background.js injects into a shared tab with
// chrome.scripting.executeScript({ func, args }).
//
// Chrome serializes each function with toString(), so every function here must
// be fully self-contained: no references to anything outside its own body.
// They return { ok: true, value } or { ok: false, error } and never throw.
//
// They run in the extension's isolated world, so the element refs stored on
// `window.__dshRefs` are not visible to the page's own scripts.

export function snapshotFn(maxChars) {
  try {
    const limit = Math.min(Math.max(Number(maxChars) || 8000, 500), 30000);
    const MAX_ELEMENTS = 150;
    const doc = document;
    const win = window;

    const refs = new Map();
    win.__dshRefs = refs; // a new snapshot invalidates older refs

    const clean = (s, n) => {
      const t = String(s ?? '').replace(/\s+/g, ' ').trim();
      return t.length > n ? t.slice(0, n - 1) + '…' : t;
    };

    const isVisible = (el) => {
      if (typeof el.checkVisibility === 'function') {
        return el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
      }
      // Fallback: a hidden ancestor hides the element, so walk up the tree.
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
        if (n.hidden) return false;
        const cs = win.getComputedStyle(n);
        if (cs.display === 'none' || cs.opacity === '0') return false;
        if (n === el && cs.visibility === 'hidden') return false; // visibility is inherited
      }
      return true;
    };

    const selector = [
      'a[href]',
      'button',
      'input:not([type=hidden])',
      'select',
      'textarea',
      'summary',
      '[role=button]',
      '[role=link]',
      '[role=checkbox]',
      '[role=radio]',
      '[role=tab]',
      '[role=menuitem]',
      '[role=switch]',
      '[contenteditable=""]',
      '[contenteditable="true"]',
    ].join(',');

    const labelFor = (el) => {
      const aria = el.getAttribute('aria-label');
      if (aria) return clean(aria, 80);
      const labelledby = el.getAttribute('aria-labelledby');
      if (labelledby) {
        const t = labelledby
          .split(/\s+/)
          .map((id) => doc.getElementById(id)?.textContent || '')
          .join(' ');
        if (clean(t, 80)) return clean(t, 80);
      }
      if (el.labels && el.labels.length) {
        const t = clean(Array.from(el.labels).map((l) => l.textContent).join(' '), 80);
        if (t) return t;
      }
      const type = (el.getAttribute('type') || '').toLowerCase();
      if (el.tagName === 'INPUT' && ['submit', 'button', 'reset'].includes(type)) {
        return clean(el.value, 80);
      }
      const text = clean(el.textContent, 80);
      if (text) return text;
      const alt = el.querySelector && el.querySelector('img[alt]');
      if (alt) return clean(alt.getAttribute('alt'), 80);
      return clean(el.getAttribute('placeholder') || el.getAttribute('title') || el.getAttribute('name') || '', 80);
    };

    const lines = [];
    let total = 0;
    let n = 0;
    for (const el of doc.querySelectorAll(selector)) {
      if (!isVisible(el)) continue;
      total++;
      if (n >= MAX_ELEMENTS) continue;
      n++;
      const ref = 'e' + n;
      refs.set(ref, el);

      const tag = el.tagName.toLowerCase();
      const type = (el.getAttribute('type') || '').toLowerCase();
      const role = (el.getAttribute('role') || '').toLowerCase();
      let kind = role || tag;
      let extra = '';

      if (tag === 'a') {
        kind = 'link';
        extra = ' → ' + clean(el.href, 120);
      } else if (tag === 'input') {
        if (['checkbox', 'radio'].includes(type)) {
          kind = type;
          extra = el.checked ? ' [checked]' : ' [unchecked]';
        } else if (['submit', 'button', 'reset'].includes(type)) {
          kind = 'button';
        } else {
          kind = 'input';
          extra = ` (type=${type || 'text'})`;
          if (type !== 'password' && el.value) extra += ` value="${clean(el.value, 40)}"`;
        }
      } else if (tag === 'textarea') {
        kind = 'textarea';
        if (el.value) extra = ` value="${clean(el.value, 40)}"`;
      } else if (tag === 'select') {
        kind = 'select';
        const opt = el.selectedOptions && el.selectedOptions[0];
        if (opt) extra = ` value="${clean(opt.textContent, 40)}"`;
      } else if (el.isContentEditable) {
        kind = 'editable';
      }
      if (el.disabled) extra += ' [disabled]';

      lines.push(`[${ref}] ${kind} "${labelFor(el)}"${extra}`);
    }

    let text = (doc.body && (doc.body.innerText ?? doc.body.textContent)) || '';
    text = String(text).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    let truncatedNote = '';
    if (text.length > limit) {
      truncatedNote = `, truncated to ${limit}`;
      text = text.slice(0, limit);
    }

    const out = [
      `Title: ${doc.title}`,
      `URL: ${win.location.href}`,
      `--- Page text (main frame only${truncatedNote}) ---`,
      text,
      `--- Interactive elements (${n} shown of ${total}) ---`,
      ...lines,
    ].join('\n');
    return { ok: true, value: out };
  } catch (e) {
    return { ok: false, error: 'snapshot failed: ' + (e && e.message ? e.message : String(e)) };
  }
}

export function clickFn(ref) {
  try {
    const el = window.__dshRefs && window.__dshRefs.get(ref);
    if (!el || !el.isConnected) {
      return { ok: false, error: 'Unknown or stale ref. Take a new page_snapshot and use a ref from it.' };
    }
    if (el.disabled) return { ok: false, error: 'That element is disabled.' };
    const type = (el.getAttribute('type') || '').toLowerCase();
    if (el.tagName === 'INPUT' && type === 'file') {
      return { ok: false, error: 'Refusing to click a file chooser.' };
    }
    if (el.tagName === 'A' && /^\s*javascript:/i.test(el.getAttribute('href') || '')) {
      return { ok: false, error: 'Refusing to click a javascript: link.' };
    }
    if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'center' });
    el.click();
    return { ok: true, value: `Clicked ${ref}. The page may have changed, so take a new page_snapshot.` };
  } catch (e) {
    return { ok: false, error: 'click failed: ' + (e && e.message ? e.message : String(e)) };
  }
}

export function typeFn(ref, text, submit) {
  try {
    const el = window.__dshRefs && window.__dshRefs.get(ref);
    if (!el || !el.isConnected) {
      return { ok: false, error: 'Unknown or stale ref. Take a new page_snapshot and use a ref from it.' };
    }
    if (el.disabled || el.readOnly) return { ok: false, error: 'That element is disabled or read-only.' };

    const tag = el.tagName;
    const type = (el.getAttribute('type') || 'text').toLowerCase();
    const autocomplete = (el.getAttribute('autocomplete') || '').toLowerCase();

    if (tag === 'INPUT') {
      if (type === 'password') return { ok: false, error: 'Refusing to type into a password field.' };
      const blocked = ['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'image', 'hidden', 'range', 'color'];
      if (blocked.includes(type)) return { ok: false, error: `Cannot type into an input of type ${type}.` };
    } else if (tag !== 'TEXTAREA' && !el.isContentEditable) {
      return { ok: false, error: 'That element does not accept text.' };
    }
    if (/(^|\s)(cc-|one-time-code|current-password|new-password)/.test(autocomplete)) {
      return { ok: false, error: 'Refusing to type into a payment, one-time-code or password field.' };
    }

    if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'center' });
    el.focus();

    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      const proto = tag === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(el, String(text));
      el.dispatchEvent(new window.Event('input', { bubbles: true }));
      el.dispatchEvent(new window.Event('change', { bubbles: true }));
    } else {
      let done = false;
      try {
        document.execCommand('selectAll', false);
        done = document.execCommand('insertText', false, String(text));
      } catch {
        done = false;
      }
      if (!done) {
        el.textContent = String(text);
        el.dispatchEvent(new window.Event('input', { bubbles: true }));
      }
    }

    if (submit) {
      if (el.form && typeof el.form.requestSubmit === 'function') {
        el.form.requestSubmit();
      } else {
        for (const kind of ['keydown', 'keypress', 'keyup']) {
          el.dispatchEvent(new window.KeyboardEvent(kind, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        }
      }
    }
    return { ok: true, value: `Typed ${String(text).length} characters into ${ref}${submit ? ' and submitted' : ''}.` };
  } catch (e) {
    return { ok: false, error: 'type failed: ' + (e && e.message ? e.message : String(e)) };
  }
}

export function scrollFn(direction) {
  try {
    const h = Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
    const step = Math.round(window.innerHeight * 0.8) || 600;
    if (direction === 'down') window.scrollBy(0, step);
    else if (direction === 'up') window.scrollBy(0, -step);
    else if (direction === 'top') window.scrollTo(0, 0);
    else if (direction === 'bottom') window.scrollTo(0, h);
    else return { ok: false, error: 'direction must be up, down, top or bottom' };
    return { ok: true, value: `Scrolled ${direction}. Position is now ${Math.round(window.scrollY)} of ${h}.` };
  } catch (e) {
    return { ok: false, error: 'scroll failed: ' + (e && e.message ? e.message : String(e)) };
  }
}
