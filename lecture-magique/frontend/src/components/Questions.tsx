import { useEffect, useRef, useState } from "react";
import { api, AnswerKey, ChapterData, Evidence, Question } from "../api";
import { go } from "../App";
import { Lang, strings } from "../i18n";
import { ThemePref } from "../prefs";
import ThemeButton from "./ThemeButton";

// Unsaved text survives a closed tab (per question, this browser only); cleared once saved.
const draftKey = (id: number) => `lm.qdraft.${id}`;
export const readDraft = (id: number) => {
  try { return window.localStorage.getItem(draftKey(id)); } catch { return null; }
};
export const writeDraft = (id: number, v: string | null) => {
  try {
    if (v === null) window.localStorage.removeItem(draftKey(id));
    else window.localStorage.setItem(draftKey(id), v);
  } catch { /* private mode: no draft */ }
};

// Two columns (questions | text) from this width; below it the text is pinned on top of the questions.
const WIDE = "(min-width: 900px)";

type Chapter = { seq: number; title: string | null };

// Finding a quote in a paragraph: spaces (incl. no-break ones), apostrophes and case don't count. Same rule as
// importer.article.norm_quote. normChar keeps one UTF-16 unit per unit, so a position found in the normalized
// paragraph is the same position in the original.
const SAME: Record<string, string> = { "\u00a0": " ", "\u202f": " ", "\u2009": " ", "\u2019": "'", "\u2018": "'",
  "\u02bc": "'", "\u201c": '"', "\u201d": '"' };
const normChar = (c: string) => { const m = SAME[c] ?? c; const l = m.toLowerCase(); return l.length === 1 ? l : m; };
const normText = (s: string) => s.split("").map(normChar).join("");

/** [start, end) of the quote in the paragraph, or null. The paragraph's own spaces are single already. */
export function findQuote(para: string, quote: string): [number, number] | null {
  const q = normText(quote).replace(/\s+/g, " ").trim();
  const i = q ? normText(para).indexOf(q) : -1;
  return i < 0 ? null : [i, i + q.length];
}

export type Mark = { seq: number; quote: string };

/** [4, 5, 6, 9] → "4–6, 9" */
function seqList(seqs: number[]): string {
  const out: string[] = [];
  for (let i = 0; i < seqs.length; i++) {
    let j = i;
    while (j + 1 < seqs.length && seqs[j + 1] === seqs[j] + 1) j++;
    out.push(j > i ? `${seqs[i]}–${seqs[j]}` : `${seqs[i]}`);
    i = j;
  }
  return out.join(", ");
}

export function KeyBox({ k, lang }: { k: AnswerKey; lang: Lang }) {
  const t = strings(lang);
  return (
    <div className="cq-key">
      <p className="small muted">{t.qCompare}</p>
      {k.model_answer && <p className="cq-model">{k.model_answer}</p>}
      {k.must_answer && <p className="small"><b>{t.qMust}</b> {k.must_answer}</p>}
      {k.avoid && <p className="small"><b>{t.qAvoid}</b> {k.avoid}</p>}
    </div>
  );
}

/** After she has answered: the passages that hold the answer; a tap opens the text there, highlighted. */
export function EvidenceLinks({ ev, lang, onGo }: { ev: Evidence[]; lang: Lang; onGo: (e: Evidence) => void }) {
  const t = strings(lang);
  const short = (q: string) => (q.length > 70 ? `${q.slice(0, 67).trimEnd()}…` : q);
  return (
    <div className="cq-evidence">
      <p className="small muted">{t.qEvidence}</p>
      {ev.map((e, i) => (
        <button key={i} className="cq-ev" onClick={() => onGo(e)}>
          <b>{t.qEvidenceGo(e.chapter)}</b> <span>{lang === "fr" ? `« ${short(e.quote)} »` : `“${short(e.quote)}”`}</span>
        </button>
      ))}
    </div>
  );
}

