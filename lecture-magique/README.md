# Lecture Magique

A home French reading site for Grace. She reads an article chapter by chapter, taps any word to see its Petit Robert
definition, and every tap is logged quietly so we can later see which words she struggles with (phase 2: spaced
review). Design: [`docs/DESIGN.md`](docs/DESIGN.md). Engineering rules and phase scope: [`CLAUDE.md`](CLAUDE.md).

**Done:** phase 1 (read, tap, record) and the review half of phase 2: Wiktionary conjugations and English glosses,
the tense of each verb on the card, FSRS scheduling, the Monday *Défi de la semaine* and *Mon sac à mots*.
Children get **📊 Mes progrès** (their own data only). Parents get a **📊 Suivi** page (log in with a `parent` account): minutes read and words looked up per week,
défi scores, the hardest words with the sentence where she met them, and books in progress. The same data is
available in the terminal: `psql -d postgres -v kid=grace -f tools/progress.sql`.
**English reading:** English texts next to the French books (bookshelf switch 🇫🇷 / 🇬🇧), English word card from
English Wiktionary, a separate English weekly challenge and word bag, Suivi / Mes progrès per language. Setup:
[SETUP.md → English reading](SETUP.md#english-reading-optional-once).
**Not yet:** model-chosen senses, phase 3 (open answers, writing).

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

1. Give Claude the book (PDF, photos or text) and say "new book for Lecture Magique". The skill in
   [`.claude/skills/lecture-magique-weekly/SKILL.md`](.claude/skills/lecture-magique-weekly/SKILL.md) tells it exactly what
   to make: `content/<book>.txt`, the pictures in `content/images/<book>/`, and `content/<book>.questions.json`
   (one question per chapter, 6 closed questions, 8 open + 1 writing, each with `evidence` quotes from the text).
   It hands you one zip, `<book>-week.zip`.
2. On the Mac:

   ```bash
   tools/weekly.sh ~/Downloads/<book>-week.zip
   ```

   It unpacks the zip into `content/`, builds the pack (stopping on any evidence quote not found in the text),
   imports the book as a draft, prints the word coverage and unmatched words (full report in `import-reports/`), and
   asks whether to publish. `--publish` publishes without asking, `--draft` leaves it as a draft.
   Already in `content/`? `tools/weekly.sh <book>`. On a book Grace has already started, it refreshes only the
   questions and pictures and keeps her taps and answers.

The formats are in `tools/text2pack.py` (text) and the skill (questions). A closed question is
`{"kind": "choice", "prompt": "Vrai ou faux ? …", "model_answer": "why", "rubric": {"points": 1,
"choices": ["Vrai", "Faux"], "correct": 1}}`. Evidence is `"evidence": [{"chapter": 4, "quote": "exact words"}]` in a
question's `rubric`: copied from one paragraph of that chapter, no `[…]`.

Claude Code sessions on this repo load the skill automatically (it is in `.claude/skills/`). To use it in a claude.ai
chat too, zip the `.claude/skills/lecture-magique-weekly/` folder and upload it under claude.ai → Settings →
Capabilities → Skills. Edit it here; re-upload the zip after a change.

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
| `reading_day` table (migration 0003) | reading seconds per child, book and day, for the weekly minutes chart (`reading_progress.seconds_read` keeps the per-book total) |
| `illustration` table (migration 0005) | pictures between paragraphs (`after_seq`, 0 = top of chapter), stored as `bytea` so a pack import brings them; served by `GET /api/illustrations/{id}` to whoever may read the chapter |
| `lang` on `lemma`, `article`, `quiz` (migration 0004); lemma key `(lang, lemma, pos, homograph)`, quiz key `(user_id, week_of, lang)` | English reading in the same tables: the French and English dictionaries never mix, one défi per language per week |
| `token.morph` (migration 0002) | spaCy grammar of each occurrence (*Tense=Pres, Person=3…*), so the card shows the tense of the word in its sentence |

Other choices:

- API is under `/api/...` (e.g. `/api/auth/login`) so it never collides with the front end; front end uses hash routes.
- Sense examples are stored in `sense.raw->'examples'` (up to 6), the first also in `example_fr`.
- Session cookie is signed (no session table) and includes a fragment of the password hash, so a password change
  logs out every device. Login lockout is in process memory (single uvicorn worker).
- Word matching order: spaCy lemma + POS → surface in `word_form` → lemma any POS → a small suffix heuristic for
  spaCy misses (`beaux` → beau, `remarqués` → remarquer). Unknown hyphenated words fall back to their parts.
  Proper nouns stay unmatched; the import report gives coverage with and without them.
- A word tapped by mistake can be taken out of the word bag (“Retirer de mon sac”, with Annuler): `user_word.status`
  becomes `ignored`, so the bag, the défi and the reviews skip it and its open défi questions are dropped. The
  lookup log is kept, and tapping the word again while reading puts it back.
- Exposure (“seen but not tapped”) counts words in her word bag that appear in the chapter and were not tapped since
  the chapter was opened.
- The card also offers “Autres sens” (collapsed): until phase 2 picks the sense per sentence, the first Robert sense
  is often not the one in the text (the `entamer` case).
- Comprehension questions (`#/questions/<id>`, from the last chapter's “Répondre aux questions” button or the
  “❓ Questions n/m” chip on the shelf): the chapter questions plus an end-of-reading set (vocabulary in context,
  figurative language, negation, character + evidence, order of events, inference across chapters, a writing
  question), aimed at Grace's reading weak points. Answers go to `lecture.answer`, one row per save, so earlier
  versions stay. The model answer and “a good answer includes / be careful not to” are sent only once she has saved
  her own answer, behind “Voir une réponse possible”. Parents see her latest answers next to the model answers in
  Suivi. Points and the skill label live in `question.rubric` (`points`, `skill`), so no schema change.
- Closed questions (`"kind": "choice"`): multiple choice or vrai/faux, with `rubric.choices` (the options) and
  `rubric.correct` (the right one's index); `model_answer` is the explanation shown afterwards. One try, marked at
  once (`graded_by = 'auto'`), never sent to Claude. They come before the open questions, as an easier warm-up.
- While answering, “📖 Relire le chapitre n” (or “Ouvrir le texte”) opens the chapter text on the same page: a
  second column on a wide screen, pinned above the questions on a narrow one, with tabs to change chapter.
- Marking by Claude (Suivi → “📝 Correction par Claude”): download or copy the latest unmarked answers
  (`GET /parent/children/{id}/grading-export`, `?regrade=true` for all) with each rubric and marking instructions
  that ask for JSON back; paste Claude's reply (fences and surrounding text are fine) to store `answer.score`,
  `feedback` and `graded_by` (`POST /parent/grades`, all or nothing, scores in half points up to the question's
  points; chapter questions count 2). Grace sees “📝 Note” and the comment under the question; after she rewrites an
  answer the old comment stays, marked as for her previous version, and the new version goes out in the next export.
- Wiktionary (`importer.wiktionary`, kaikki.org extract, CC BY-SA) supplies conjugation tables and inflected forms
  as `word_form` rows with codes like `ind.pres.3s`, plus English glosses as `sense` rows with
  `source='wiktionary_en'`. Verbs/nouns/adjectives missing from Petit Robert get a lemma row. When spaCy tags a word
  as a verb, the matcher prefers verb forms, so *demande* → **demander** rather than the noun.
  `importer.article rematch` re-matches already-imported books in place (token ids, hence lookups, are kept).
- English (`importer.wiktionary_en`): lemmas with `lang='en'`, up to 6 definitions per word in `sense.gloss_en`
  (source `wiktionary_en`) with short examples, inflected forms in `word_form` with codes `3s`, `past`, `pp`,
  `ing`, `pl`, `cmp`, `sup`. Proper names, multi-word phrases and obsolete / rare / vulgar senses are left out;
  spelling variants (*colour*, *brand-new*) get the main entry's definitions. English packs (`"lang": "en"`) use
  `en_core_web_sm`; words with an apostrophe stay whole (*don't*, *it's*) and a possessive *'s* is split off when the
  whole word is not in the dictionary. Acronyms are not matched to ordinary words (*no* ≠ NO).
- `focus_words` in a pack are reported but not stored yet (no table for them until the phase 2 quiz).

## Not verified here

Built and tested in a Linux container: Postgres 16, headless Chromium at iPad, Chromebook and phone sizes (card in
~5 ms after a tap, text rebuilt character for character, events survive reload). Still to check on the real setup:
the import of the real `.ld2` (the `entamer` check and real coverage), Safari on the iPad and the Chromebook itself,
which French voices each one has, and `deploy.sh` / launchd on macOS.
