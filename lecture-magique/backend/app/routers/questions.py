"""Reading comprehension: the questions of an article (one per chapter + a set for the end of the reading),
the child's written answers, and the parents' view of them.

A child sees a question's model answer and rubric only after she has saved an answer to it.
Every save is a new `answer` row (her history stays); the latest one is the current answer.
A question whose rubric says {"retired": true} was replaced in a newer pack but has answers, so it was kept:
it no longer appears in the questions page, only in the parents' list of answers.

Closed questions (kind "choice": multiple choice or vrai/faux) keep their options in rubric.choices and the right
one's index in rubric.correct. The options are sent with the question, the right answer only after she has
answered. She gets one try: it is marked at once (graded_by "auto") and never goes to the Claude export."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import Connection, text

from ..auth import User, current_user, require_parent
from ..db import get_conn
from .reading import _article

router = APIRouter()
NOT_RETIRED = "NOT coalesce((q.rubric->>'retired')::boolean, false)"
DEFAULT_POINTS = 2  # chapter questions carry no points in their rubric


def points_of(rubric) -> float:
    return float((rubric or {}).get("points") or DEFAULT_POINTS)


def _key(r) -> dict:
    rub = r.rubric or {}
    key = {"model_answer": r.model_answer, "must_answer": rub.get("must_answer"), "avoid": rub.get("avoid"),
           "evidence": rub.get("evidence") or []}
    if r.kind == "choice":
        key["correct"] = rub["choices"][rub["correct"]]
    return key


def _choices(r) -> list[str] | None:
    return (r.rubric or {}).get("choices") if r.kind == "choice" else None


@router.get("/articles/{article_id}/questions")
def list_questions(article_id: int, user: User = Depends(current_user), conn: Connection = Depends(get_conn)):
    art = _article(conn, user, article_id)
    rows = conn.execute(text(f"""
        SELECT q.id, q.kind, q.prompt, q.model_answer, q.rubric, c.seq AS chapter_seq, c.title AS chapter_title,
               a.id AS answer_id, a.body, a.submitted_at, g.id AS graded_id, g.score, g.feedback
        FROM lecture.question q
        LEFT JOIN lecture.chapter c ON c.id = q.chapter_id
        LEFT JOIN LATERAL (SELECT id, body, submitted_at FROM lecture.answer
                           WHERE question_id = q.id AND user_id = :u ORDER BY submitted_at DESC, id DESC LIMIT 1) a ON true
        LEFT JOIN LATERAL (SELECT id, score, feedback FROM lecture.answer
                           WHERE question_id = q.id AND user_id = :u AND score IS NOT NULL
                           ORDER BY submitted_at DESC, id DESC LIMIT 1) g ON true
        WHERE q.article_id = :a AND {NOT_RETIRED}
        ORDER BY c.seq IS NULL, c.seq, q.seq"""), {"a": article_id, "u": user.id}).all()
    chapters = conn.execute(text("SELECT seq, title FROM lecture.chapter WHERE article_id = :a ORDER BY seq"),
                            {"a": article_id}).all()
    return {
        "article": {"id": art.id, "title": art.title, "lang": art.lang},
        "chapters": [{"seq": c.seq, "title": c.title} for c in chapters],
        "questions": [{
            "id": r.id, "kind": r.kind, "prompt": r.prompt, "choices": _choices(r),
            "chapter": None if r.chapter_seq is None else {"seq": r.chapter_seq, "title": r.chapter_title},
            "skill": (r.rubric or {}).get("skill"), "points": (r.rubric or {}).get("points"),
            "answer": None if r.body is None else {"body": r.body, "submitted_at": r.submitted_at.isoformat()},
            "key": _key(r) if r.body is not None else None,
            "grade": None if r.graded_id is None else {
                "score": float(r.score), "points": points_of(r.rubric), "feedback": r.feedback,
                "for_latest": r.graded_id == r.answer_id},
        } for r in rows],
    }


class AnswerIn(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


@router.post("/questions/{question_id}/answer")
def save_answer(question_id: int, a: AnswerIn, user: User = Depends(current_user), conn: Connection = Depends(get_conn)):
    q = conn.execute(text(f"SELECT q.id, q.kind, q.article_id, q.model_answer, q.rubric FROM lecture.question q "
                          f"WHERE q.id = :q AND {NOT_RETIRED}"), {"q": question_id}).first()
    if not q:
        raise HTTPException(404, "Question introuvable")
    _article(conn, user, q.article_id)  # a child can only answer questions of published articles
    body = a.body.strip()
    if not body:
        raise HTTPException(422, "Réponse vide")
    if q.kind != "choice":
        at = conn.execute(text("""INSERT INTO lecture.answer (user_id, question_id, body) VALUES (:u, :q, :b)
            RETURNING submitted_at"""), {"u": user.id, "q": question_id, "b": body}).scalar()
        return {"answer": {"body": body, "submitted_at": at.isoformat()}, "key": _key(q), "grade": None}
    # closed question: one try, marked now
    choices = q.rubric["choices"]
    if body not in choices:
        raise HTTPException(422, "Choisis une des réponses proposées")
    if conn.execute(text("SELECT 1 FROM lecture.answer WHERE question_id = :q AND user_id = :u"),
                    {"q": question_id, "u": user.id}).first():
        raise HTTPException(409, "Tu as déjà répondu à cette question")
    pts = points_of(q.rubric)
    score = pts if choices.index(body) == q.rubric["correct"] else 0.0
    at = conn.execute(text("""INSERT INTO lecture.answer (user_id, question_id, body, score, graded_by)
        VALUES (:u, :q, :b, :s, 'auto') RETURNING submitted_at"""),
                      {"u": user.id, "q": question_id, "b": body, "s": score}).scalar()
    return {"answer": {"body": body, "submitted_at": at.isoformat()}, "key": _key(q),
            "grade": {"score": score, "points": pts, "feedback": None, "for_latest": True}}


@router.get("/parent/children/{child_id}/answers")
def child_answers(child_id: int, user: User = Depends(require_parent), conn: Connection = Depends(get_conn)):
    """Latest answer per question, newest first, with the model answer to compare."""
    kid = conn.execute(text("SELECT id FROM lecture.app_user WHERE id = :k AND role = 'student'"), {"k": child_id}).first()
    if not kid:
        raise HTTPException(404, "Enfant introuvable")
    rows = conn.execute(text("""
        SELECT * FROM (
          SELECT DISTINCT ON (a.question_id) a.question_id, a.id AS answer_id, a.body, a.submitted_at,
                 a.score, a.feedback, a.graded_by,
                 count(*) OVER (PARTITION BY a.question_id) AS versions,
                 q.kind, q.prompt, q.model_answer, q.rubric, c.seq AS chapter_seq,
                 art.id AS article_id, art.title AS article_title, art.lang
          FROM lecture.answer a
          JOIN lecture.question q ON q.id = a.question_id
          JOIN lecture.article art ON art.id = q.article_id
          LEFT JOIN lecture.chapter c ON c.id = q.chapter_id
          WHERE a.user_id = :k
          ORDER BY a.question_id, a.submitted_at DESC, a.id DESC) x
        ORDER BY submitted_at DESC"""), {"k": child_id}).all()
    return [{
        "question_id": r.question_id, "article": {"id": r.article_id, "title": r.article_title, "lang": r.lang},
        "chapter_seq": r.chapter_seq, "kind": r.kind, "prompt": r.prompt, "choices": _choices(r),
        "skill": (r.rubric or {}).get("skill"), "points": (r.rubric or {}).get("points"),
        "answer_id": r.answer_id, "body": r.body, "submitted_at": r.submitted_at.isoformat(), "versions": r.versions,
        "grade": None if r.score is None else {"score": float(r.score), "points": points_of(r.rubric),
                                               "feedback": r.feedback, "by": r.graded_by},
        **_key(r),
    } for r in rows]


# ---------- marking by Claude: export ungraded answers, import the grades back ----------

GRADING_INSTRUCTIONS = """You are marking reading-comprehension answers written by {name}, 11 years old, Grade 5 in a French
immersion programme (her first language is English). The books are French novels (lang "fr") and English
articles (lang "en").

