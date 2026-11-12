# MathCompetition — authoring playbook

The owner adds a new week's **lecture slides + homework (PDF)** every week. Turn them into a new `weeks/weekNN/`
for an **11-year-old**. Goal: the child *understands the concept by interacting* — not a slide viewer, not "play video + Next".

## Recipe

1. **Read every page of both PDFs** (`Read` with `pages`, ≤20 per call; slides are mostly images). Capture the *instructor's handwritten
   annotations* too — they hold the real insights (e.g. "to undo a percent, divide", "meet-up = add speeds, catch-up = subtract").
2. `python3 weekctl.py new <n> "<title>"`, fill `week.json` (title, tagline, skills, credit, pages).
3. **Lesson** (`lesson.html` + `lesson.js` + `lesson.css`, hand-built): per concept → a *lab* the child manipulates (sliders, tap-to-move,
   build-a-chain, simulate…) **plus** a `MC.guided` worked example for each slide contest question where the child answers each step.
   Prefer *predict → try → see why*. Add a game loop where it fits (predict the time, lightning round). Register each guided/lab with a
   task id; set `"tasks"` in `week.json` to the exact number of ids; group ids into skill badges (see `SKILLS` in `weeks/week08/lesson.js`).
4. **Practice / homework** (`exercises.json`, `homework.json`): retype every question as text (never paste PDF images). Figures → small SVG/HTML
   widgets in `figures.js` registered in `MC.widgets` (`figure` shows in the question, `explorer` appears after solving).
5. **Verify**: compute every answer independently (Python), then `python3 weekctl.py check weekNN`, `python3 -m unittest discover -s tests`,
   and drive the pages in headless Chromium (Playwright is preinstalled: `require('playwright')`) — solve every lab through the UI, assert
   no console/page errors, and **look at screenshots** (they caught real bugs the DOM assertions missed).

## Two tracks: contest vs school study

