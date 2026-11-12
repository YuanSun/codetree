"""Weekly défi and the word bag. user_id always comes from the session."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import Connection, text

from .. import review
from ..auth import User, current_user
from ..db import get_conn

router = APIRouter()


@router.get("/quiz/current")
def current_quiz(user: User = Depends(current_user), conn: Connection = Depends(get_conn)):
    """This week's défi (created on the first visit from Monday on)."""
    qid = review.get_or_create_quiz(conn, user.id)
    if qid is None:
        return {"quiz": None, "message": "Ton sac à mots est vide pour l’instant : lis et touche des mots !"}
    return {"quiz": review.quiz_view(conn, qid)}


class AnswerIn(BaseModel):
    response: str = Field(max_length=300)
    response_ms: int | None = Field(default=None, ge=0, le=3_600_000)


@router.post("/quiz/items/{item_id}/answer")
def answer_item(item_id: int, body: AnswerIn, user: User = Depends(current_user), conn: Connection = Depends(get_conn)):
    res = review.answer(conn, user.id, item_id, body.response, body.response_ms)
    if res is None:
        raise HTTPException(404, "Question introuvable")
    return res


GROUPS = ("new", "learning", "mastered", "known")


@router.get("/words")
def word_bag(group: str | None = None, user: User = Depends(current_user), conn: Connection = Depends(get_conn)):
    """Her word bag: new (familiarity 0), learning (1-4), mastered (5, gold), known (said 'je connais' first)."""
    if group is not None and group not in GROUPS:
        raise HTTPException(422, f"group must be one of {GROUPS}")
    rows = conn.execute(text("""
        SELECT w.lemma_id, l.lemma, l.pos, l.gender, l.ipa, w.status, w.familiarity, w.lookup_count, w.due_at,
               w.first_token_id, w.first_seen_at,
               (SELECT definition_fr FROM lecture.sense s WHERE s.lemma_id = l.id AND s.source = 'petit_robert'
                  AND s.definition_fr IS NOT NULL ORDER BY s.seq LIMIT 1) AS definition,
               (SELECT gloss_en FROM lecture.sense s WHERE s.lemma_id = l.id AND s.source = 'wiktionary_en'
                  ORDER BY s.seq LIMIT 1) AS gloss
        FROM lecture.user_word w JOIN lecture.lemma l ON l.id = w.lemma_id
        WHERE w.user_id = :u AND w.status <> 'ignored'
        ORDER BY w.familiarity DESC, w.first_seen_at DESC"""), {"u": user.id}).all()
    out = []
    for r in rows:
        g = "known" if r.status == "known" else "mastered" if r.familiarity >= 5 else "new" if r.familiarity == 0 else "learning"
        if group and g != group:
            continue
        s = review._sentence(conn, r.first_token_id)
        out.append({"lemma_id": r.lemma_id, "lemma": r.lemma, "pos": r.pos, "gender": r.gender, "ipa": r.ipa,
                    "group": g, "familiarity": r.familiarity, "lookups": r.lookup_count,
                    "due": r.due_at.isoformat() if r.due_at else None, "definition": r.definition, "gloss": r.gloss,
                    "sentence": s[2] if s else None, "surface": s[1] if s else None})
    return out
