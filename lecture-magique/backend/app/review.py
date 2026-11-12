"""Spaced repetition (FSRS) and the weekly "Défi de la semaine" (docs/DESIGN.md, 熟悉度模型 + 每周复习与测验).

State lives in lecture.user_word (fsrs_state, stability, difficulty, due_at, reps, lapses, last_review_at);
every rating is also appended to lecture.review_log, so the state can be rebuilt or re-fitted later.

Signals -> FSRS rating
- tap a word (lookup):  unknown -> Again, vague -> Hard, known -> Good. Only the first tap of a day counts.
  First tap "known" marks the word known and keeps it out of review (until she taps it again not knowing it).
- défi answer: wrong -> Again; right in <= 8 s -> Good (Easy if <= 3 s on a familiar word); right but slow -> Hard.
  A retry of a wrongly answered word (same défi, other question type) is logged only.
- "seen but not tapped" (exposure) is not fed to FSRS: the signal is too weak.

Familiarity shown to the child (0-5) comes from FSRS stability once the word has been in a défi:
<2 d -> 1, <7 d -> 2, <14 d -> 3, <30 d -> 4, >=30 d -> 5 (gold). Initial thresholds, to be tuned on her data.
"""
import json
import random
import re
import unicodedata
from datetime import date, datetime, timedelta, timezone

from fsrs import Card, Rating, Scheduler, State
from sqlalchemy import Connection, text

# No intra-day learning steps: reviews are weekly, so every rating schedules in days.
SCHEDULER = Scheduler(learning_steps=(), relearning_steps=(), enable_fuzzing=False)

QUIZ_SIZE = 15
MAX_NEW = 5          # words never seen in a défi, per défi (the very first défi may use all QUIZ_SIZE)
FAST_MS = 8_000
VERY_FAST_MS = 3_000
LOOKUP_RATING = {"unknown": Rating.Again, "vague": Rating.Hard, "known": Rating.Good}
TYPES = ("meaning", "cloze", "definition", "dictation")


def now() -> datetime:
    return datetime.now(timezone.utc)


def utc(d: datetime | None) -> datetime | None:
    """py-fsrs requires UTC datetimes; Postgres returns them in the session time zone."""
    if d is None:
        return None
    return d.replace(tzinfo=timezone.utc) if d.tzinfo is None else d.astimezone(timezone.utc)


def monday(d: date | None = None) -> date:
    d = d or date.today()
    return d - timedelta(days=d.weekday())


def familiarity(stability: float | None) -> int:
    if stability is None:
        return 0
    for limit, level in ((2, 1), (7, 2), (14, 3), (30, 4)):
        if stability < limit:
            return level
    return 5


# ---- FSRS state on user_word ------------------------------------------------------------------

def _card(row) -> Card | None:
    if row.fsrs_state is None:
        return None
    return Card(state=State(row.fsrs_state), step=None, stability=row.stability, difficulty=row.difficulty,
                due=utc(row.due_at), last_review=utc(row.last_review_at))


def _word(conn: Connection, user_id: int, lemma_id: int):
    return conn.execute(text("""SELECT * FROM lecture.user_word WHERE user_id = :u AND lemma_id = :l FOR UPDATE"""),
                        {"u": user_id, "l": lemma_id}).first()


def _quizzed(conn: Connection, user_id: int, lemma_id: int) -> bool:
    return bool(conn.execute(text("""SELECT 1 FROM lecture.review_log
        WHERE user_id = :u AND lemma_id = :l AND source = 'quiz' LIMIT 1"""), {"u": user_id, "l": lemma_id}).first())


def rate(conn: Connection, user_id: int, lemma_id: int, rating: Rating, at: datetime, source: str,
         response_ms: int | None = None) -> dict:
    """Apply one FSRS rating to a word and log it. Returns the new state."""
    at = utc(at)
    row = _word(conn, user_id, lemma_id)
    before = _card(row)
    card = before or Card(due=at)
    card, _ = SCHEDULER.review_card(card, rating, at)
    lapse = rating == Rating.Again and before is not None
    quizzed = source == "quiz" or _quizzed(conn, user_id, lemma_id)
    fam = familiarity(card.stability) if quizzed else 0
    conn.execute(text("""UPDATE lecture.user_word SET fsrs_state = :st, stability = :s, difficulty = :d, due_at = :due,
            last_review_at = :at, reps = reps + 1, lapses = lapses + :lapse, familiarity = :fam,
            status = CASE WHEN status = 'known' AND :rating = 1 THEN 'learning' ELSE status END
        WHERE user_id = :u AND lemma_id = :l"""),
                 {"st": int(card.state), "s": card.stability, "d": card.difficulty, "due": card.due, "at": at,
                  "lapse": int(lapse), "fam": fam, "rating": int(rating), "u": user_id, "l": lemma_id})
    conn.execute(text("""INSERT INTO lecture.review_log (user_id, lemma_id, rating, source, response_ms, state_before, reviewed_at)
        VALUES (:u, :l, :r, :src, :ms, CAST(:sb AS jsonb), :at)"""),
                 {"u": user_id, "l": lemma_id, "r": int(rating), "src": source, "ms": response_ms, "at": at,
                  "sb": json.dumps(before.to_dict()) if before else None})
    return {"familiarity": fam, "stability": card.stability, "due": card.due}


