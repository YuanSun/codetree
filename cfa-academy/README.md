# CFA study tracker (Levels I and II)

A static site (served at `/cfa/` by the hosting gateway) that maps the Schweser notes: Level I (2027, 4 books) and
Level II (2026, 5 books), 143 readings in all, with each module's PDF page and every learning outcome (LOS) as a checklist.

- **Tracker:** per-reading and per-outcome progress, weighted progress per topic, exam countdown with a weekly reading target.
- **Concept search:** the books' back-of-book indexes become ~3,000 concepts. Search a term to see where to read it
  (reading, module, book and PDF page), the learning outcomes that mention it, and a map of related concepts you can click through.
  Related = indexed on the same page, in the same module or in the same reading; the same term in the other level is cross-linked.
- **Per reading:** a list of the concepts it covers, each linking to its concept page.
- Progress is stored in the browser (Export/Import moves it between devices).

The books' text is not copied into the site, only titles, page numbers, outcomes and index terms. The extracted data
(`content/`) and the built site are git-ignored.

```bash
pip install pymupdf
python3 extract.py --l1 "/folder/with/Level I books" --l2 "/folder/with/Level II books"   # writes content/curriculum.json
python3 build.py                                                                          # writes ../hosting/sites/cfa
```

Exam weights on the home page are approximate midpoints; edit `WEIGHT` in `assets/app.js` to match the curriculum.
