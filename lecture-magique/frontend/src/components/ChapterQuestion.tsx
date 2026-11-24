import { useEffect, useRef, useState } from "react";
import { api, ChapterQuestion as CQ, Evidence } from "../api";
import { Lang, strings } from "../i18n";
import { EvidenceLinks, KeyBox, readDraft, writeDraft } from "./Questions";

/** The chapter's question at the end of the chapter in the reader: she answers right after reading, while the text is
 *  still fresh. Saving first finishes the chapter (finish() — which is what unlocks the question), then saves the
 *  answer; the model answer and the evidence links come back at once. Answering is optional: the reader still has
 *  "finish without answering". Closed (choice) chapter questions are answered on the questions page. */
export default function ChapterQuestion({ q, lang, chapterDone, finish, onSaved, onEvidence }: {
  q: CQ; lang: Lang; chapterDone: boolean;
  /** finishes the chapter; false if it failed */
  finish: () => Promise<boolean>;
  onSaved: (q: CQ) => void;
  onEvidence: (e: Evidence) => void;
}) {
  const t = strings(lang);
  const [text, setText] = useState(() => readDraft(q.id) ?? q.answer?.body ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showKey, setShowKey] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = box.current;
    if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight + 2}px`; }
  }, [text]);

  const changed = text.trim() !== (q.answer?.body ?? "");
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      if (!chapterDone && !(await finish())) return;
      const r = await api.saveAnswer(q.id, text);
      writeDraft(q.id, null);
      onSaved({ ...q, answer: r.answer, key: r.key, grade: q.grade && { ...q.grade, for_latest: false } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card think cq-chapter" lang={lang}>
      <div className="think-title">{t.think}</div>
      <p className="cq-prompt">{q.prompt}</p>
      <textarea ref={box} className="cq-answer" value={text} placeholder={t.qPlaceholder} rows={3} lang={lang}
                spellCheck={false}
                onChange={(e) => { setText(e.target.value); writeDraft(q.id, e.target.value); }} />
      {!q.answer && <p className="muted small">{t.cqNote}</p>}
      <div className="cq-actions">
        <span className="grow" />
        {q.answer && !changed && <span className="cq-saved small">{t.qSaved}</span>}
        {(!q.answer || changed) && (
          <button className="btn primary" disabled={saving || !text.trim()} onClick={save}>
            {saving ? t.qSaving : !chapterDone ? t.cqSaveFinish : q.answer ? t.qUpdate : t.qSave}
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
      {q.answer && q.key?.evidence && q.key.evidence.length > 0 && (
        <EvidenceLinks ev={q.key.evidence} lang={lang} onGo={onEvidence} />
      )}
      {q.answer && <p className="muted small">{t.cqLater}</p>}
    </div>
  );
}