def _apply_lookup(conn: Connection, user_id: int, lemma_id: int, rating_name: str, at: datetime, row) -> None:
    if row.status == "ignored":
        return
    if row.status == "known" and rating_name == "known":
        return  # still knows it: stays out of review
    if row.last_review_at and utc(row.last_review_at).date() == utc(at).date():
        return  # same day: the log has it, no second rating
    rate(conn, user_id, lemma_id, LOOKUP_RATING[rating_name], at, "lookup")


def replay(conn: Connection, user_id: int, lemma_id: int) -> None:
    """Build FSRS state from the full lookup history of one word (words tapped before phase 2)."""
    events = conn.execute(text("""SELECT self_rating, created_at FROM lecture.lookup_event
        WHERE user_id = :u AND lemma_id = :l ORDER BY created_at, id"""), {"u": user_id, "l": lemma_id}).all()
    for i, (rating_name, at) in enumerate(events):
        rating_name = rating_name or "unknown"
        row = _word(conn, user_id, lemma_id)
        if i == 0 and rating_name == "known":
            continue  # first tap "known": word is known, not reviewed
        _apply_lookup(conn, user_id, lemma_id, rating_name, at, row)


def on_lookup(conn: Connection, user_id: int, lemma_id: int, rating_name: str, at: datetime) -> None:
    """Called for every new tap (after it is logged and user_word is upserted)."""
    row = _word(conn, user_id, lemma_id)
    if row.fsrs_state is None:
        replay(conn, user_id, lemma_id)  # includes the tap just logged
    else:
        _apply_lookup(conn, user_id, lemma_id, rating_name, at, row)


def ensure_fsrs(conn: Connection, user_id: int) -> None:
    for (lemma_id,) in conn.execute(text("""SELECT lemma_id FROM lecture.user_word
            WHERE user_id = :u AND fsrs_state IS NULL AND status = 'learning'"""), {"u": user_id}).all():
        replay(conn, user_id, lemma_id)


# ---- building a défi ---------------------------------------------------------------------------

def _norm(s: str) -> str:
    return s.strip().lower().replace("’", "'")


def _strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def _sentence(conn: Connection, token_id: int | None):
    """(sentence with the word blanked, the word as written, full sentence) from the place she first met it."""
    if not token_id:
        return None
    r = conn.execute(text("""SELECT t.surface, t.char_start, t.char_end, p.text FROM lecture.token t
        JOIN lecture.paragraph p ON p.id = t.paragraph_id WHERE t.id = :t"""), {"t": token_id}).first()
    if not r:
        return None
    starts = [0] + [m.end() for m in re.finditer(r"[.!?…]+[»\s]*\s", r.text) if m.end() <= r.char_start]
    start = starts[-1]
    m = re.search(r"[.!?…]+", r.text[r.char_end:])
    end = r.char_end + (m.end() if m else len(r.text) - r.char_end)
    sentence = r.text[start:end].strip()
    blanked = (r.text[start:r.char_start] + "_____" + r.text[r.char_end:end]).strip()
    return blanked, r.surface, sentence


def _lemma_info(conn: Connection, lemma_id: int, sense_id: int | None = None) -> dict:
    l = conn.execute(text("SELECT id, lemma, pos FROM lecture.lemma WHERE id = :l"), {"l": lemma_id}).one()
    definition = conn.execute(text("""SELECT definition_fr FROM lecture.sense WHERE lemma_id = :l AND source = 'petit_robert'
        AND definition_fr IS NOT NULL ORDER BY (id = :s) DESC, seq LIMIT 1"""), {"l": lemma_id, "s": sense_id or 0}).scalar()
    gloss = conn.execute(text("""SELECT gloss_en FROM lecture.sense WHERE lemma_id = :l AND source = 'wiktionary_en'
        ORDER BY seq LIMIT 1"""), {"l": lemma_id}).scalar()
    return {"id": l.id, "lemma": l.lemma, "pos": l.pos, "definition": definition, "gloss": gloss}


