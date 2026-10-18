// Functions that background.js injects into a shared tab with
// chrome.scripting.executeScript({ func, args }).
//
// Chrome serializes each function with toString(), so every function here must
// be fully self-contained: no references to anything outside its own body.
// They return { ok: true, value } or { ok: false, error } and never throw.
//
// They run in the extension's isolated world, so the element refs stored on
// `window.__dshRefs` are not visible to the page's own scripts.

export function snapshotFn(maxChars, maxElements) {
  try {
    const limit = Math.min(Math.max(Number(maxChars) || 8000, 500), 30000);
    const maxEl = Math.min(Math.max(Math.round(Number(maxElements)) || 150, 1), 400);
    const MAX_SCROLLABLE = 10;
    const doc = document;
    const win = window;

    const refs = new Map();
    win.__dshRefs = refs; // a new snapshot invalidates older refs

    const clean = (s, n) => {
      const t = String(s ?? '').replace(/\s+/g, ' ').trim();
      return t.length > n ? t.slice(0, n - 1) + '…' : t;
    };

    // Parent in the flattened tree: out of a shadow root into its host.
    const up = (n) => n.parentElement || (n.getRootNode && n.getRootNode().host) || null;

    const isVisible = (el) => {
      if (typeof el.checkVisibility === 'function') {
        return el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
      }
      // Fallback: a hidden ancestor hides the element, so walk up the tree.
      for (let n = el; n && n.nodeType === 1; n = up(n)) {
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

    const scrollLabel = (el) => {
      const aria = el.getAttribute('aria-label');
      if (aria) return clean(aria, 60);
      const heading = el.querySelector && el.querySelector('h1,h2,h3,h4,h5,h6');
      if (heading && clean(heading.textContent, 60)) return clean(heading.textContent, 60);
      return el.getAttribute('role') || el.tagName.toLowerCase();
    };

    // One walk over the page, including open shadow roots, in document order.
    const found = [];
    const scrollers = [];
    const walk = (root) => {
      for (const el of root.querySelectorAll('*')) {
        if (el.matches(selector) && isVisible(el)) found.push(el);
        if (
          scrollers.length < MAX_SCROLLABLE &&
          el !== doc.body &&
          el !== doc.documentElement &&
          el.scrollHeight > el.clientHeight + 1 &&
          /(auto|scroll|overlay)/.test(win.getComputedStyle(el).overflowY) &&
          isVisible(el)
        ) {
          scrollers.push(el);
        }
        if (el.shadowRoot) walk(el.shadowRoot);
      }
    };
    walk(doc);

    const lines = [];
    let refN = 0;
    for (const el of scrollers) {
      const ref = 'e' + ++refN;
      refs.set(ref, el);
      lines.push(
        `[${ref}] scrollable "${scrollLabel(el)}" (scrolled ${Math.round(el.scrollTop)} of ${el.scrollHeight})`,
      );
    }

    const total = found.length;
    let n = 0;
    for (const el of found) {
      if (n >= maxEl) break;
      n++;
      const ref = 'e' + ++refN;
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

    const cutNote = n < total ? `, list truncated: pass a larger maxElements (max 400) or narrow the page` : '';
    const out = [
      `Title: ${doc.title}`,
      `URL: ${win.location.href}`,
      `--- Page text (main frame only${truncatedNote}) ---`,
      text,
      `--- Interactive elements (${n} shown of ${total}${cutNote}) ---`,
      ...lines,
    ].join('\n');
    return { ok: true, value: out };
  } catch (e) {
    return { ok: false, error: 'snapshot failed: ' + (e && e.message ? e.message : String(e)) };
  }
}

export function linksFn(contains, maxItems, stripQuery) {
  try {
    const cap = Math.min(Math.max(Math.round(Number(maxItems)) || 100, 1), 500);
    const needle = String(contains || '').toLowerCase();
    const win = window;
    const doc = document;

    const clean = (s, n) => {
      const t = String(s ?? '').replace(/\s+/g, ' ').trim();
      return t.length > n ? t.slice(0, n - 1) + '…' : t;
    };
    const up = (n) => n.parentElement || (n.getRootNode && n.getRootNode().host) || null;
    const isVisible = (el) => {
      if (typeof el.checkVisibility === 'function') {
        return el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
      }
      for (let n = el; n && n.nodeType === 1; n = up(n)) {
        if (n.hidden) return false;
        const cs = win.getComputedStyle(n);
        if (cs.display === 'none' || cs.opacity === '0') return false;
        if (n === el && cs.visibility === 'hidden') return false;
      }
      return true;
    };
    const labelFor = (el) => {
      const aria = el.getAttribute('aria-label');
      if (aria) return clean(aria, 100);
      const text = clean(el.textContent, 100);
      if (text) return text;
      const alt = el.querySelector && el.querySelector('img[alt]');
      if (alt) return clean(alt.getAttribute('alt'), 100);
      return clean(el.getAttribute('title') || '', 100);
    };

    const byUrl = new Map(); // deduplicated by URL, first text wins, DOM order
    const walk = (root) => {
      for (const el of root.querySelectorAll('*')) {
        if (el.matches('a[href]') && isVisible(el)) {
          let u;
          try {
            u = new URL(el.href);
          } catch {
            u = null;
          }
          if (u && (u.protocol === 'http:' || u.protocol === 'https:')) {
            const text = labelFor(el);
            if (!needle || text.toLowerCase().includes(needle) || u.href.toLowerCase().includes(needle)) {
              if (stripQuery) {
                u.search = '';
                u.hash = '';
              }
              if (!byUrl.has(u.href)) byUrl.set(u.href, text);
            }
          }
        }
        if (el.shadowRoot) walk(el.shadowRoot);
      }
    };
    walk(doc);

    const all = Array.from(byUrl, ([url, text]) => `${text || '(no text)'} → ${url}`);
    if (!all.length) return { ok: true, value: 'No matching links found.' };
    const shown = all.slice(0, cap);
    const head =
      shown.length < all.length
        ? `${shown.length} of ${all.length} links (raise maxItems, max 500, or use contains)`
        : `${all.length} links`;
    return { ok: true, value: [head, ...shown].join('\n') };
  } catch (e) {
    return { ok: false, error: 'links failed: ' + (e && e.message ? e.message : String(e)) };
  }
}

export function clickFn(ref) {
  try {
    const el = window.__dshRefs && window.__dshRefs.get(ref);
    if (!el || !el.isConnected) {
      return { ok: false, error: 'Unknown or stale ref. Refs are lost when a new page_snapshot is taken or the page reloads or navigates. Take a new page_snapshot and use a ref from it.' };
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
      return { ok: false, error: 'Unknown or stale ref. Refs are lost when a new page_snapshot is taken or the page reloads or navigates. Take a new page_snapshot and use a ref from it.' };
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

    // Code editors keep their text in their own model, so setting the DOM value
    // can report success while the editor holds something else.
    if (el.closest && el.closest('.monaco-editor, .cm-editor, .CodeMirror, .ace_editor')) {
      return { ok: false, error: 'This is a code editor widget, which this page lane cannot type into reliably. Use input_type (debugger build), which verifies the result.' };
    }

    if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'center' });
    el.focus();

    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      const proto = tag === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(el, String(text));
      el.dispatchEvent(new window.Event('input', { bubbles: true }));
      el.dispatchEvent(new window.Event('change', { bubbles: true }));
      // Verify: a maxlength, a masking script or a framework can undo the value.
      if (el.value !== String(text)) {
        return { ok: false, error: `Typing did not take effect: the field holds ${el.value.length} characters, expected ${String(text).length}.` };
      }
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
      const now = String(el.innerText ?? el.textContent ?? '');
      if (!now.includes(String(text))) {
        return { ok: false, error: 'Typing did not take effect: the editable area does not contain the text.' };
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

export function scrollFn(direction, ref) {
  try {
    if (!['up', 'down', 'top', 'bottom'].includes(direction)) {
      return { ok: false, error: 'direction must be up, down, top or bottom' };
    }
    const up = (n) => n.parentElement || (n.getRootNode && n.getRootNode().host) || null;

    let container = null;
    let note = '';
    if (ref) {
      const el = window.__dshRefs && window.__dshRefs.get(ref);
      if (!el || !el.isConnected) {
        return { ok: false, error: 'Unknown or stale ref. Refs are lost when a new page_snapshot is taken or the page reloads or navigates. Take a new page_snapshot and use a ref from it.' };
      }
      for (let n = el; n && n !== document.body && n !== document.documentElement; n = up(n)) {
        if (n.scrollHeight > n.clientHeight + 1 && /(auto|scroll|overlay)/.test(window.getComputedStyle(n).overflowY)) {
          container = n;
          break;
        }
      }
      if (!container) note = ` No scrollable container found around ${ref}, so the window was scrolled.`;
    }

    if (container) {
      const step = Math.round(container.clientHeight * 0.8) || 200;
      if (direction === 'down') container.scrollTop = container.scrollTop + step;
      else if (direction === 'up') container.scrollTop = Math.max(0, container.scrollTop - step);
      else if (direction === 'top') container.scrollTop = 0;
      else container.scrollTop = container.scrollHeight;
      const pos = Math.round(container.scrollTop);
      const total = container.scrollHeight;
      const more = pos + container.clientHeight < total - 1;
      return {
        ok: true,
        value: `Scrolled ${direction} inside the container ${ref}. Position is now ${pos} of ${total} (${more ? 'more content below' : 'at the bottom'}). Take a new page_snapshot to see new content.`,
      };
    }

    const h = Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
    const step = Math.round(window.innerHeight * 0.8) || 600;
    if (direction === 'down') window.scrollBy(0, step);
    else if (direction === 'up') window.scrollBy(0, -step);
    else if (direction === 'top') window.scrollTo(0, 0);
    else window.scrollTo(0, h);
    const pos = Math.round(window.scrollY);
    const more = pos + (window.innerHeight || 0) < h - 1;
    return {
      ok: true,
      value: `Scrolled ${direction}. Position is now ${pos} of ${h} (${more ? 'more content below' : 'at the bottom'}).${note}`,
    };
  } catch (e) {
    return { ok: false, error: 'scroll failed: ' + (e && e.message ? e.message : String(e)) };
  }
}

export function containsTextFn(text) {
  try {
    const needle = String(text || '').toLowerCase();
    if (!needle) return { ok: false, error: 'text must not be empty' };
    const body = document.body;
    const hay = String((body && (body.innerText ?? body.textContent)) || '').toLowerCase();
    return { ok: true, value: hay.includes(needle) };
  } catch (e) {
    return { ok: false, error: 'wait failed: ' + (e && e.message ? e.message : String(e)) };
  }
}