For each item in "answers", give:
- "score": from 0 to the item's "points", in steps of 0.5.
- "feedback": 2 to 3 short sentences addressed to her as "tu" (French books) or "you" (English texts), in the
  language of the book. Start with what is good, then give ONE concrete thing to improve.

How to mark:
- Mark against "must_answer". "model_answer" is one good answer, not the only one: accept other answers that are
  right and supported by the text.
- Her teacher's rule: answer exactly what is asked. An answer that is too broad (unrelated points) or that invents
  details loses points; say so kindly.
- If the question asks for evidence, two reasons or two examples, each missing one costs points.
- Watch negations ("ne... pas", "not"): answering the opposite of the question is wrong.
- "avoid" lists a common mistake for that question; if she made it, name it.
- "evidence" lists the passages of the book that hold the answer (chapter + exact quote). Check her answer against
  them: a detail they don't support is invented, unless it is right elsewhere in the book. When she misses a
  point, tell her which chapter to look in (she can open the passage from her answer).
- Spelling and grammar do not cost points, but you may point out at most one important error (agreement, a verb
  form, an anglicism such as "je suis 11 ans").
- "writing" items: mark content and organisation against "must_answer"; reward full sentences.

Reply with JSON only, no other text:
{{"format": "lecture-magique-grades/1", "grades": [{{"answer_id": 123, "score": 1.5, "feedback": "..."}}]}}
Include every answer_id from the list exactly once."""


@router.get("/parent/children/{child_id}/grading-export")
def grading_export(child_id: int, regrade: bool = False, user: User = Depends(require_parent),
                   conn: Connection = Depends(get_conn)):
    """The child's latest answer to each question that has no grade yet (regrade=true: all latest answers),
    with the questions' rubrics and marking instructions, ready to give to Claude."""
    kid = conn.execute(text("SELECT id, display_name FROM lecture.app_user WHERE id = :k AND role = 'student'"),
                       {"k": child_id}).first()
    if not kid:
        raise HTTPException(404, "Enfant introuvable")
    rows = conn.execute(text(f"""
        SELECT * FROM (
          SELECT DISTINCT ON (a.question_id) a.id, a.body, a.score, q.kind, q.prompt, q.model_answer, q.rubric,
                 c.seq AS chapter_seq, art.title, art.lang, art.id AS article_id, q.seq AS qseq
          FROM lecture.answer a
          JOIN lecture.question q ON q.id = a.question_id
          JOIN lecture.article art ON art.id = q.article_id
          LEFT JOIN lecture.chapter c ON c.id = q.chapter_id
          WHERE a.user_id = :k AND {NOT_RETIRED} AND q.kind <> 'choice'
          ORDER BY a.question_id, a.submitted_at DESC, a.id DESC) x
        WHERE :regrade OR score IS NULL
        ORDER BY article_id, qseq"""), {"k": child_id, "regrade": regrade}).all()
    return {
        "format": "lecture-magique-grading/1",
        "child": kid.display_name,
        "instructions": GRADING_INSTRUCTIONS.format(name=kid.display_name),
        "answers": [{
            "answer_id": r.id, "book": r.title, "lang": r.lang,
            "chapter": r.chapter_seq, "kind": r.kind, "question": r.prompt,
            "skill": (r.rubric or {}).get("skill"), "points": points_of(r.rubric),
            "must_answer": (r.rubric or {}).get("must_answer"), "avoid": (r.rubric or {}).get("avoid"),
            "evidence": (r.rubric or {}).get("evidence") or [], "model_answer": r.model_answer, "answer": r.body,
        } for r in rows],
    }


