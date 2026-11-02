/* Search ranking over window.FAA_INDEX (see scripts/build-search.js). Pure functions: browser + Node. */
(function (root) {
  "use strict";

  /* British -> American spellings so "equalisation" finds "equalization" (applied to query and text alike). */
  const norm = (s) => s.toLowerCase().replace(/([a-z])is(ation|ations|e|ed|es|ing)\b/g, "$1iz$2");
  /* Words, keeping things like "t+1" and "30/360" whole; hyphenated terms split ("high-water"). */
  const STOP = new Set("a an the is are was be of to in on for and or vs what whats how why do does did i we you it this that with about".split(" "));
  const tokens = (q) => {
    const all = norm(q).match(/[a-z0-9]+(?:[+\/][a-z0-9]+)*/g) || [];
    const kept = all.filter((t) => t.length > 1 && !STOP.has(t));
    return kept.length ? kept : all.filter((t) => t.length > 1 || all.length === 1);
  };

  /* Matches only at the start of a word, so "count" does not hit "accounting" but "redeem" hits "redemption". */
  const reCache = new Map();
  const wordRe = (t) => {
    let r = reCache.get(t);
    if (!r) { r = new RegExp("(?:^|[^a-z0-9])" + t.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&"), "g"); reCache.set(t, r); }
    r.lastIndex = 0;
    return r;
  };
  const count = (str, t) => (str.match(wordRe(t)) || []).length;
  const normCache = new WeakMap();
  const prepared = (e) => {
    let v = normCache.get(e);
    if (!v) { v = { h: norm(e.h), x: norm(e.x) }; normCache.set(e, v); }
    return v;
  };

  /* All terms must appear (AND). If nothing matches that way, fall back to ANY term, ranked by how many matched. */
  function search(index, query, limit = 20) {
    const toks = tokens(query);
    if (!toks.length) return [];
    const phrase = norm(query).replace(/[^a-z0-9+\/]+/g, " ").trim();
    const run = (needAll) => {
      const out = [];
      for (const e of index) {
        const { h, x } = prepared(e);
        let hits = 0, score = 0;
        for (const t of toks) {
          const inH = count(h, t) > 0, cnt = count(x, t);
          if (inH || cnt) hits++;
          if (inH) score += 6 + (h.startsWith(t) ? 3 : 0);
          score += Math.min(cnt, 5);
        }
        if (needAll ? hits < toks.length : hits === 0) continue;
        const hPlain = h.replace(/[^a-z0-9+\/]+/g, " ").trim();
        if (hPlain === phrase) score += 40;            // exact heading / glossary term
        else if (hPlain.includes(phrase)) score += 12;
        if (x.includes(phrase)) score += 6;
        if (e.k === "term") score += 4;                // definitions answer "what is X?"
        if (e.k === "tool") score += 2;
        score += hits * 3;
        out.push({ entry: e, score });
      }
      return out.sort((a, b) => b.score - a.score).slice(0, limit);
    };
    const strict = run(true);
    return strict.length || toks.length === 1 ? strict : run(false);
  }

  /* A short excerpt around the first matching term. */
  function snippet(text, query, width = 170) {
    const toks = tokens(query);
    const low = norm(text); // same length as the text for the spellings handled, so offsets line up
    let at = -1;
    for (const t of toks) { const i = low.search(wordRe(t)); if (i !== -1 && (at === -1 || i < at)) at = i; }
    if (at === -1) return text.slice(0, width) + (text.length > width ? "…" : "");
    const start = Math.max(0, at - 50);
    return (start ? "…" : "") + text.slice(start, start + width) + (start + width < text.length ? "…" : "");
  }

  const api = { tokens, search, snippet };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FAA_SEARCH = api;
})(typeof window !== "undefined" ? window : globalThis);