/** The chapter text, read-only, next to (or above) the questions: so she can look for evidence without leaving them. */
function TextPane({ articleId, seq, chapters, lang, mark, onSeq, onClose }: {
  articleId: number; seq: number; chapters: Chapter[]; lang: Lang; mark: Mark | null;
  onSeq: (n: number) => void; onClose: () => void;
}) {
  const t = strings(lang);
  const cache = useRef(new Map<number, ChapterData>());
  const [data, setData] = useState<ChapterData | null>(cache.current.get(seq) ?? null);
  const [error, setError] = useState("");
  const body = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setError("");
    const hit = cache.current.get(seq);
    if (hit) setData(hit);
    else {
      setData(null);
      api.chapter(articleId, seq).then((d) => { cache.current.set(seq, d); setData(d); }, (e) => setError(e.message));
    }
    body.current?.scrollTo({ top: 0 });
  }, [articleId, seq]);

  // bring the highlighted passage into the pane (only the pane scrolls: the question stays where it is)
  const quote = mark && mark.seq === seq ? mark.quote : null;
  useEffect(() => {
    const b = body.current;
    const m = b?.querySelector("mark");
    if (!b || !m) return;
    const top = m.getBoundingClientRect().top - b.getBoundingClientRect().top + b.scrollTop;
    b.scrollTo({ top: Math.max(0, top - b.clientHeight / 4), behavior: "smooth" });
  }, [data, quote]);

  const para = (text: string) => {
    const at = quote ? findQuote(text, quote) : null;
    if (!at) return text;
    return <>{text.slice(0, at[0])}<mark className="cq-mark">{text.slice(at[0], at[1])}</mark>{text.slice(at[1])}</>;
  };

  return (
    <aside className="card cq-pane" aria-label={`${t.chapter} ${seq}`} lang={lang}>
      <div className="cq-pane-head">
        <div className="cq-pane-tabs" role="tablist">
          {chapters.map((c) => (
            <button key={c.seq} role="tab" aria-selected={c.seq === seq} className={`chip${c.seq === seq ? " on" : ""}`}
                    title={c.title ?? undefined} onClick={() => onSeq(c.seq)}>{c.seq}</button>
          ))}
        </div>
        <button className="btn ghost small" onClick={onClose} aria-label={t.qCloseText}>✕</button>
      </div>
      <div className="cq-pane-body" ref={body}>
        <h3 className="cq-pane-title">{t.chapter} {seq}{data?.chapter.title ? ` · ${data.chapter.title}` : ""}</h3>
        {error && <p className="error">{error}</p>}
        {!data && !error && <p className="muted">…</p>}
        {data?.paragraphs.map((p) => <p key={p.id}>{para(p.text)}</p>)}
      </div>
    </aside>
  );
}

