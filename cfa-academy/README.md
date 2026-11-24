# CFA Level I study tracker

A static site (served at `/cfa/` by the hosting gateway) that maps the whole Level I curriculum from the four Schweser
2027 notes books: 10 topics, 102 readings, modules with their PDF page numbers, and every learning outcome (LOS) as a
checklist. It tracks progress per reading and per outcome, shows weighted progress per topic, counts down to the exam date
with a weekly reading target, and searches everything. Progress is stored in the browser (Export/Import moves it between devices).

The books' text is not copied into the site; it only holds the outline and points at PDF pages. The extracted outline is
git-ignored (`content/`), as is the built site.

```bash
pip install pymupdf
python3 extract.py "/path/to/folder with the 4 PDFs"     # writes content/curriculum.json
python3 build.py                                          # writes ../hosting/sites/cfa
```

Exam weights on the home page are approximate midpoints; edit `WEIGHT` in `assets/app.js` to match your curriculum.
