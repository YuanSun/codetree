# Math Contest Lab 🧪

Interactive, kid-friendly versions of the weekly math-contest prep materials (CJMC / Gauss level, ages ~11).
Each week's slides and homework become a small website the child can *play with*: drag sliders, predict-then-check,
build answers step by step, earn stars and badges — instead of reading slides or pressing "next".

- **Server**: plain Python 3 standard library — **no `pip install`** needed.
- **Front end**: vanilla HTML/CSS/JS (works offline, no build step).
- **Progress** (XP, stars, badges) is saved in the browser (`localStorage`) — per device, nothing leaves the machine.

## Run it

```bash
cd MathCompetition
python3 server.py                  # → http://localhost:12998
```

To use it on a tablet or another computer on the same Wi-Fi:

```bash
python3 server.py --host 0.0.0.0   # then open http://<this-computer's-IP>:12998 on the tablet
```

Weeks are discovered automatically on every request — add or edit a week and just refresh the browser.

## What a week contains (Week 8 as the example)

| Page | What it is |
|---|---|
| **The Quest** (`lesson`) | 18 hands-on labs, one or more per concept, each followed by a *guided* contest example where the child answers every step (the next step only appears when they get the current one). Skill badges unlock as each level is completed. |
| **Exercise Bank** (`practice`) | The 14 exercise-bank questions + 3 optional "boss levels". Pick a skill, then a question. 3-level hint ladder, per-choice *trap* explanations on wrong answers, stars (3 = first try, no hints), contest-pace timer, full written solution afterwards. |
| **Homework** (`homework`) | The 6 homework questions + the optional challenge, same engine. |

Each skill "world" opens with a concept **explorer** — speed triangle (cover a corner to get the formula) · ratio scaler (make copies, the mix never changes) · 100-square percent grid · balance beam (the mean is the see-saw's balance point; drag the weights and the pivot) — guided by a friendly fox, Nova. Contest questions appear as short kid-language *mission cards*, with the exact contest wording one tap away.

Week 8 labs: flashcard match-the-skill game · printer (find the amount for ONE) · Elizabeth's walk · meet-up/catch-up car simulator with a
predict-the-time game · share-the-cake ratio bars · change-one-side dressing blocks · multiplier lightning round · price-chain builder ·
undo machine · does-order-matter · level-it-out cube bars · remove-a-number · cumulative-mean decoder · combine-two-groups tug-of-war · median/mode playground.
After solving the Betty & Ann boss question there is also an interactive park simulator.

## Two tracks: contest lab and school study

One server, one engine, two clearly separate sections:

| Track | URL | Folder | What it is |
|---|---|---|---|
| 🧪 **Math Contest Lab** | `/` and `/week/<id>/` | `weeks/weekNN/` | Weekly CJMC / Gauss contest prep (Weeks 7, 8, …) |
| 📚 **School Study** | `/study/` and `/study/<id>/` | `study/semNN/` | Normal class sheets (Hu Education Sem-5, Sem-6, …) — *not* contest prep |

The study track has its own home page, teal colours, a "📚 Study" navigation bar and plain "⭐ XP" (no contest level names); the two home pages
link to each other. Behind the hosting gateway the study track lives at `/math/study/` and has its own card on the portal.

| Unit | Topic | Source |
|---|---|---|
| `study/sem05` | **Fractions** — a fraction *of* a fraction, brackets & dividing by a fraction, the farm problem. Quest + Class Sheet | Hu Education 190-Grace, Sem-5 sheet |
| `study/sem06` | **PPCM & PGCD** — beep race, prime-factor bubbles, divide-down ladder, marble bags, fractions review. Quest + Class Sheet | Hu Education 190-Grace, Sem-6 sheet |
| `study/sem0506` | **Parcours d'étude** — French study playground for both sheets: fractions, PPCM/PGCD, pronoms relatifs, subordonnées (14 exercises, animated steps, read-aloud). *Standalone page* | same sheets |
| `weeks/week07` | **Area & Perimeter** — *Math Detective* (standalone page, see below) | The Learning Lab, Week 7 homework |
| `weeks/week08` | Rates, Ratio, Percent & Mean (described above) | The Learning Lab, Week 8 |

The Sem-5/6 Quests and Class Sheets keep the sheet's original French in the questions; help text is in English.
Shared lesson styling lives in `static/css/lesson-common.css` (new lessons can link it instead of copying Week 8's CSS).

## Layout

```
MathCompetition/
├── server.py            # the web server (auto-discovers weeks)
├── weekctl.py           # `new` scaffolds a week, `check` validates content
├── static/              # shared CSS + JS engine (core.js: store, XP, guided steps, quiz)
├── study/               # School Study track: study/sem05, sem06, sem0506 … (same layout as a week)
├── templates/layout.html
├── tests/               # python3 -m unittest discover -s tests
└── weeks/
    └── week08/
        ├── week.json        # title, tagline, list of pages  ← drives the home page + hub
        ├── lesson.html/.js/.css   # hand-built interactive lesson (different every week)
        ├── exercises.json   # question bank   (data-driven quiz page)
        ├── homework.json    # homework        (data-driven quiz page)
        ├── figures.js       # figures/explorers used by quiz questions (receipt, bar chart, park)
        └── source/          # ← drop the original PDFs here (git-ignored, never served)
```

## Adding a new week

```bash
python3 weekctl.py new 9 "Geometry & Angles"   # creates weeks/week09/ with working placeholders (contest lab)
python3 weekctl.py new 7 "Decimals" --study    # creates study/sem07/ (school study track)
# ...fill in lesson.html, exercises.json, homework.json, week.json...
python3 weekctl.py check week09                 # catches bad answer keys, missing hints, etc.
```

Then refresh the browser. The lesson is custom HTML per week (the interesting part: design a lab per concept);
the practice/homework pages are just JSON — see `CLAUDE.md` for the question schema and the authoring recipe
(it is written so a future Claude session can turn a new pair of PDFs into a week the same way).

## Adding an extra page to an existing week (e.g. a standalone HTML tool from class)

Got a ready-made page — like the Week 7 *Math Detective*? Drop the file into the week's folder and list it in that week's `week.json`:

```jsonc
{ "slug": "detective", "type": "html", "standalone": true, "file": "math_detective.html",
  "title": "Math Detective", "emoji": "🕵️", "desc": "8 mystery missions…" }
```

`"standalone": true` means the page has its own `<html>`, styles and scripts, so the server serves it as-is and only adds a small
**🧪 Math Lab / ‹ Week N** pill (bottom-left) for getting back. It appears as a new card on that week's hub — refresh, no restart.
Standalone pages keep their own state, so omit `"tasks"` (the hub then hides the progress bar for that card).
Pages built with the shared engine (`MC.guided`, quizzes) should leave `standalone` off and use the nav bar as in Week 8.

## Tests

```bash
python3 -m unittest discover -s tests
```

Covers routing, path-traversal protection, JSON embedding and the content checker (including a check that
every week's answer keys are valid indices). The Week 8 answer keys were additionally verified independently by computing each problem.

## Notes

- **Reset progress**: in the browser console run `localStorage.removeItem('mc.progress.v1')`.
- **Copyright**: the contest questions are © CEMC, University of Waterloo (CJMC & Gauss) and the slides are from The Learning Lab;
  they are retyped here for personal study. The original PDFs are git-ignored — keep this repo private if it holds more than the retyped text.
