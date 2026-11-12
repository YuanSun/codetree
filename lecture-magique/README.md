# Lecture Magique

A home French reading site for Grace. She reads an article chapter by chapter, taps any word to see its Petit Robert
definition, and every tap is logged quietly so we can later see which words she struggles with (phase 2: spaced
review). Design: [`docs/DESIGN.md`](docs/DESIGN.md). Engineering rules and phase scope: [`CLAUDE.md`](CLAUDE.md).

**Done:** phase 1 (read, tap, record) and the review half of phase 2: Wiktionary conjugations and English glosses,
the tense of each verb on the card, FSRS scheduling, the Monday *Défi de la semaine* and *Mon sac à mots*.
**Not yet:** model-chosen senses, the parent's weekly report, phase 3 (open answers, writing).

## How the weekly défi works

- Every tap is an FSRS rating (*je ne connais pas* = Again, *ça me dit quelque chose* = Hard, *je connais* = Good;
  first tap of a day only). Taps from before this feature are replayed from `lookup_event` the first time.
- From Monday, the first visit to **⭐ Défi de la semaine** builds the week's défi: up to 15 words, first those due
  before next Monday (most-forgotten first), then words never quizzed (most looked-up first), at most 5 new ones per
  défi (the very first défi may use all 15).
- Question types follow familiarity: English meaning / her own sentence with a blank → Petit Robert definition →
  listen and spell (accents count). Answer wrong → Again; right within 8 s → Good (Easy when very fast on a familiar
  word); right but slow → Hard. A wrong word comes back once at the end as another kind of question, logged only.
- Familiarity 0-5 = FSRS stability once quizzed (<2 d, <7 d, <14 d, <30 d, ≥30 d = gold). Code: `backend/app/review.py`.

```
backend/   FastAPI app (app/), importers (importer/), Alembic migration (migrations/), pytest suite (tests/)
frontend/  React + Vite + TypeScript reader, built into frontend/dist and served by the backend
deploy/    launchd plist, run/deploy scripts, init_role.sql, env.example
tools/     ld2.py + robert_extract.py (Petit Robert parser), text2pack.py (transcription → article pack)
content/   article packs made from books — git-ignored, family use only
```

## First-time setup on the Mac Studio

Follow **[SETUP.md](SETUP.md)**: step by step, with a check after each step and a troubleshooting table. In short:
create the `lecture_app` role (`deploy/init_role.sql`) → fill in `.env` → `deploy/deploy.sh` → import the
dictionary → create accounts → import and publish the book → bookmark it on the iPad and Chromebook.

## Every week: a new article

1. Transcribe or paste the text into `content/<name>.txt` (format in `tools/text2pack.py`; `## n Titre` starts a
   chapter, blank lines separate paragraphs) and write `content/<name>.questions.json`.
2. `python3 tools/text2pack.py content/<name>.txt content/<name>.questions.json -o content/<name>.pack.json`
3. `cd backend && uv run python -m importer.article import ../content/<name>.pack.json`. It prints coverage and the
   unmatched words (full report in `import-reports/`), and the article is a **draft**.
4. Log in as a parent and read it once, then `uv run python -m importer.article publish <slug>`.

The first book, *Méga trouille au château*, is already transcribed from the PDF scan as
`content/mega-trouille.pack.json` (6 chapters, ~5,700 words, one reflection question per chapter + 5 whole-book
questions). It's copyrighted, so it stays out of git.

## Tests

```bash
cd backend
TEST_DATABASE_URL=postgresql+psycopg://postgres:test@localhost:55432/lecture_test uv run pytest
```

Use a throwaway Postgres (e.g. `docker run -d -p 55432:5432 -e POSTGRES_PASSWORD=test postgres:16`). The suite
creates `lecture_test` if needed, drops and recreates the `lecture` schema in it, and refuses to run against any
database that has a `family_budget` schema (i.e. the real one). Tests use only
invented dictionary entries and a Jules Verne excerpt (public domain).

## Implementation notes (decisions not spelled out in the design)

Schema additions (all additive; flagged here because CLAUDE.md asks to raise data-model changes):

| Change | Why |
|---|---|
| `lemma.homograph`, unique key `(lemma, pos, homograph)` instead of `(lemma, pos)` | Robert homographs (`1. livre` / `2. livre`) share lemma and POS |
| `sense.seq` + unique `(lemma_id, source, seq)` | lets the dictionary import be an idempotent upsert, and fixes sense order |
| `lookup_event.client_event_id` (unique UUID) + `received_at` | a batch the tablet retries is stored once; `created_at` is the tap time |
| `token.morph` (migration 0002) | spaCy grammar of each occurrence (*Tense=Pres, Person=3…*), so the card shows the tense of the word in its sentence |

Other choices:

- API is under `/api/...` (e.g. `/api/auth/login`) so it never collides with the front end; front end uses hash routes.
- Sense examples are stored in `sense.raw->'examples'` (up to 6), the first also in `example_fr`.
- Session cookie is signed (no session table) and includes a fragment of the password hash, so a password change
  logs out every device. Login lockout is in process memory (single uvicorn worker).
- Word matching order: spaCy lemma + POS → surface in `word_form` → lemma any POS → a small suffix heuristic for
  spaCy misses (`beaux` → beau, `remarqués` → remarquer). Unknown hyphenated words fall back to their parts.
  Proper nouns stay unmatched; the import report gives coverage with and without them.
- Exposure (“seen but not tapped”) counts words in her word bag that appear in the chapter and were not tapped since
  the chapter was opened.
- The card also offers “Autres sens” (collapsed): until phase 2 picks the sense per sentence, the first Robert sense
  is often not the one in the text (the `entamer` case).
- Chapter-end question is shown as something to think about only; answers are phase 3.
- Wiktionary (`importer.wiktionary`, kaikki.org extract, CC BY-SA) supplies conjugation tables and inflected forms
  as `word_form` rows with codes like `ind.pres.3s`, plus English glosses as `sense` rows with
  `source='wiktionary_en'`. Verbs/nouns/adjectives missing from Petit Robert get a lemma row. When spaCy tags a word
  as a verb, the matcher prefers verb forms, so *demande* → **demander** rather than the noun.
  `importer.article rematch` re-matches already-imported books in place (token ids, hence lookups, are kept).
- `focus_words` in a pack are reported but not stored yet (no table for them until the phase 2 quiz).

## Not verified here

Built and tested in a Linux container: Postgres 16, headless Chromium at iPad, Chromebook and phone sizes (card in
~5 ms after a tap, text rebuilt character for character, events survive reload). Still to check on the real setup:
the import of the real `.ld2` (the `entamer` check and real coverage), Safari on the iPad and the Chromebook itself,
which French voices each one has, and `deploy.sh` / launchd on macOS.
