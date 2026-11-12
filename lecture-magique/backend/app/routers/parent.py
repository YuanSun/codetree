"""Progress report ("Suivi"): parents see any child's, a child sees her own ("Mes progrès"). Read-only."""
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import Connection, text

from .. import review
from ..auth import User, current_user, require_parent
from ..db import get_conn

router = APIRouter()

NOT_RETRY = "NOT coalesce((i.prompt->>'retry')::boolean, false)"


@router.get("/parent/children")
def children(user: User = Depends(require_parent), conn: Connection = Depends(get_conn)):
    return [dict(r._mapping) for r in conn.execute(text(
        "SELECT id, username, display_name FROM lecture.app_user WHERE role = 'student' ORDER BY display_name"))]


@router.get("/parent/children/{child_id}/report")
def report(child_id: int, weeks: int = Query(8, ge=1, le=52), user: User = Depends(require_parent),
           conn: Connection = Depends(get_conn)):
    kid = conn.execute(text("SELECT id, display_name FROM lecture.app_user WHERE id = :k AND role = 'student'"),
                       {"k": child_id}).first()
    if not kid:
        raise HTTPException(404, "Enfant introuvable")
    return build_report(conn, kid, weeks)


@router.get("/me/report")
def my_report(weeks: int = Query(8, ge=1, le=52), user: User = Depends(current_user),
              conn: Connection = Depends(get_conn)):
    """The same report about the logged-in user only (no id parameter: a child can only see herself)."""
    kid = conn.execute(text("SELECT id, display_name FROM lecture.app_user WHERE id = :k"), {"k": user.id}).one()
    return build_report(conn, kid, weeks)


