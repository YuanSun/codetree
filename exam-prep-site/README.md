# Exam Prep site

A small static website for Grace's exam-preparation notes (kept in Apple Notes under `JeanDeLaMennais/ExamPreparation`).
It lists every note by month, filters by subject (Math, Logic, French, Writing, Interview), searches the text, and opens the
attached PDFs and HTML reports inline. Served by the hosting gateway at `/exam/`.

The notes are private, so neither the exported notes (`content/`) nor the built site (`hosting/sites/exam`) are committed.

```bash
# 1. On the Mac that has the notes (needs pandoc: brew install pandoc). SKIP leaves out notes whose title contains a word.
SKIP="紫微" ./export_apple_notes.py ExamPreparation ~/exam-export
# 2. Build the static site into ../hosting/sites/exam
./build.py ~/exam-export
```

If the notes are on a different Mac from the gateway, build here and copy only the finished site:

```bash
rsync -a ../hosting/sites/exam/ user@gateway-mac:<repo>/hosting/sites/exam/
```

Re-run both steps whenever the notes change. Subjects are guessed from keywords in titles and attachment names (`SUBJECTS` in `build.py`).