def _distractors(conn: Connection, user_id: int, target: dict, field: str, n: int = 3) -> list[str]:
    """Wrong choices: other words of the same kind, from her word bag first, then the dictionary.
    field 'surface': words as she met them in her books (conjugated/agreed), for fill-in-the-blank."""
    col = {"lemma": "l.lemma", "gloss": "s.gloss_en", "surface": "l.lemma"}[field]
    src = "" if field != "gloss" else "JOIN lecture.sense s ON s.lemma_id = l.id AND s.source = 'wiktionary_en' AND s.seq = 0"
    out: list[str] = []
    queries = []
    if field == "surface":
        queries.append(("""SELECT DISTINCT lower(t.surface) FROM lecture.user_word w JOIN lecture.lemma l ON l.id = w.lemma_id
             JOIN lecture.token t ON t.id = w.first_token_id
             WHERE w.user_id = :u AND l.pos = :p AND l.id <> :id""", {"u": user_id}))
    for q, params in queries + [
        (f"""SELECT DISTINCT {col} FROM lecture.user_word w JOIN lecture.lemma l ON l.id = w.lemma_id {src}
             WHERE w.user_id = :u AND l.pos = :p AND l.id <> :id""", {"u": user_id}),
        (f"""SELECT {col} FROM lecture.lemma l {src} WHERE l.pos = :p AND l.id <> :id
             AND l.id IN (SELECT lemma_id FROM lecture.sense WHERE source = 'petit_robert')
             ORDER BY random() LIMIT 40""", {}),
        (f"""SELECT {col} FROM lecture.lemma l {src} WHERE l.id <> :id ORDER BY random() LIMIT 40""", {}),
    ]:
        vals = [v for (v,) in conn.execute(text(q), {"p": target["pos"], "id": target["id"], **params}) if v]
        random.shuffle(vals)
        for v in vals:
            if _norm(v) != _norm(target.get(field) or "") and _norm(v) not in {_norm(x) for x in out} and len(v) < 120:
                out.append(v)
            if len(out) == n:
                return out
    return out


def _choices(answer: str, wrong: list[str]) -> list[str]:
    opts = [answer] + wrong
    random.shuffle(opts)
    return opts


def build_item(conn: Connection, user_id: int, word, kind: str) -> tuple[str, dict, dict]:
    """Return (type, prompt, expected) for a word, falling back when data for `kind` is missing."""
    info = _lemma_info(conn, word.lemma_id, conn.execute(
        text("SELECT sense_id FROM lecture.token WHERE id = :t"), {"t": word.first_token_id or 0}).scalar())
    order = {"meaning": ["meaning", "cloze", "definition", "dictation"],
             "cloze": ["cloze", "meaning", "definition", "dictation"],
             "definition": ["definition", "cloze", "meaning", "dictation"],
             "dictation": ["dictation", "definition", "cloze", "meaning"]}[kind]
    sent = _sentence(conn, word.first_token_id)
    for k in order:
        if k == "meaning" and info["gloss"]:
            wrong = _distractors(conn, user_id, info, "gloss")
            if len(wrong) >= 2:
                return k, {"word": info["lemma"], "choices": _choices(info["gloss"], wrong)}, {"answer": info["gloss"]}
        if k == "cloze" and sent:
            blanked, surface, full = sent
            wrong = _distractors(conn, user_id, {**info, "surface": surface}, "surface")
            if surface[:1].isupper():  # blank at the start of the sentence: same capitalisation for every choice
                wrong = [w[:1].upper() + w[1:] for w in wrong]
            if len(wrong) >= 2:
                return k, {"sentence": blanked, "choices": _choices(surface, wrong)}, {"answer": surface, "full": full}
        if k == "definition" and info["definition"]:
            wrong = _distractors(conn, user_id, info, "lemma")
            if len(wrong) >= 2:
                return k, {"definition": info["definition"], "choices": _choices(info["lemma"], wrong)}, \
                    {"answer": info["lemma"]}
        if k == "dictation":
            hint = info["definition"] or info["gloss"]
            return k, {"say": info["lemma"], "hint": hint}, {"answer": info["lemma"]}
    return "dictation", {"say": info["lemma"], "hint": None}, {"answer": info["lemma"]}