`weeks/` = **Math Contest Lab** (CJMC / Gauss, "Week N", contest voice: sources like "Gauss 2017 Q9", contest-pace timers, "Gauss Hero" levels).
`study/` = **School Study** (normal class sheets, "Sem N"): same recipe and same engine, but never label it as contest prep.
- Create with `python3 weekctl.py new <n> "<title>" --study` → `study/semNN/` (adds `data-track="study"` to the lesson `<body>` — copy that
  attribute onto any lesson you hand-build, and use the unit id (`sem05`) in `data-week`, in `lesson.js`'s `WEEK` and in `MC.guided` ids).
- Cite the class sheet (`Hu Education 190-Grace · Sem-5 · Exercice 3a`), not a contest. Pages are usually `lesson` (Quest) + `practice` (Class Sheet).
- A ready-made single-file HTML (e.g. a `kid-study-playground` page) is dropped in as `study/<id>/page.html` with `"standalone": true` in `week.json`.
- Progress keys are per unit id, so `sem05` and `week05` would never collide; `week.json` may set `"label"` (e.g. "Sem 5 + 6").

## Past exams: the `exam` page type

For a full past paper (CJMC / Gauss) use a unit like `weeks/cjmc2021-exam2/` with two pages built from ONE `exercises.json`:
`{"slug":"exam","type":"exam",…}` (timed mock exam, `static/js/exam.js`) and `{"slug":"practice","type":"quiz",…}` (hints / traps / solutions).
- The JSON is a normal quiz file plus an `"exam"` block (`minutes`, `blank` = points for an unanswered question, `review` = quiz slug, `rules[]`) and
  `points` on every group (a question's `skill` names its group: Part A 4, Part B 5, Part C 7). `weekctl check` enforces this.
- Wrong = 0, blank = `blank`: the intro and the results explain why guessing blindly does not pay (that is the contest's own rule).
- `"number": 8.5` + `"label": "Exam 2"` in `week.json` slots the unit between weeks on the home page (sorted newest first).
- Every diagram must be redrawn in `figures.js` (the child never sees the PDF); verify answers independently — for puzzles, with a solver
  (see how Q15's hexagon grid has a unique solution) — and zoom the PDF page (`pdftoppm -r 220`) before trusting a fold/diagram question.
- An in-progress attempt is saved in `localStorage` (`mc.exam.<unit>.<slug>`), the result in the normal progress store.

## Question schema (`exercises.json` / `homework.json`)

```jsonc
{ "title": "", "eyebrow": "", "intro": "",
  "groups": [ {"id":"rates","label":"Rates","emoji":"🚗","color":"#3b82f6"} ],   // optional → skill tabs; omit for one flat list
  "questions": [ {
    "id": "ex01", "skill": "rates",            // skill must match a group id when groups exist
    "difficulty": "easy|medium|medium-hard|hard", "source": "Gauss 2017, Grade 8 — Q9",
    "title": "optional", "skillLabel": "optional tag", "optional": false,
    "text": "HTML allowed. [[3/8]] = stacked fraction, **bold**, *italic*",
    "figure": {"type":"receipt|barchart|park", ...} /* or raw HTML */, "explorer": {"type":"park","interactive":true},
    "choices": ["…","…"], "answer": 3,         // 0-based index
    "hints": ["nudge: what is it asking?", "set-up", "almost everything"],      // ladder of 3
    "traps": { "1": "why a child picks B and what to check — never just 'wrong'" },   // keys = choice indexes
    "solution": ["step", "step → **(D)**"], "idea": "one-line skill reminder" } ] }
```

## Lesson structure (what made Week 8 work after the first version felt like "the PDF in HTML")

- Each skill is a **world**: coloured `.world-banner` → Nova line → big idea → an **explorer** that teaches the *concept* (no contest numbers yet:
  speed triangle, ratio scaler, 100-square, balance beam) → labs → **mission cards** for the slide questions.
- A **mission card** (`.mission`) = source tag + one kid-language `.ask` (+ a small emoji `.scene`); the verbatim contest wording lives in a
  collapsed `<details>`. Never paste the slide text as the main content.
- Every explorer/lab ends in a short `MC.guided` challenge that registers a task id — that is what gives badges/progress meaning.
- Keep feedback **inside the viewport**: the first matching game put the answers below the fold and only toasted on mistakes, so it felt dead.
  One big card + answer buttons directly under it + inline message fixed that.
- Never re-render a node the user is dragging (slider/pointer drags die if the element is replaced) — update values, don't rebuild.
- SVG that rotates (balance beam) needs a tall enough `viewBox` for the worst-case tilt; test the extremes with screenshots.

## Voice & design rules

- Reading level ~Grade 5–6, short sentences, warm, never shaming. A wrong answer is a *clue about the trap*, not a red cross.
- Only write a `trap` that is a **real, checkable misconception** (e.g. averaging averages, adding percents). Do not guess a story
  about why a number was picked — if unsure, say what to re-check instead.
- Hints must not give the answer until the last rung. Solutions show the *thinking*, and a shortcut when there is one.
- Keep the slides' habit-phrases (e.g. "Find ONE first", "Percent is a multiplier", "Work with the total") — repeat them, they are the point.
- The child should *do* the step (type/choose/build); the UI never reveals the next step on a plain "Next" button.

## Gotchas learned building Week 8

- `el.replaceChildren(maybeNull)` writes the text **"null"** — use `MC.fill(el, …)` when any child can be null.
- `[[a/b]]` in *static* lesson HTML is not auto-formatted; `lesson.js` runs `MC.fmt` over `.problem, .callout` at load.
- Badge pop-ups cover the page until clicked (intended) — automated tests must dismiss `.badge-pop`.
- Don't use `str.format` on templates that contain JS braces (use token `.replace`). `weekctl new` round-trip test exists for this.
- Slide contest problems often give no concrete numbers ("original price unknown") — teach the *pick an easy number* trick, then note the answer is the same.
- Progress lives in `localStorage` key `mc.progress.v1` (`weeks[weekId][pageSlug][itemId]`); items count as done when `done` is set.
- Original PDFs go in `weeks/weekNN/source/` (git-ignored). Credit CEMC / The Learning Lab in `week.json` → `credit`.
