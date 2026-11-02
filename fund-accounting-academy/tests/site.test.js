// Run:  node --test tests/site.test.js   Static checks that catch broken pages before a browser does.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const pages = [
  ...["index.html", "tools.html", "glossary.html", "search.html", "flashcards.html"],
  ...fs.readdirSync(path.join(ROOT, "modules")).map((f) => "modules/" + f)
];
const widgetsSrc = fs.readFileSync(path.join(ROOT, "assets/widgets.js"), "utf8");

test("every data-widget in a page has an implementation and the page loads widgets.js + calc.js", () => {
  for (const p of pages) {
    const html = fs.readFileSync(path.join(ROOT, p), "utf8");
    const names = [...html.matchAll(/data-widget="([^"]+)"/g)].map((m) => m[1]);
    for (const n of names) assert.ok(widgetsSrc.includes(`W["${n}"]`), `${p}: unknown widget ${n}`);
    if (names.length) { assert.match(html, /assets\/widgets\.js/, p); assert.match(html, /assets\/calc\.js/, p); }
  }
});

test("every script and stylesheet a page references exists", () => {
  for (const p of pages) {
    const dir = path.dirname(path.join(ROOT, p));
    const html = fs.readFileSync(path.join(ROOT, p), "utf8");
    for (const m of html.matchAll(/(?:src|href)="([^"#?:]+\.(?:js|css))"/g)) assert.ok(fs.existsSync(path.join(dir, m[1])), `${p}: missing ${m[1]}`);
  }
});

test("module pages are registered and quizzes exist for each", () => {
  const vm = require("vm");
  const sb = { window: {} };
  for (const f of ["modules.js", "quizzes.js"]) vm.runInNewContext(fs.readFileSync(path.join(ROOT, "assets", f), "utf8"), sb);
  for (const m of sb.window.FAA_MODULES) {
    assert.ok(fs.existsSync(path.join(ROOT, "modules", m.file)), m.file);
    assert.ok(m.icon, `module ${m.id} has no icon`);
    assert.ok((sb.window.FAA_QUIZ[m.id] || []).length >= 4, `module ${m.id} needs quiz questions`);
  }
});
