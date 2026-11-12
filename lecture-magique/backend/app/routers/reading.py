"""Bookshelf, chapters and reading progress. user_id always comes from the session."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import Connection, text

from ..auth import User, current_user
from ..db import get_conn

router = APIRouter()
EXAMPLES_SHOWN = 3
OTHER_SENSES_SHOWN = 12


def visible_statuses(user: User) -> tuple[str, ...]:
    """Parents also see drafts, so Ryan can read an article before publishing it."""
    return ("published", "draft") if user.role in ("parent", "admin") else ("published",)


def _article(conn: Connection, user: User, article_id: int):
    row = conn.execute(text("SELECT id, slug, title, status FROM lecture.article WHERE id = :a AND status = ANY(:s)"),
                       {"a": article_id, "s": list(visible_statuses(user))}).first()
    if not row:
        raise HTTPException(404, "Article introuvable")
    return row


@router.get("/articles")
def list_articles(user: User = Depends(current_user), conn: Connection = Depends(get_conn)):
    rows = conn.execute(text("""
        SELECT a.id, a.slug, a.title, a.week_of, a.status, a.source_note,
               (SELECT count(*) FROM lecture.chapter c WHERE c.article_id = a.id) AS chapter_count,
               p.last_chapter, p.chapters_done, p.seconds_read, p.finished_at
        FROM lecture.article a
        LEFT JOIN lecture.reading_progress p ON p.article_id = a.id AND p.user_id = :u
        WHERE a.status = ANY(:s)
        ORDER BY a.week_of DESC, a.id DESC"""), {"u": user.id, "s": list(visible_statuses(user))}).all()
    return [{
        "id": r.id, "slug": r.slug, "title": r.title, "week_of": r.week_of.isoformat(), "status": r.status,
        "source_note": r.source_note, "chapter_count": r.chapter_count,
        "progress": None if r.last_chapter is None else {
            "last_chapter": r.last_chapter, "chapters_done": sorted(r.chapters_done),
            "seconds_read": r.seconds_read, "finished": r.finished_at is not None},
    } for r in rows]


@router.get("/articles/{article_id}/chapters/{seq}")
def get_chapter(article_id: int, seq: int, user: User = Depends(current_user), conn: Connection = Depends(get_conn)):
    art = _article(conn, user, article_id)
    ch = conn.execute(text("SELECT id, seq, title FROM lecture.chapter WHERE article_id = :a AND seq = :s"),
                      {"a": article_id, "s": seq}).first()
    if not ch:
        raise HTTPException(404, "Chapitre introuvable")
    chapters = conn.execute(text("SELECT seq, title FROM lecture.chapter WHERE article_id = :a ORDER BY seq"),
                            {"a": article_id}).all()
    paras = conn.execute(text("SELECT id, seq, text FROM lecture.paragraph WHERE chapter_id = :c ORDER BY seq"),
                         {"c": ch.id}).all()
    toks = conn.execute(text("""
        SELECT t.id, t.paragraph_id, t.char_start, t.char_end, t.lemma_id, t.sense_id, t.morph
        FROM lecture.token t JOIN lecture.paragraph p ON p.id = t.paragraph_id
        WHERE p.chapter_id = :c AND t.is_word ORDER BY t.paragraph_id, t.seq"""), {"c": ch.id}).all()
    by_para: dict[int, list] = {}
    for t in toks:
        # 6th element: spaCy grammar of this occurrence, only for verb forms (tense/person on the card)
        morph = t.morph if t.morph and "VerbForm=" in t.morph else None
        by_para.setdefault(t.paragraph_id, []).append(
            [t.id, t.char_start, t.char_end, t.lemma_id, t.sense_id, morph])

    lemma_ids = sorted({t.lemma_id for t in toks if t.lemma_id})
    chosen = {t.sense_id for t in toks if t.sense_id}
    lemmas = {r.id: {"lemma": r.lemma, "pos": r.pos, "gender": r.gender, "ipa": r.ipa, "senses": [], "en": []}
              for r in conn.execute(text("SELECT id, lemma, pos, gender, ipa FROM lecture.lemma WHERE id = ANY(:ids)"),
                                    {"ids": lemma_ids})}
    senses = {}
    for s in conn.execute(text("""
            SELECT id, lemma_id, sense_key, definition_fr, raw->'examples' AS examples,
                   row_number() OVER (PARTITION BY lemma_id ORDER BY seq) AS n
            FROM lecture.sense WHERE lemma_id = ANY(:ids) AND source = 'petit_robert' ORDER BY lemma_id, seq"""),
            {"ids": lemma_ids}):
        if s.id not in chosen and s.n > OTHER_SENSES_SHOWN:
            continue
        lemmas[s.lemma_id]["senses"].append(s.id)
        senses[s.id] = {"key": s.sense_key, "def": s.definition_fr,
                        "ex": (s.examples or [])[:EXAMPLES_SHOWN]}
    # English glosses from Wiktionary: shown on the card only when Petit Robert has no entry.
    for s in conn.execute(text("""
            SELECT id, lemma_id, gloss_en, seq FROM lecture.sense
            WHERE lemma_id = ANY(:ids) AND source = 'wiktionary_en' AND seq < 2 ORDER BY lemma_id, seq"""),
            {"ids": lemma_ids}):
        lemmas[s.lemma_id]["en"].append(s.gloss_en)
        if s.id in chosen:
            senses[s.id] = {"key": None, "def": None, "ex": [], "en": s.gloss_en}
    words = {r.lemma_id: {"status": r.status, "familiarity": r.familiarity, "lookups": r.lookup_count,
                          "exposures": r.exposure_count}
             for r in conn.execute(text("""SELECT lemma_id, status, familiarity, lookup_count, exposure_count
                 FROM lecture.user_word WHERE user_id = :u AND lemma_id = ANY(:ids)"""),
                                   {"u": user.id, "ids": lemma_ids})}
    q = conn.execute(text("SELECT prompt FROM lecture.question WHERE chapter_id = :c ORDER BY seq LIMIT 1"),
                     {"c": ch.id}).scalar()
    prog = conn.execute(text("SELECT last_chapter, last_paragraph, chapters_done FROM lecture.reading_progress "
                             "WHERE user_id = :u AND article_id = :a"), {"u": user.id, "a": article_id}).first()
    return {
        "article": {"id": art.id, "slug": art.slug, "title": art.title, "status": art.status},
        "chapter": {"id": ch.id, "seq": ch.seq, "title": ch.title},
        "chapters": [{"seq": c.seq, "title": c.title} for c in chapters],
        "paragraphs": [{"id": p.id, "seq": p.seq, "text": p.text, "tokens": by_para.get(p.id, [])} for p in paras],
        "lemmas": lemmas,
        "senses": senses,
        "words": words,
        "question": q,
        "progress": {"last_chapter": prog.last_chapter, "last_paragraph": prog.last_paragraph,
                     "chapters_done": sorted(prog.chapters_done)} if prog else None,
    }


class ProgressIn(BaseModel):
    chapter: int = Field(ge=1)
    paragraph: int = Field(default=1, ge=1)
    seconds: int = Field(default=0, ge=0, le=3600)


@router.put("/progress/{article_id}")
def put_progress(article_id: int, body: ProgressIn, user: User = Depends(current_user),
                 conn: Connection = Depends(get_conn)):
    _article(conn, user, article_id)
    seconds = min(body.seconds, 600)  # one report never adds more than 10 minutes
    conn.execute(text("""
        INSERT INTO lecture.reading_progress (user_id, article_id, last_chapter, last_paragraph, seconds_read)
        VALUES (:u, :a, :c, :p, :s)
        ON CONFLICT (user_id, article_id) DO UPDATE SET last_chapter = :c, last_paragraph = :p,
            seconds_read = lecture.reading_progress.seconds_read + :s"""),
                 {"u": user.id, "a": article_id, "c": body.chapter, "p": body.paragraph, "s": seconds})
    if seconds:
        conn.execute(text("""
            INSERT INTO lecture.reading_day (user_id, article_id, day, seconds) VALUES (:u, :a, current_date, :s)
            ON CONFLICT (user_id, day, article_id) DO UPDATE SET seconds = lecture.reading_day.seconds + :s"""),
                     {"u": user.id, "a": article_id, "s": seconds})
    return {"ok": True}


class CompleteIn(BaseModel):
    opened_at: datetime | None = None


@router.post("/chapters/{chapter_id}/complete")
def complete_chapter(chapter_id: int, body: CompleteIn | None = None, user: User = Depends(current_user),
                     conn: Connection = Depends(get_conn)):
    ch = conn.execute(text("SELECT id, article_id, seq FROM lecture.chapter WHERE id = :c"), {"c": chapter_id}).first()
    if not ch:
        raise HTTPException(404, "Chapitre introuvable")
    _article(conn, user, ch.article_id)
    now = datetime.now(timezone.utc)
    opened = (body.opened_at if body and body.opened_at else now - timedelta(hours=6))
    if opened.tzinfo is None:
        opened = opened.replace(tzinfo=timezone.utc)
    opened = max(min(opened, now), now - timedelta(days=1))

    # Words in this chapter that are in her word bag but were NOT tapped during this reading.
    exposures = conn.execute(text("""
        WITH chapter_lemmas AS (
            SELECT DISTINCT t.lemma_id FROM lecture.token t JOIN lecture.paragraph p ON p.id = t.paragraph_id
            WHERE p.chapter_id = :c AND t.lemma_id IS NOT NULL),
        tapped AS (
            SELECT DISTINCT e.lemma_id FROM lecture.lookup_event e
            JOIN lecture.token t ON t.id = e.token_id JOIN lecture.paragraph p ON p.id = t.paragraph_id
            WHERE e.user_id = :u AND p.chapter_id = :c AND e.created_at >= :opened AND e.lemma_id IS NOT NULL)
        UPDATE lecture.user_word w SET exposure_count = w.exposure_count + 1
        WHERE w.user_id = :u AND w.lemma_id IN (SELECT lemma_id FROM chapter_lemmas)
          AND w.lemma_id NOT IN (SELECT lemma_id FROM tapped)"""),
                             {"c": chapter_id, "u": user.id, "opened": opened}).rowcount

    n_chapters = conn.execute(text("SELECT count(*) FROM lecture.chapter WHERE article_id = :a"),
                              {"a": ch.article_id}).scalar()
    next_seq = ch.seq + 1 if ch.seq < n_chapters else None
    row = conn.execute(text("""
        INSERT INTO lecture.reading_progress (user_id, article_id, last_chapter, last_paragraph, chapters_done)
        VALUES (:u, :a, :next, 1, ARRAY[:seq])
        ON CONFLICT (user_id, article_id) DO UPDATE SET
            chapters_done = (SELECT array_agg(DISTINCT x ORDER BY x)
                             FROM unnest(lecture.reading_progress.chapters_done || :seq) AS x),
            last_chapter = :next, last_paragraph = 1
        RETURNING chapters_done"""),
                       {"u": user.id, "a": ch.article_id, "seq": ch.seq, "next": next_seq or ch.seq}).first()
    finished = len(set(row.chapters_done)) >= n_chapters
    if finished:
        conn.execute(text("""UPDATE lecture.reading_progress SET finished_at = coalesce(finished_at, now())
            WHERE user_id = :u AND article_id = :a"""), {"u": user.id, "a": ch.article_id})
    return {"next_seq": next_seq, "exposures": exposures, "finished": finished,
            "chapters_done": sorted(row.chapters_done)}


@router.get("/lemmas/{lemma_id}/conjugation")
def conjugation(lemma_id: int, user: User = Depends(current_user), conn: Connection = Depends(get_conn)):
    """Conjugation table of a verb, built from Wiktionary forms (importer.wiktionary)."""
    from importer.wiktionary import PERSONS, TENSES

    lem = conn.execute(text("SELECT id, lemma, pos FROM lecture.lemma WHERE id = :l"), {"l": lemma_id}).first()
    if not lem or lem.pos != "VERB":
        raise HTTPException(404, "Pas un verbe")
    cells: dict[str, list[str]] = {}
    for form, tags in conn.execute(text("SELECT form, tags FROM lecture.word_form WHERE lemma_id = :l ORDER BY form"),
                                   {"l": lemma_id}):
        for code in tags or []:
            cells.setdefault(code, []).append(form)
    tenses = []
    for key, label in TENSES:
        row = {p: cells.get(f"{key}.{p}", []) for p in PERSONS}
        if any(row.values()):
            tenses.append({"key": key, "label": label, "forms": row})
    return {"lemma": lem.lemma, "infinitive": cells.get("inf", [lem.lemma]),
            "participle_present": cells.get("part.pres", []), "participle_past": cells.get("part.past", []),
            "tenses": tenses, "source": "Wiktionary (CC BY-SA)"}