function ChoiceCard({ q, lang, onSaved }: { q: Question; lang: Lang; onSaved: (q: Question) => void }) {
  const t = strings(lang);
  const [picked, setPicked] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const done = q.answer !== null;
  const chosen = q.answer?.body ?? picked;
  const right = q.key?.correct;

  const check = async () => {
    if (!picked) return;
    setSaving(true);
    setError("");
    try {
      const r = await api.saveAnswer(q.id, picked);
      onSaved({ ...q, answer: r.answer, key: r.key, grade: r.grade });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className={`cq-choices${q.choices!.length === 2 ? " two" : ""}`} role="radiogroup">
        {q.choices!.map((c, i) => {
          const cls = done ? (c === right ? " right" : c === chosen ? " wrong" : " off") : c === picked ? " picked" : "";
          return (
            <button key={c} role="radio" aria-checked={c === chosen} className={`cq-choice${cls}`} disabled={done}
                    onClick={() => setPicked(c)}>
              {q.choices!.length > 2 && <span className="cq-letter">{"ABCDEFG"[i]}</span>}
              <span>{c}</span>
            </button>
          );
        })}
      </div>
      {!done && (
        <div className="cq-actions">
          <span className="grow" />
          <button className="btn primary" disabled={!picked || saving} onClick={check}>{saving ? t.qSaving : t.qCheck}</button>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {done && q.grade && (
        <div className={`cq-grade${q.grade.score > 0 ? " good" : " bad"}`}>
          <b>{q.grade.score > 0 ? t.qRight : t.qWrong}</b> <span className="small">({q.grade.score} / {q.grade.points})</span>
          {q.grade.score === 0 && right && <p><b>{t.qRightIs}</b> {right}</p>}
          {q.key?.model_answer && <p>{q.key.model_answer}</p>}
        </div>
      )}
    </>
  );
}

function QuestionCard({ q, n, lang, onSaved, onText }: {
  q: Question; n: number; lang: Lang; onSaved: (q: Question) => void;
  onText: (seq: number | null, qid: number, quote?: string) => void;
}) {
  const t = strings(lang);
  const [text, setText] = useState(() => readDraft(q.id) ?? q.answer?.body ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showKey, setShowKey] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const closed = q.kind === "choice" && !!q.choices;

  // grow with the answer instead of scrolling inside a small box
  useEffect(() => {
    const el = box.current;
    if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight + 2}px`; }
  }, [text]);

  const changed = text.trim() !== (q.answer?.body ?? "");
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const r = await api.saveAnswer(q.id, text);
      writeDraft(q.id, null);
      onSaved({ ...q, answer: r.answer, key: r.key, grade: q.grade && { ...q.grade, for_latest: false } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const textButton = (
    <button className="btn ghost small" onClick={() => onText(q.chapter?.seq ?? null, q.id)}>
      {q.chapter ? `📖 ${t.qReread(q.chapter.seq)}` : t.qOpenText}
    </button>
  );

  return (
    <section className={`card cq-card${q.answer ? " answered" : ""}`} id={`q${q.id}`}>
      <div className="cq-head">
        <span className="cq-num">{n}</span>
        {q.chapter && <span className="small muted">{t.chapter} {q.chapter.seq}</span>}
        {q.kind === "writing" ? <span className="pill">{t.qWriting}</span> : q.skill && <span className="pill">{q.skill}</span>}
        {q.points && <span className="pill">{t.qPoints(q.points)}</span>}
      </div>
      <p className="cq-prompt">{q.prompt}</p>
      {closed ? (
        <>
          <ChoiceCard q={q} lang={lang} onSaved={onSaved} />
          {!q.answer && <div className="cq-actions">{textButton}</div>}
        </>
      ) : (
        <>
          <textarea ref={box} className="cq-answer" value={text} placeholder={t.qPlaceholder} rows={q.kind === "writing" ? 6 : 3}
                    lang={lang} spellCheck={false}
                    onChange={(e) => { setText(e.target.value); writeDraft(q.id, e.target.value); }} />
          <div className="cq-actions">
            {textButton}
            <span className="grow" />
            {q.answer && !changed && <span className="cq-saved small">{t.qSaved}</span>}
            {(!q.answer || changed) && (
              <button className="btn primary" disabled={saving || !text.trim()} onClick={save}>
                {saving ? t.qSaving : q.answer ? t.qUpdate : t.qSave}
              </button>
            )}
          </div>
          {error && <p className="error">{error}</p>}
          {q.grade && (
            <div className={`cq-grade${q.grade.for_latest ? "" : " old"}`}>
              <b>{t.qGrade(q.grade.score, q.grade.points)}</b>
              {q.grade.feedback && <p>{q.grade.feedback}</p>}
              {!q.grade.for_latest && <p className="small muted">{t.qGradeOld}</p>}
            </div>
          )}
          {q.key && (
            <div>
              <button className="btn ghost small" onClick={() => setShowKey(!showKey)}>{showKey ? t.qHideKey : t.qShowKey}</button>
              {showKey && <KeyBox k={q.key} lang={lang} />}
            </div>
          )}
        </>
      )}
      {q.answer && q.key?.evidence && q.key.evidence.length > 0 && (
        <EvidenceLinks ev={q.key.evidence} lang={lang} onGo={(e) => onText(e.chapter, q.id, e.quote)} />
      )}
    </section>
  );
}

/** End-of-reading comprehension: the chapter questions, then closed questions (multiple choice, vrai/faux, marked at
 *  once), then open questions about the whole text. The text can be opened beside the questions to look for evidence. */
export default function Questions({ articleId, theme }: { articleId: number; theme: [ThemePref, (t: ThemePref) => void, boolean] }) {
  const [data, setData] = useState<{ title: string; lang: Lang; chapters: Chapter[]; questions: Question[];
                                     locked: { chapters: number[]; end: number } } | null>(null);
  const [error, setError] = useState("");
  const [pane, setPane] = useState<number | null>(null);
  const [mark, setMark] = useState<Mark | null>(null);

  useEffect(() => {
    api.questions(articleId).then((r) => setData({ title: r.article.title, lang: r.article.lang, chapters: r.chapters,
                                                   questions: r.questions, locked: r.locked ?? { chapters: [], end: 0 } }),
                                     (e) => setError(e.message));
  }, [articleId]);

  const lang = data?.lang ?? "fr";
  const t = strings(lang);
  const qs = data?.questions ?? [];
  const byChapter = qs.filter((q) => q.chapter);
  const closed = qs.filter((q) => !q.chapter && q.kind === "choice");
  const open = qs.filter((q) => !q.chapter && q.kind !== "choice");
  const answered = qs.filter((q) => q.answer).length;
  const saved = (nq: Question) => setData((d) => d && { ...d, questions: d.questions.map((q) => (q.id === nq.id ? nq : q)) });

  // Open the text at a chapter (end questions: keep the chapter already open), then bring the question back into
  // view: below the pinned text on a narrow screen, at the top of its column on a wide one.
  const openText = (seq: number | null, qid?: number, quote?: string) => {
    setPane((cur) => seq ?? cur ?? 1);
    setMark(seq !== null && quote ? { seq, quote } : null);
    if (qid === undefined) return;
    window.setTimeout(() => {
      const el = document.getElementById(`q${qid}`);
      const paneEl = document.querySelector(".cq-pane") as HTMLElement | null;
      if (!el) return;
      const offset = window.matchMedia(WIDE).matches || !paneEl ? 12 : paneEl.offsetHeight + 12;
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: "smooth" });
    }, 60);
  };

  let n = 0;
  const card = (q: Question) => <QuestionCard key={q.id} q={q} n={++n} lang={lang} onSaved={saved} onText={openText} />;

  return (
    <main className={`questions${pane !== null ? " with-pane" : ""}`} lang={lang}>
      <header className="topbar">
        <button className="btn ghost small" onClick={() => go("/")}>{t.library}</button>
        <ThemeButton theme={theme} />
      </header>
      {error && <p className="error">{error}</p>}
      {!data && !error && <p className="muted">…</p>}
      {data && (
        <div className="cq-layout">
          {pane !== null && (
            <TextPane articleId={articleId} seq={pane} chapters={data.chapters} lang={lang} mark={mark} onSeq={setPane}
                      onClose={() => { setPane(null); setMark(null); }} />
          )}
          <div className="cq-list">
            <h1 className="page-title">{t.qTitle}</h1>
            <p className="cq-book">{data.title}</p>
            {(data.locked.chapters.length > 0 || data.locked.end > 0) && (
              <div className="card cq-locked small">
                {data.locked.chapters.length > 0 && <p>{t.qLockedChapters(seqList(data.locked.chapters))}</p>}
                {data.locked.end > 0 && <p>{t.qLockedEnd(data.locked.end)}</p>}
              </div>
            )}
            {qs.length === 0 ? (data.locked.chapters.length || data.locked.end ? null : <p className="muted">{t.qEmpty}</p>) : (
              <>
                <p className="muted">{t.qIntro}</p>
                <div className="cq-progress">
                  <div className="progress small-bar"><div className="bar" style={{ width: `${(100 * answered) / qs.length}%` }} /></div>
                  <span className="small">{answered === qs.length ? t.qAllDone : t.qProgress(answered, qs.length)}</span>
                </div>
                {pane === null && <button className="btn ghost small" onClick={() => openText(null)}>{t.qShowText}</button>}
              </>
            )}
            {byChapter.length > 0 && <h2 className="bag-title">{t.qByChapter}</h2>}
            {byChapter.map(card)}
            {closed.length > 0 && <h2 className="bag-title">{t.qClosed}</h2>}
            {closed.length > 0 && <p className="small muted">{t.qClosedNote}</p>}
            {closed.map(card)}
            {open.length > 0 && <h2 className="bag-title">{byChapter.length || closed.length ? t.qOpen : t.qWhole}</h2>}
            {open.map(card)}
          </div>
        </div>
      )}
    </main>
  );
}
