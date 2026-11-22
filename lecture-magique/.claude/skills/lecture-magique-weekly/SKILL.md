---
name: lecture-magique-weekly
description: Prepares this week's book for Lecture Magique, Grace's reading site — transcribes the book Ryan gives (PDF, photos or text) into the site's text format, crops its pictures, writes the comprehension questions (chapter questions, closed questions, open questions and one writing task, each with evidence quotes from the text), checks everything and packs it into one zip that `tools/weekly.sh` imports. Also marks Grace's answers when Ryan gives a `reponses-*.json` export from Suivi. Use whenever Ryan says "new book for Lecture Magique", "this week's reading", "prepare the book", "make the questions for <book>", "add evidence/quotes to the questions", or uploads a `reponses-<name>-<date>.json` file and asks to mark or correct it.
---

# Lecture Magique: this week's book

Lecture Magique (repo `YuanSun/codetree`, folder `lecture-magique/`) is a family reading site for Grace, 11, Grade 5
in a French immersion programme (first language English), preparing for the Jean-de-Brébeuf entrance exam. Each week
she reads one book (French, sometimes English), tapping words she doesn't know, then answers comprehension questions.

The code never changes from week to week. What changes is four kinds of files, all in the git-ignored `content/`
folder (books are copyrighted: family use only, **never commit them**):

```
content/<book>.txt                 the text, in the format below
content/<book>.questions.json      the questions
content/images/<book>/*.jpg        the pictures
```

Your job is to produce those files, check them, and give Ryan **one zip**. He then runs one command on the Mac:

```bash
tools/weekly.sh ~/Downloads/<book>-week.zip
```

It builds the pack, checks every evidence quote, imports the book as a draft, shows the word coverage and asks
whether to publish. On a book Grace has already started it refreshes only the questions and pictures.

## 1. Gather

