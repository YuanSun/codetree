# CFA knowledge base

A searchable reference of CFA concepts for looking things up at work: what a term means, the formula, a worked example,
how it shows up in practice, and where to read more in your Schweser books. Level I is done (353 concepts across all
10 topics and all 102 readings); Level II comes next. Served at `/kb/` by the hosting gateway.

Unlike [cfa-academy](../cfa-academy) (a study tracker), this is a reference: every page is one concept.

- **Forgiving search**: abbreviations (WACC, YTM, DV01), typos (`duratoin`, `convexty`), plain questions
  ("how sensitive is a bond to rates", "what drives credit spreads") and synonyms (vol → standard deviation). Each concept
  has hand-written aliases, acronyms are built automatically, and the search falls back to prefix and typo matching.
  Results also list matching terms from the books' back-of-book indexes with page numbers.
- **Concept pages**: plain-language summary, formulas (rendered with MathJax), examples, "at work" and "watch out" notes,
  related concepts, the reading and book pages to read more.
- **Reading pages**: the concepts it covers, its learning outcomes, module pages and index terms.
- Keyboard: `/` focuses search, arrows + Enter pick a result.

The explanations in `notes/` are written for this site; the books' text is not copied. Learning outcomes, page
numbers and index terms come from `../cfa-academy/content/curriculum.json` (made by `cfa-academy/extract.py` from your own
PDFs, git-ignored); without it the site still builds, just without book references.

```bash
python3 ../cfa-academy/extract.py --l1 "/folder/with/Level I books"   # once, if curriculum.json is missing (pip install pymupdf)
python3 build.py                                                     # -> ../hosting/sites/cfa-kb (served at /kb/)
python3 build.py --obsidian ~/Vault/CFA                              # also export one Obsidian note per concept
```

## Adding or editing concepts

One Markdown file per topic in `notes/L1/` (and later `notes/L2/`):

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