class GradeIn(BaseModel):
    answer_id: int
    score: float = Field(ge=0)
    feedback: str = Field(default="", max_length=3000)


class GradesIn(BaseModel):
    grades: list[GradeIn] = Field(min_length=1, max_length=500)
    graded_by: str = Field(default="claude", pattern="^(claude|parent)$")


@router.post("/parent/grades")
def import_grades(g: GradesIn, user: User = Depends(require_parent), conn: Connection = Depends(get_conn)):
    """Write scores and feedback onto answers. All or nothing: one bad item refuses the whole batch."""
    ids = [x.answer_id for x in g.grades]
    if len(set(ids)) != len(ids):
        raise HTTPException(422, "Le même answer_id apparaît deux fois")
    found = {r.id: r for r in conn.execute(text("""
        SELECT a.id, q.rubric FROM lecture.answer a JOIN lecture.question q ON q.id = a.question_id
        JOIN lecture.app_user u ON u.id = a.user_id WHERE a.id = ANY(:ids) AND u.role = 'student'"""), {"ids": ids})}
    problems = []
    for x in g.grades:
        r = found.get(x.answer_id)
        if r is None:
            problems.append(f"réponse {x.answer_id} introuvable")
        elif x.score > points_of(r.rubric) or (x.score * 2) % 1:
            problems.append(f"réponse {x.answer_id} : note {x.score} hors de 0–{points_of(r.rubric):g} (par demi-points)")
    if problems:
        raise HTTPException(422, "; ".join(problems))
    conn.execute(text("UPDATE lecture.answer SET score = :s, feedback = :f, graded_by = :b WHERE id = :id"),
                 [{"id": x.answer_id, "s": x.score, "f": x.feedback.strip() or None, "b": g.graded_by} for x in g.grades])
    return {"graded": len(g.grades)}
