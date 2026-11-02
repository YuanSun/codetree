// Run:  node --test tests/search.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const S = require("../assets/search.js");
const B = require("../scripts/build-search.js");

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../assets/search-index.js"), "utf8"), sandbox);
const INDEX = sandbox.window.FAA_INDEX;
const top = (q, n = 3) => S.search(INDEX, q, n).map((r) => r.entry);

test("committed search index is up to date (run scripts/build-search.js)", () => {
  assert.equal(JSON.stringify(INDEX), JSON.stringify(B.build()));
});

test("a glossary term ranks first for its own name", () => {
  assert.equal(top("high-water mark")[0].k, "term");
  assert.match(top("knowledge date")[0].h, /Knowledge date/i);
  assert.equal(top("HWM")[0].h.toLowerCase().includes("high-water"), true);
});

test("concept searches land in the right module", () => {
  assert.ok(top("equalization", 5).some((e) => e.m === "06"));
  assert.ok(top("day count", 5).some((e) => e.m === "04"));
  assert.ok(top("lot relief", 5).some((e) => e.m === "02" || e.m === "10"));
  assert.ok(top("bitemporal", 5).some((e) => e.m === "10"));
});

test("calculators are findable", () => {
  assert.ok(top("accrued interest calculator", 5).some((e) => e.k === "tool"));
});

test("results deep-link to an existing anchor", () => {
  for (const r of S.search(INDEX, "waterfall", 10).filter((r) => r.entry.k === "module")) {
    const [file, id] = r.entry.u.split("#");
    if (!id) continue;
    assert.ok(fs.readFileSync(path.join(__dirname, "..", file), "utf8").includes(`id="${id}"`), r.entry.u);
  }
});

test("multi-word query falls back to any-term and nonsense returns nothing", () => {
  assert.ok(S.search(INDEX, "nav zzzzqqq", 5).length > 0);
  assert.equal(S.search(INDEX, "zzzzqqq", 5).length, 0);
  assert.equal(S.search(INDEX, "", 5).length, 0);
});

test("snippet is centred on the match", () => {
  const s = S.snippet("a".repeat(300) + " crystallization happens annually " + "b".repeat(300), "crystallization");
  assert.ok(s.includes("crystallization") && s.startsWith("…"));
});