def kind_for(fam: int, i: int) -> str:
    if fam == 0:
        return "meaning" if i % 2 == 0 else "cloze"
    return "cloze" if fam <= 2 else "definition" if fam == 3 else "dictation"


def pick_words(conn: Connection, user_id: int) -> list:
    first_ever = not conn.execute(text("SELECT 1 FROM lecture.quiz WHERE user_id = :u LIMIT 1"), {"u": user_id}).first()
    quizzed = """EXISTS (SELECT 1 FROM lecture.review_log r WHERE r.user_id = w.user_id
                 AND r.lemma_id = w.lemma_id AND r.source = 'quiz')"""
    due = conn.execute(text(f"""SELECT w.* FROM lecture.user_word w
        WHERE w.user_id = :u AND w.status = 'learning' AND w.due_at < :horizon AND {quizzed}
        ORDER BY w.lapses DESC, w.due_at LIMIT :n"""),
                       # anything due before next Monday's défi is reviewed now (the next chance is a week away)
                       {"u": user_id, "horizon": now() + timedelta(days=7), "n": QUIZ_SIZE}).all()
    room = QUIZ_SIZE - len(due)
    new_cap = min(room, QUIZ_SIZE if first_ever else MAX_NEW)
    new = conn.execute(text(f"""SELECT w.* FROM lecture.user_word w
        WHERE w.user_id = :u AND w.status = 'learning' AND NOT {quizzed}
        ORDER BY w.lookup_count DESC, w.first_seen_at LIMIT :n"""), {"u": user_id, "n": new_cap}).all() if new_cap > 0 else []
    return list(due) + list(new)


def get_or_create_quiz(conn: Connection, user_id: int) -> int | None:
    week = monday()
    qid = conn.execute(text("SELECT id FROM lecture.quiz WHERE user_id = :u AND week_of = :w"),
                       {"u": user_id, "w": week}).scalar()
    if qid:
        return qid
    ensure_fsrs(conn, user_id)
    words = pick_words(conn, user_id)
    if not words:
        return None
    qid = conn.execute(text("INSERT INTO lecture.quiz (user_id, week_of) VALUES (:u, :w) RETURNING id"),
                       {"u": user_id, "w": week}).scalar()
    random.shuffle(words)
    for seq, w in enumerate(words, start=1):
        kind, prompt, expected = build_item(conn, user_id, w, kind_for(w.familiarity, seq))
        conn.execute(text("""INSERT INTO lecture.quiz_item (quiz_id, seq, lemma_id, item_type, prompt, expected)
            VALUES (:q, :s, :l, :t, CAST(:p AS jsonb), CAST(:e AS jsonb))"""),
                     {"q": qid, "s": seq, "l": w.lemma_id, "t": kind,
                      "p": json.dumps(prompt, ensure_ascii=False), "e": json.dumps(expected, ensure_ascii=False)})
    return qid


def check(item_type: str, expected: dict, response: str) -> tuple[bool, str | None]:
    """(correct, hint). Dictation must match exactly (accents included); case and apostrophe style do not matter."""
    ok = _norm(response) == _norm(expected["answer"])
    if not ok and item_type == "dictation" and _strip_accents(_norm(response)) == _strip_accents(_norm(expected["answer"])):
        return False, "Presque ! Attention aux accents."
    return ok, None


