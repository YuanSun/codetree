# Fund Accounting Academy

A self-paced training website for fund accountants, from first month on the desk to senior reviewer, with a dedicated
**Advent Geneva** track. Pure static HTML/CSS/JS: no build step, no dependencies.

## Run it

```bash
cd fund-accounting-academy
python3 server.py              # -> http://localhost:13000
python3 server.py --host 0.0.0.0   # open to other devices on your network
```

It also works by opening `index.html` directly, or behind any web server (all links are relative, so it can live under any host or path).
To host it together with the other projects, see [../hosting/README.md](../hosting/README.md).

## What's inside

| Track | Modules |
|---|---|
| **Core fund accounting** | 01 Industry & structures · 02 Accounting fundamentals · 03 The NAV cycle · 04 Instruments · 05 Pricing & fair value · 06 Investor accounting · 07 Fees & waterfalls · 08 Reconciliation & controls · 09 Financial statements & audit |
| **Advent Geneva** | 10 Mental model (entities, lots, ledger, effective vs knowledge date) · 11 Daily & month-end workflow · 12 Reports, recs & troubleshooting |
| **Senior skills** | 13 Review technique, materiality, escalation, owning the close |

Plus: calculators and trainers (`tools.html`: NAV, accrued interest with day counts, management/performance fee with HWM and hurdles,
PE waterfall, IRR/MOIC/DPI/TVPI, P&L allocation, journal-entry trainer), a searchable glossary, and a 5-question quiz at the end of every module.
Progress and quiz scores are saved in the browser's `localStorage` (per device).

## Layout

```
fund-accounting-academy/
├── index.html, tools.html, glossary.html
├── modules/NN-*.html        # one page per module (content lives in the HTML)
├── assets/
│   ├── modules.js           # course map: drives home page, nav, pager, progress
│   ├── quizzes.js           # FAA_QUIZ[moduleId] = [{q, o[], a, w}]
│   ├── glossary.js          # [term, definition, moduleId]
│   ├── calc.js              # pure calculation functions (browser + Node)
│   ├── tools.js             # wires calculators to the DOM
│   ├── app.js, style.css    # shared shell (top bar, TOC, progress, quiz engine)
├── tests/calc.test.js       # node --test tests/calc.test.js
└── server.py
```

## Tests

```bash
node --test tests/calc.test.js
```

## Adding a module

1. Copy an existing `modules/NN-*.html`, change `data-module`, the `<h1>` and content.
2. Add an entry to `assets/modules.js` and questions to `assets/quizzes.js` under the same id.

## A note on the Geneva content

Geneva is configured differently at every firm. Modules 10-12 teach concepts, vocabulary and workflows, and each ends with
"Find it in your Geneva" tasks so you can map them to your own screens and reports. Report and menu names are described by
function, not by exact label. This is independent training material, not an official Advent/SS&C document, and it is not accounting, tax or legal advice.
