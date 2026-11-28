# Writing

A page in the Home Hub (`/writing/`, same login as the notes) where Grace studies her corrected French writing.
Every correction report Claude writes for her is listed there, newest first, and opens as is.
The Brébeuf exam notes stay on `/exam/`. This page is only about writing.

## Posting a correction

1. Put the report (`NAME.html`) in the content folder: `writing-tracker/content/` (git-ignored), or the folder named
   by `WRITING_DIR` in `hosting/.env`, for example a `Grace/Writing` folder in the Obsidian vault.
   Start the name with the date (`2026-11-ecole.html`) so it sorts correctly; the title comes from the report.
2. Restart the gateway (`hosting/run.sh` rebuilds the page on start), or rebuild by hand:

```bash
python3 writing-tracker/build.py
```

## Optional: tracking progress (no database)

A report alone is just listed. If you also save a small **scorecard** next to it (`NAME.json`, format below),
the page adds a Progress section: ratings on five fixed criteria, errors by type (counted and per 100 words),
length against the target, and the current priorities, with one column per scored piece.
Ratings and error counts are recorded on a fixed scale so pieces from different months can be compared.

There is no Postgres table. With a few pieces a year, a JSON file next to its report is enough: easy to read, fix
and back up, and nothing has to run. If you ever want SQL across subjects, every scorecard can be loaded as is
(`build.py` also writes all of them to `data.json`). The build stops with a clear message if a scorecard has a typo
(unknown category, rating outside 1 to 4, missing report).

## Scorecard format

```json
{
  "title": "À quoi sert l'école ?",
  "date": "2026-11-20",
  "source": "Examen modèle E-12",
  "words": 225,
  "target_words": 150,
  "ratings": {"organisation": 4, "consigne": 3, "vocabulaire": 2, "syntaxe": 2, "accords": 1},
  "errors": {"pronoms": 10, "genre": 4, "accord": 2, "conjugaison": 2, "prepositions": 5, "vocabulaire": 8, "syntaxe": 1},
  "recurring": ["genre", "accord", "vocabulaire"],
  "priorities": ["Une seule personne grammaticale", "Genre et accord"],
  "report": "2026-11-ecole.html"
}
```

- `date`: `YYYY-MM-DD`, or `YYYY-MM` if the day isn't known. `source` and `report` are optional
  (`report` defaults to the JSON's name with `.html`).
- `ratings`: 1 = À travailler, 2 = À consolider, 3 = Bien, 4 = Très bien. Keys: `organisation`, `consigne`,
  `vocabulaire`, `syntaxe`, `accords`. Leave one out if the report didn't rate it.
- `errors`: number of errors found, per category. Keys: `pronoms` (person/register switches), `genre`, `accord`,
  `conjugaison` (includes pronominal verbs), `prepositions`, `vocabulaire` (wrong word, anglicisms), `syntaxe`,
  `orthographe`, `ponctuation`. Leave out categories with no errors.
- `recurring`: categories the report flags as recurring. `priorities`: the report's work priorities, in order.

Text to give Claude with each new correction:

> Also write a scorecard JSON for the writing-tracker (format in writing-tracker/README.md): ratings 1–4 on
> organisation, consigne, vocabulaire, syntaxe, accords; error counts per category; word count and target.

## Test

```bash
python3 -m unittest discover -s writing-tracker/tests
```
