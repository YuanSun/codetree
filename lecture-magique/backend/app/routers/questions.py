"""Reading comprehension: the questions of an article (one per chapter + a set for the end of the reading),
the child's written answers, and the parents' view of them.

A child sees a question's model answer and rubric only after she has saved an answer to it.
Every save is a new `answer` row (her history stays); the latest one is the current answer.
A question whose rubric says {"retired": true} was replaced in a newer pack but has answers, so it was kept:
it no longer appears in the questions page, only in the parents' list of answers."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import Connection, text

from ..auth import User, current_user, require_parent
from ..db import get_conn
from .reading import _article

router = APIRouter()
NOT_RETIRED = "NOT coalesce((q.rubric->>'retired')::boolean, false)"


def _key(r) -> dict:
    rub = r.rubric or {}
    return {"model_answer": r.model_answer, "must_answer": rub.get("must_answer"), "avoid": rub.get("avoid")}


@router.get("/articles/{article_id}/questions")
def list_questions(article_id: int, user: User = Depends(current_user), conn: Connection = Depends(get_conn)):
    art = _article(conn, user, article_id)
    rows = conn.execute(text(f"""
        SELECT q.id, q.kind, q.prompt, q.model_answer, q.rubric, c.seq AS chapter_seq, c.title AS chapter_title,
               a.body, a.submitted_at
        FROM lecture.question q
        LEFT JOIN lecture.chapter c ON c.id = q.chapter_id
        LEFT JOIN LATERAL (SELECT body, submitted_at FROM lecture.answer
                           WHERE question_id = q.id AND user_id = :u ORDER BY submitted_at DESC, id DESC LIMIT 1) a ON true
        WHERE q.article_id = :a AND {NOT_RETIRED}
        ORDER BY c.seq IS NULL, c.seq, q.seq"""), {"a": article_id, "u": user.id}).all()
    return {
        "article": {"id": art.id, "title": art.title, "lang": art.lang},
        "questions": [{
            "id": r.id, "kind": r.kind, "prompt": r.prompt,
            "chapter": None if r.chapter_seq is None else {"seq": r.chapter_seq, "title": r.chapter_title},
            "skill": (r.rubric or {}).get("skill"), "points": (r.rubric or {}).get("points"),
            "answer": None if r.body is None else {"body": r.body, "submitted_at": r.submitted_at.isoformat()},
            "key": _key(r) if r.body is not None else None,
        } for r in rows],
    }


class AnswerIn(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


@router.post("/questions/{question_id}/answer")
def save_answer(question_id: int, a: AnswerIn, user: User = Depends(current_user), conn: Connection = Depends(get_conn)):
    q = conn.execute(text(f"SELECT q.id, q.article_id, q.model_answer, q.rubric FROM lecture.question q "
                          f"WHERE q.id = :q AND {NOT_RETIRED}"), {"q": question_id}).first()
    if not q:
        raise HTTPException(404, "Question introuvable")
    _article(conn, user, q.article_id)  # a child can only answer questions of published articles
    body = a.body.strip()
    if not body:
        raise HTTPException(422, "Réponse vide")
    at = conn.execute(text("""INSERT INTO lecture.answer (user_id, question_id, body) VALUES (:u, :q, :b)
        RETURNING submitted_at"""), {"u": user.id, "q": question_id, "b": body}).scalar()
    return {"answer": {"body": body, "submitted_at": at.isoformat()}, "key": _key(q)}


@router.get("/parent/children/{child_id}/answers")
def child_answers(child_id: int, user: User = Depends(require_parent), conn: Connection = Depends(get_conn)):
    """Latest answer per question, newest first, with the model answer to compare."""
    kid = conn.execute(text("SELECT id FROM lecture.app_user WHERE id = :k AND role = 'student'"), {"k": child_id}).first()
    if not kid:
        raise HTTPException(404, "Enfant introuvable")
    rows = conn.execute(text("""
        SELECT * FROM (
          SELECT DISTINCT ON (a.question_id) a.question_id, a.body, a.submitted_at,
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
        "chapter_seq": r.chapter_seq, "kind": r.kind, "prompt": r.prompt,
        "skill": (r.rubric or {}).get("skill"), "points": (r.rubric or {}).get("points"),
        "body": r.body, "submitted_at": r.submitted_at.isoformat(), "versions": r.versions, **_key(r),
    } for r in rows]