Ask only for what you can't infer: the book (PDF, photos or text), and if unclear, its language and the week
(`week_of` is that week's Monday, `YYYY-MM-DD`). `<book>` is a short lowercase file name (`piege-glace`); the slug is
`YYYY-wWW-<short-title>` (ISO week of `week_of`, e.g. `2026-w48-piege-glace-a-la-plage`).

## 2. The text: `content/<book>.txt`

```
@title Le titre exact
@slug 2026-w48-titre-court
@week_of 2026-11-23
@source_note Auteur, ill. Illustrateur — usage familial uniquement
@author Auteur (texte), Illustrateur (illustrations)
@intro Two or three sentences from the back cover (optional).
@lang en                          ← English books only (default fr)

## 1 Titre du chapitre

@image images/<book>/ch1-classe.jpg

First paragraph, exactly as printed.

– Dialogue line, with the en dash as printed.

@image images/<book>/ch1-bus.jpg | optional caption

## 2 Titre du chapitre 2
```

- Transcribe **faithfully**: same words, punctuation and paragraph breaks. Don't correct, modernise or shorten.
  Straight or curly apostrophes are both fine (the build makes them typographic).
- Blank line between paragraphs; a page break inside a paragraph is not a new paragraph.
- Drop running heads, page numbers and hyphenation at line ends (`châ-teau` → `château`).
- `## n Title` starts a chapter; number them 1, 2, 3… even if the book doesn't.
- An `@image` line puts the picture after the paragraphs above it.

## 3. Pictures: `content/images/<book>/`

Crop each illustration from the scan (no page margins or text), JPEG, about 1200–1600 px wide, **at most 1.5 MB**.
Name them `ch<n>-<word>.jpg`. Skip decorative bits. Typically 2–4 per chapter.

## 4. Questions: `content/<book>.questions.json`

Write the questions in the book's language (French book → French questions, addressed to her as « tu »).

```json
{
  "chapters": {
    "1": {"kind": "open", "prompt": "…", "model_answer": "…",
          "rubric": {"must_answer": "…", "avoid": "…",
                     "evidence": [{"chapter": 1, "quote": "exact words from one paragraph"}]}}
  },
  "questions": [
    {"kind": "choice", "prompt": "…", "model_answer": "why, citing the chapter",
     "rubric": {"skill": "Détail", "points": 1, "choices": ["…", "…", "…", "…"], "correct": 1,
                "evidence": [{"chapter": 1, "quote": "…"}]}},
    {"kind": "open", "prompt": "…", "model_answer": "…",
     "rubric": {"skill": "Inférence", "points": 3, "must_answer": "…", "avoid": "…", "evidence": [ … ]}},
    {"kind": "writing", "prompt": "…", "model_answer": "Réponse libre : what a good answer contains.",
     "rubric": {"skill": "Écriture", "points": 3, "must_answer": "…", "avoid": "…", "evidence": [ … ]}}
  ],
  "focus_words": []
}
```

### The set (same mix every week)

1. **One open question per chapter** (`chapters`), 2 points each (default): checks she understood the chapter.
   Ask *why* or *how*, answerable in one or two sentences from that chapter.
2. **Six closed questions** first in `questions`, 1 point each, marked automatically (one try):
   - 3 multiple choice with 4 options: one detail, one vocabulary-in-context (quote the sentence, ask what the word
     means *here*), one inference;
   - 3 vrai/faux, `"choices": ["Vrai", "Faux"]` (`["True", "False"]` in English); at least one with a trap word
     (« jamais », « toujours », « comme X ») and at least one that is true.
   - `correct` is the index of the right option. Distractors must be plausible from the book, not silly.
3. **Eight open questions + one writing task**, covering her weak points. Use these `skill` labels:
   - *Vocabulaire en contexte*: quote a sentence (with chapter), ask the meaning **and** which words help (2 pts);
   - *Langage figuré* / *Comparaison*: an expression or comparison: meaning, and why it's used here (2 pts);
   - *Négation et détail*: a question whose answer hinges on « ne… pas », « sauf », « personne ne » (2 pts);
   - *Personnage et preuves*: a trait + two proofs from **two different chapters** (3 pts);
   - *Inférence*: something the text implies but doesn't say (3 pts);
   - *Ordre des évènements*: 5–6 lettered events to put in order (2 pts);
   - *Indices (plusieurs chapitres)*: link clues from two moments (2 pts);
   - *Écriture*: one writing task, 3–4 sentences or 8–10 lines, often from a character's point of view or linking
     the book to her life (3 pts).
4. Every open item has a `model_answer` (one good answer, not the only one), `must_answer` (what a full-marks answer
   must contain, listed as parts when there are several) and `avoid` (the likely mistake: too broad, retelling the
   chapter, inventing, answering only half).

Her teacher's rule drives the marking: **answer exactly what is asked**. Questions should therefore be precise and
have a clear scope; two-part questions must say so (« Explique… puis… »).

### Evidence quotes (every question)

`rubric.evidence` lists the passages that hold the answer. After she answers, the site shows them and highlights each
one in the text; the marking export sends them to Claude.

- Copy each `quote` **exactly** from **one paragraph** of the chapter it names: no `[…]`, no paraphrase, no joining
  two paragraphs. Case, spaces and apostrophe style don't matter. Prefer a full sentence or clause (6–30 words).
- 1–3 quotes per question; one per part for two-part questions; one per event for ordering questions; for the
  writing task, the passages it builds on.
- Quote the chapter where the words are, which may differ from the chapter the question is about.

### Book already started

If Grace has answered some questions, keep the `prompt` of those questions **unchanged** (same chapter, same
wording) when editing: a question with a changed prompt counts as a new one, and the old one is retired.

## 5. Check before handing over

If you have the repo, run the real build (it stops on any quote it can't find):

```bash
python3 tools/text2pack.py content/<book>.txt content/<book>.questions.json -o content/<book>.pack.json
```

It ends with `questions: N (6 choice, …), N with evidence`: every question should have evidence. Without the repo,
check each quote yourself: normalise both sides (lowercase, collapse spaces, ’ → ') and confirm the quote is a
substring of one paragraph of that chapter. Also check: chapter numbers in `chapters` and `evidence` exist; every
`choice` has 2+ distinct options and a valid `correct`; points are 1 (closed), 2 or 3 (open/writing).

## 6. Hand over

Zip with the `content/` prefix and give Ryan the file and the command:

```
<book>-week.zip
  content/<book>.txt
  content/<book>.questions.json
  content/images/<book>/…
```

```bash
tools/weekly.sh ~/Downloads/<book>-week.zip
```

Then summarise in English: chapters and words (reading time at ~120 words/min), number of pictures, and the
question set (skills covered, total points).

## 7. Marking her answers

Ryan downloads `reponses-<name>-<date>.json` from **Suivi → 📝 Correction par Claude** and gives it to you. The file
contains its own marking instructions, each question's `must_answer`, `avoid`, `model_answer`, `points` and
`evidence` quotes, and her latest answer.

1. If the book's text is available (`content/<book>.txt` in the repo, or Ryan attaches it), read the passages
   around each evidence quote before reading her answer. Otherwise mark against the evidence quotes.
2. For each answer: list the parts the question requires; check each against the text; anything stated as fact that
   the text doesn't support is invented (her teacher's rule), a missing part costs about half a point. Accept other
   answers the text supports. Score in steps of 0.5, from 0 to `points`.
3. Feedback: 2–3 sentences in the book's language, « tu » / "you": what is good, then **one** concrete fix (point
   to the chapter when she missed evidence), then at most one grammar point. Prefer her known weak spots:
   anglicisms (« il lui aide » → « il l'aide à »), feminine agreement, « plein de » invariable, verb tense after
   « pensait que ».
4. Output exactly
   `{"format": "lecture-magique-grades/1", "grades": [{"answer_id": 123, "score": 1.5, "feedback": "…"}]}`
   with every `answer_id` once, as a `.json` file. Check it with a short script: same ids as the export, every
   score within `0..points` in half points.
5. Tell Ryan in English: the total and percentage, a table (question, score, one-line note) and the two or three
   things to work on. He pastes the JSON into the same Suivi card and clicks **Enregistrer les notes**.
