import { useEffect, useRef, useState } from "react";
import { api, AnswerKey, Question } from "../api";
import { go } from "../App";
import { Lang, strings } from "../i18n";
import { ThemePref } from "../prefs";
import ThemeButton from "./ThemeButton";

// Unsaved text survives a closed tab (per question, this browser only); cleared once saved.
const draftKey = (id: number) => `lm.qdraft.${id}`;
const readDraft = (id: number) => {
  try { return window.localStorage.getItem(draftKey(id)); } catch { return null; }
};
const writeDraft = (id: number, v: string | null) => {
  try {
    if (v === null) window.localStorage.removeItem(draftKey(id));
    else window.localStorage.setItem(draftKey(id), v);
  } catch { /* private mode: no draft */ }
};

function KeyBox({ k, lang }: { k: AnswerKey; lang: Lang }) {
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

function QuestionCard({ q, n, lang, articleId, onSaved }: {
  q: Question; n: number; lang: Lang; articleId: number; onSaved: (q: Question) => void;
}) {
  const t = strings(lang);
  const [text, setText] = useState(() => readDraft(q.id) ?? q.answer?.body ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showKey, setShowKey] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);

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
      onSaved({ ...q, answer: r.answer, key: r.key });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={`card cq-card${q.answer ? " answered" : ""}`} id={`q${q.id}`}>
      <div className="cq-head">
        <span className="cq-num">{n}</span>
        {q.chapter && <span className="small muted">{t.chapter} {q.chapter.seq}</span>}
        {q.kind === "writing" ? <span className="pill">{t.qWriting}</span> : q.skill && <span className="pill">{q.skill}</span>}
        {q.points && <span className="pill">{t.qPoints(q.points)}</span>}
      </div>
      <p className="cq-prompt">{q.prompt}</p>
      <textarea ref={box} className="cq-answer" value={text} placeholder={t.qPlaceholder} rows={q.kind === "writing" ? 6 : 3}
                lang={lang} spellCheck={false}
                onChange={(e) => { setText(e.target.value); writeDraft(q.id, e.target.value); }} />
      <div className="cq-actions">
        {q.chapter && (
          <button className="btn ghost small" onClick={() => go(`/lire/${articleId}/${q.chapter!.seq}`)}>
            📖 {t.qReread(q.chapter.seq)}
          </button>
        )}
        <span className="grow" />
        {q.answer && !changed && <span className="cq-saved small">{t.qSaved}</span>}
        {(!q.answer || changed) && (
          <button className="btn primary" disabled={saving || !text.trim()} onClick={save}>
            {saving ? t.qSaving : q.answer ? t.qUpdate : t.qSave}
          </button>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      {q.key && (
        <div>
          <button className="btn ghost small" onClick={() => setShowKey(!showKey)}>{showKey ? t.qHideKey : t.qShowKey}</button>
          {showKey && <KeyBox k={q.key} lang={lang} />}
        </div>
      )}
    </section>
  );
}

/** End-of-reading comprehension: the chapter questions and the questions about the whole text. Answers are saved;
 *  a possible answer (with what a good answer must contain) can be opened once she has written her own. */
export default function Questions({ articleId, theme }: { articleId: number; theme: [ThemePref, (t: ThemePref) => void, boolean] }) {
  const [data, setData] = useState<{ title: string; lang: Lang; questions: Question[] } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.questions(articleId).then((r) => setData({ title: r.article.title, lang: r.article.lang, questions: r.questions }),
      (e) => setError(e.message));
  }, [articleId]);

  const lang = data?.lang ?? "fr";
  const t = strings(lang);
  const qs = data?.questions ?? [];
  const byChapter = qs.filter((q) => q.chapter);
  const whole = qs.filter((q) => !q.chapter);
  const answered = qs.filter((q) => q.answer).length;
  const saved = (nq: Question) => setData((d) => d && { ...d, questions: d.questions.map((q) => (q.id === nq.id ? nq : q)) });

  return (
    <main className="questions" lang={lang}>
      <header className="topbar">
        <button className="btn ghost small" onClick={() => go("/")}>{t.library}</button>
        <ThemeButton theme={theme} />
      </header>
      {error && <p className="error">{error}</p>}
      {data && (
        <>
          <h1 className="page-title">{t.qTitle}</h1>
          <p className="cq-book">{data.title}</p>
          {qs.length === 0 ? <p className="muted">{t.qEmpty}</p> : (
            <>
              <p className="muted">{t.qIntro}</p>
              <div className="cq-progress">
                <div className="progress small-bar"><div className="bar" style={{ width: `${(100 * answered) / qs.length}%` }} /></div>
                <span className="small">{answered === qs.length ? t.qAllDone : t.qProgress(answered, qs.length)}</span>
              </div>
            </>
          )}
          {byChapter.length > 0 && <h2 className="bag-title">{t.qByChapter}</h2>}
          {byChapter.map((q, i) => <QuestionCard key={q.id} q={q} n={i + 1} lang={lang} articleId={articleId} onSaved={saved} />)}
          {whole.length > 0 && <h2 className="bag-title">{t.qWhole}</h2>}
          {whole.map((q, i) => <QuestionCard key={q.id} q={q} n={byChapter.length + i + 1} lang={lang} articleId={articleId} onSaved={saved} />)}
        </>
      )}
      {!data && !error && <p className="muted">…</p>}
    </main>
  );
}
