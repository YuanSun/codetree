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
python3 server.py                  # → http://localhost:8000
```

To use it on a tablet or another computer on the same Wi-Fi:

```bash
python3 server.py --host 0.0.0.0   # then open http://<this-computer's-IP>:8000 on the tablet
```

Weeks are discovered automatically on every request — add or edit a week and just refresh the browser.

## What a week contains (Week 8 as the example)

| Page | What it is |
|---|---|
| **The Quest** (`lesson`) | 14 hands-on labs, one or more per concept, each followed by a *guided* contest example where the child answers every step (the next step only appears when they get the current one). Skill badges unlock as each level is completed. |
| **Exercise Bank** (`practice`) | The 14 exercise-bank questions + 3 optional "boss levels". Pick a skill, then a question. 3-level hint ladder, per-choice *trap* explanations on wrong answers, stars (3 = first try, no hints), contest-pace timer, full written solution afterwards. |
| **Homework** (`homework`) | The 6 homework questions + the optional challenge, same engine. |

Week 8 labs: match-the-skill game · printer (find the amount for ONE) · Elizabeth's walk · meet-up/catch-up car simulator with a
predict-the-time game · share-the-cake ratio bars · change-one-side dressing blocks · multiplier lightning round · price-chain builder ·
undo machine · does-order-matter · level-it-out cube bars · remove-a-number · cumulative-mean decoder · combine-two-groups tug-of-war · median/mode playground.
After solving the Betty & Ann boss question there is also an interactive park simulator.

## Layout

```
MathCompetition/
├── server.py            # the web server (auto-discovers weeks)
├── weekctl.py           # `new` scaffolds a week, `check` validates content
├── static/              # shared CSS + JS engine (core.js: store, XP, guided steps, quiz)
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
python3 weekctl.py new 9 "Geometry & Angles"   # creates weeks/week09/ with working placeholders
# ...fill in lesson.html, exercises.json, homework.json, week.json...
python3 weekctl.py check week09                 # catches bad answer keys, missing hints, etc.
```

Then refresh the browser. The lesson is custom HTML per week (the interesting part: design a lab per concept);
the practice/homework pages are just JSON — see `CLAUDE.md` for the question schema and the authoring recipe
(it is written so a future Claude session can turn a new pair of PDFs into a week the same way).

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