def answer(conn: Connection, user_id: int, item_id: int, response: str, response_ms: int | None) -> dict | None:
    item = conn.execute(text("""SELECT i.*, q.user_id, q.id AS qid FROM lecture.quiz_item i
        JOIN lecture.quiz q ON q.id = i.quiz_id WHERE i.id = :i AND q.user_id = :u FOR UPDATE OF i"""),
                        {"i": item_id, "u": user_id}).first()
    if not item:
        return None
    retry = bool(item.prompt.get("retry"))
    if item.answered_at is not None:  # double tap / resent request: same result, no second rating
        return _result(conn, item, item.correct, None, already=True)
    correct, hint = check(item.item_type, item.expected, response)
    at = now()
    conn.execute(text("""UPDATE lecture.quiz_item SET response = CAST(:r AS jsonb), correct = :c, response_ms = :ms,
        answered_at = :at WHERE id = :i"""),
                 {"r": json.dumps({"text": response}, ensure_ascii=False), "c": correct, "ms": response_ms,
                  "at": at, "i": item_id})
    state = None
    if not retry:
        w = conn.execute(text("SELECT familiarity FROM lecture.user_word WHERE user_id = :u AND lemma_id = :l"),
                         {"u": user_id, "l": item.lemma_id}).first()
        if w is not None:
            ms = response_ms or FAST_MS
            rating = (Rating.Again if not correct else
                      Rating.Easy if ms <= VERY_FAST_MS and w.familiarity >= 3 else
                      Rating.Good if ms <= FAST_MS else Rating.Hard)
            state = rate(conn, user_id, item.lemma_id, rating, at, "quiz", response_ms)
        if not correct:  # comes back once at the end, as another kind of question; logged only
            row = conn.execute(text("SELECT * FROM lecture.user_word WHERE user_id = :u AND lemma_id = :l"),
                               {"u": user_id, "l": item.lemma_id}).first()
            if row:
                nxt = TYPES[(TYPES.index(item.item_type) + 1) % len(TYPES)]
                kind, prompt, expected = build_item(conn, user_id, row, nxt)
                if kind == item.item_type and kind != "dictation":
                    kind, prompt, expected = build_item(conn, user_id, row, "dictation")
                prompt["retry"] = True
                seq = conn.execute(text("SELECT max(seq) + 1 FROM lecture.quiz_item WHERE quiz_id = :q"),
                                   {"q": item.qid}).scalar()
                conn.execute(text("""INSERT INTO lecture.quiz_item (quiz_id, seq, lemma_id, item_type, prompt, expected)
                    VALUES (:q, :s, :l, :t, CAST(:p AS jsonb), CAST(:e AS jsonb))"""),
                             {"q": item.qid, "s": seq, "l": item.lemma_id, "t": kind,
                              "p": json.dumps(prompt, ensure_ascii=False), "e": json.dumps(expected, ensure_ascii=False)})
    left = conn.execute(text("SELECT count(*) FROM lecture.quiz_item WHERE quiz_id = :q AND answered_at IS NULL"),
                        {"q": item.qid}).scalar()
    if left == 0:
        conn.execute(text("UPDATE lecture.quiz SET status = 'done', finished_at = coalesce(finished_at, :at) WHERE id = :q"),
                     {"q": item.qid, "at": at})
    return _result(conn, item, correct, hint, state=state, left=left)


def _result(conn: Connection, item, correct: bool, hint: str | None, state: dict | None = None,
            left: int | None = None, already: bool = False) -> dict:
    full = item.expected.get("full")
    if full is None:
        w = conn.execute(text("SELECT first_token_id FROM lecture.user_word WHERE user_id = :u AND lemma_id = :l"),
                         {"u": item.user_id, "l": item.lemma_id}).scalar()
        s = _sentence(conn, w)
        full = s[2] if s else None
    if left is None:
        left = conn.execute(text("SELECT count(*) FROM lecture.quiz_item WHERE quiz_id = :q AND answered_at IS NULL"),
                            {"q": item.qid}).scalar()
    return {"correct": bool(correct), "answer": item.expected["answer"], "hint": hint, "sentence": full,
            "familiarity": state["familiarity"] if state else None, "left": left, "already": already}


def quiz_view(conn: Connection, quiz_id: int) -> dict:
    q = conn.execute(text("SELECT id, week_of, status FROM lecture.quiz WHERE id = :q"), {"q": quiz_id}).one()
    items = conn.execute(text("""SELECT i.id, i.seq, i.item_type, i.prompt, i.correct, i.answered_at, i.lemma_id,
            l.lemma, w.familiarity
        FROM lecture.quiz_item i JOIN lecture.lemma l ON l.id = i.lemma_id
        JOIN lecture.quiz qz ON qz.id = i.quiz_id
        LEFT JOIN lecture.user_word w ON w.user_id = qz.user_id AND w.lemma_id = i.lemma_id
        WHERE i.quiz_id = :q ORDER BY i.seq"""), {"q": quiz_id}).all()
    first = [i for i in items if not i.prompt.get("retry")]
    return {
        "id": q.id, "week_of": q.week_of.isoformat(), "status": q.status,
        "items": [{"id": i.id, "seq": i.seq, "type": i.item_type, "prompt": i.prompt,
                   "answered": i.answered_at is not None, "correct": i.correct} for i in items],
        "summary": {
            "total": len(first),
            "correct": sum(1 for i in first if i.correct),
            "gold": sorted({i.lemma for i in first if i.correct and (i.familiarity or 0) >= 5}),
            "practice": sorted({i.lemma for i in first if i.answered_at is not None and not i.correct}),
        },
    }