def build_report(conn: Connection, kid, weeks: int) -> dict:
    p = {"k": kid.id}
    this_monday = review.monday()
    first = this_monday - timedelta(weeks=weeks - 1)

    # --- per week: taps, distinct words, active days, défi score -------------------------------
    rows = conn.execute(text(f"""
        WITH weeks AS (SELECT generate_series(CAST(:first AS date), CAST(:last AS date), interval '7 days')::date AS wk),
        taps AS (
            SELECT date_trunc('week', created_at)::date AS wk, count(*) AS n, count(DISTINCT lemma_id) AS words,
                   count(*) FILTER (WHERE self_rating = 'unknown') AS unknown
            FROM lecture.lookup_event WHERE user_id = :k GROUP BY 1),
        activity AS (
            SELECT DISTINCT created_at::date AS d FROM lecture.lookup_event WHERE user_id = :k
            UNION SELECT day FROM lecture.reading_day WHERE user_id = :k AND seconds >= 60
            UNION SELECT DISTINCT i.answered_at::date FROM lecture.quiz_item i JOIN lecture.quiz q ON q.id = i.quiz_id
                  WHERE q.user_id = :k AND i.answered_at IS NOT NULL),
        days AS (SELECT date_trunc('week', d)::date AS wk, count(*) AS n FROM activity GROUP BY 1),
        reading AS (SELECT date_trunc('week', day)::date AS wk, sum(seconds) AS secs
                    FROM lecture.reading_day WHERE user_id = :k GROUP BY 1),
        defi AS (
            SELECT q.week_of AS wk, q.status,
                   count(*) FILTER (WHERE {NOT_RETRY}) AS questions,
                   count(*) FILTER (WHERE i.correct AND {NOT_RETRY}) AS correct,
                   count(*) FILTER (WHERE i.answered_at IS NOT NULL AND {NOT_RETRY}) AS answered
            FROM lecture.quiz q JOIN lecture.quiz_item i ON i.quiz_id = q.id WHERE q.user_id = :k
            GROUP BY q.id, q.week_of, q.status)
        SELECT w.wk, coalesce(t.n, 0) AS taps, coalesce(t.words, 0) AS words, coalesce(t.unknown, 0) AS unknown,
               coalesce(d.n, 0) AS active_days, round(coalesce(rd.secs, 0) / 60.0) AS minutes,
               f.status, f.questions, f.correct, f.answered
        FROM weeks w LEFT JOIN taps t USING (wk) LEFT JOIN days d USING (wk) LEFT JOIN reading rd USING (wk)
        LEFT JOIN defi f USING (wk)
        ORDER BY w.wk"""), {**p, "first": first, "last": this_monday}).all()
    week_list = [{
        "week": r.wk.isoformat(), "taps": r.taps, "words": r.words, "unknown": r.unknown,
        "active_days": r.active_days, "minutes": int(r.minutes),
        "defi": None if r.questions is None else {"status": r.status, "questions": r.questions,
                                                  "answered": r.answered, "correct": r.correct},
    } for r in rows]

    # --- the word bag ---------------------------------------------------------------------------
    bag = conn.execute(text("""SELECT
            count(*) FILTER (WHERE status = 'learning' AND familiarity = 0) AS new,
            count(*) FILTER (WHERE status = 'learning' AND familiarity BETWEEN 1 AND 4) AS learning,
            count(*) FILTER (WHERE familiarity = 5) AS mastered,
            count(*) FILTER (WHERE status = 'known') AS known,
            count(*) FILTER (WHERE status = 'learning' AND due_at < now() + interval '7 days') AS due_soon
        FROM lecture.user_word WHERE user_id = :k"""), p).one()

    # --- hardest words: défi errors, then lapses, then lookups ----------------------------------
    hard = conn.execute(text(f"""
        SELECT w.lemma_id, l.lemma, l.pos, w.lookup_count, w.lapses, w.familiarity, w.first_token_id,
               w.first_seen_at, w.status,
               count(i.id) FILTER (WHERE i.correct IS FALSE AND {NOT_RETRY}) AS errors,
               count(i.id) FILTER (WHERE i.answered_at IS NOT NULL AND {NOT_RETRY}) AS asked,
               (SELECT definition_fr FROM lecture.sense s WHERE s.lemma_id = l.id AND s.source = 'petit_robert'
                  AND s.definition_fr IS NOT NULL ORDER BY s.seq LIMIT 1) AS definition,
               (SELECT gloss_en FROM lecture.sense s WHERE s.lemma_id = l.id AND s.source = 'wiktionary_en'
                  ORDER BY s.seq LIMIT 1) AS gloss
        FROM lecture.user_word w JOIN lecture.lemma l ON l.id = w.lemma_id
        LEFT JOIN lecture.quiz q ON q.user_id = w.user_id
        LEFT JOIN lecture.quiz_item i ON i.quiz_id = q.id AND i.lemma_id = w.lemma_id
        WHERE w.user_id = :k AND w.status = 'learning'
        GROUP BY w.lemma_id, l.id, l.lemma, l.pos, w.lookup_count, w.lapses, w.familiarity, w.first_token_id,
                 w.first_seen_at, w.status
        HAVING count(i.id) FILTER (WHERE i.correct IS FALSE AND {NOT_RETRY}) > 0 OR w.lapses > 0 OR w.lookup_count > 1
        ORDER BY errors DESC, w.lapses DESC, w.lookup_count DESC, w.first_seen_at DESC
        LIMIT 20"""), p).all()
    hard_words = []
    for h in hard:
        s = review._sentence(conn, h.first_token_id)
        hard_words.append({
            "lemma": h.lemma, "pos": h.pos, "lookups": h.lookup_count, "lapses": h.lapses,
            "familiarity": h.familiarity, "errors": h.errors, "asked": h.asked,
            "definition": h.definition, "gloss": h.gloss,
            "sentence": s[2] if s else None, "surface": s[1] if s else None,
            "since": h.first_seen_at.date().isoformat(),
        })

    # --- books -----------------------------------------------------------------------------------
    books = [{
        "title": b.title, "chapters_done": len(b.chapters_done or []), "chapters": b.chapters,
        "last_chapter": b.last_chapter, "minutes": round(b.seconds_read / 60), "finished": b.finished_at is not None,
        "started": b.started_at.date().isoformat(),
        "lookups": b.lookups,
    } for b in conn.execute(text("""
        SELECT a.title, p.chapters_done, p.last_chapter, p.seconds_read, p.finished_at, p.started_at,
               (SELECT count(*) FROM lecture.chapter c WHERE c.article_id = a.id) AS chapters,
               (SELECT count(*) FROM lecture.lookup_event e JOIN lecture.token t ON t.id = e.token_id
                  JOIN lecture.paragraph pa ON pa.id = t.paragraph_id JOIN lecture.chapter c ON c.id = pa.chapter_id
                 WHERE e.user_id = p.user_id AND c.article_id = a.id) AS lookups
        FROM lecture.reading_progress p JOIN lecture.article a ON a.id = p.article_id
        WHERE p.user_id = :k ORDER BY p.started_at DESC"""), p)]

    return {
        "child": {"id": kid.id, "display_name": kid.display_name},
        "bag": dict(bag._mapping),
        "weeks": week_list,
        "hard_words": hard_words,
        "books": books,
    }
