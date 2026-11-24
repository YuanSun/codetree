# CFA knowledge base

A searchable reference of CFA concepts for looking things up at work: what a term means, the formula, a worked example,
how it shows up in practice, and where to read more in your Schweser books. Covers Level I (353 concepts, all 102
readings) and Level II (203 concepts, all 41 readings). Served at `/kb/` by the hosting gateway.

It replaces the old `cfa-academy` study tracker; `/cfa/` now redirects to `/kb/`.

- **Forgiving search**: abbreviations (WACC, YTM, DV01), typos (`duratoin`, `convexty`), plain questions
  ("how sensitive is a bond to rates", "what drives credit spreads") and synonyms (vol → standard deviation). Each concept
  has hand-written aliases, acronyms are built automatically, and the search falls back to prefix and typo matching.
  Results also list matching terms from the books' back-of-book indexes with page numbers.
- **Concept pages**: plain-language summary, formulas (rendered with MathJax), examples, "at work" and "watch out" notes,
  related concepts, the reading and book pages to read more.
- **Levels are linked, not separate**: a Level II page shows its "Level I foundation" and a Level I page shows where it
  "Goes deeper in Level II". Links come from `@see` / `[[id]]` in the notes plus `notes/crosslinks.md`, and always show on
  both pages. Search covers both levels (with a Level I / Level II filter), and each topic links to the same topic in the
  other level.
- **Reading pages**: the concepts it covers, its learning outcomes, module pages and index terms.
- Keyboard: `/` focuses search, arrows + Enter pick a result.
- **Open in your book** (home server only): set `CFA_BOOKS_L1` / `CFA_BOOKS_L2` in `hosting/.env` to the folders with
  your PDFs (or pass `--books-l1` / `--books-l2` to `build.py`). Concept and reading pages then get links that open your
  own PDF at the right page. The PDFs are only linked into the git-ignored site folder; nothing is extracted from them,
  and they're never part of the claude.ai artifact.

The explanations in `notes/` are written for this site; the books' text is not copied. Learning outcomes, page
numbers and index terms come from `content/curriculum.json` (made by `extract.py` from your own PDFs, git-ignored); without it the site still builds, just without book references.

```bash
python3 extract.py --l1 "/folder/with/Level I books" --l2 "/folder/with/Level II books"   # once (pip install pymupdf)
python3 build.py                                                     # -> ../hosting/sites/cfa-kb (served at /kb/)
python3 build.py --obsidian ~/Vault/CFA                              # also export one Obsidian note per concept
```

## Adding or editing concepts

One Markdown file per topic in `notes/L1/` and `notes/L2/` (concept ids are unique across both levels, so links work
between them):

```markdown
## Net present value (NPV)
@id npv
@r 24
@aka net present value; is the project worth it; value created by a project
@see irr; wacc

First paragraph = the summary shown in search results.

$$NPV = \sum_{t=0}^{N}\frac{CF_t}{(1+r)^t}$$

> **Example** ...        (callouts: Example / At work / Watch out)
```

`@aka` entries are what make vague searches work: add the words you would actually type. Link concepts inline with
`[[id]]` or `[[id|text]]` (Obsidian-style). Inline math is `\( ... \)`, display math `$$ ... $$`.
