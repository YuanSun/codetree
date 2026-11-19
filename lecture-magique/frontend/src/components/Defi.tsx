import { FormEvent, useEffect, useRef, useState } from "react";
import { AnswerResult, api, Quiz, QuizItem } from "../api";
import { go } from "../App";
import { ThemePref } from "../prefs";
import { canSpeak, speak } from "../speech";
import ThemeButton from "./ThemeButton";
import { Lang, Strings, strings } from "../i18n";

const ACCENTS = ["é", "è", "ê", "à", "â", "ç", "ù", "û", "î", "ï", "ô", "ë", "œ"];

function Prompt({ item, t, lang }: { item: QuizItem; t: Strings; lang: Lang }) {
  const p = item.prompt;
  switch (item.type) {
    case "meaning":
      return (
        <>
          <p className="q-ask">{t.defiMeaning}</p>
          <p className="q-word">{p.word} {canSpeak() && <button className="btn icon speak" onClick={() => speak(p.word!, 0.85, lang)}>🔊</button>}</p>
        </>
      );
    case "cloze":
      return (
        <>
          <p className="q-ask">{t.defiCloze}</p>
          <p className="q-sentence">{p.sentence}</p>
        </>
      );
    case "definition":
      return (
        <>
          <p className="q-ask">{t.defiDefinition}</p>
          <p className="q-def">{p.definition}</p>
        </>
      );
    default:
      return (
        <>
          <p className="q-ask">{t.defiDictation}</p>
          {canSpeak() && <button className="btn big listen" onClick={() => speak(p.say!, 0.85, lang)}>{t.listenBtn}</button>}
          {p.hint && <p className="q-hint">{t.hint} {p.hint}</p>}
        </>
      );
  }
}

export default function Defi({ theme, lang = "fr" }: { theme: [ThemePref, (t: ThemePref) => void, boolean]; lang?: Lang }) {
  const t = strings(lang);
  const [quiz, setQuiz] = useState<Quiz | null | undefined>(undefined);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [typed, setTyped] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const shownAt = useRef(performance.now());
  const inputRef = useRef<HTMLInputElement>(null);

  const load = () => api.quiz(lang).then((r) => { setQuiz(r.quiz); setMessage(r.message ?? ""); }, (e) => setError(e.message));
  useEffect(() => { void load(); }, []);

  const item = quiz?.items.find((i) => !i.answered) ?? null;
  const answeredCount = quiz ? quiz.items.filter((i) => i.answered).length : 0;

  useEffect(() => {
    shownAt.current = performance.now();
    setTyped("");
    if (item?.type === "dictation") {
      speak(item.prompt.say!, 0.85, lang);
      window.setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [item?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(response: string) {
    if (!item || busy || result) return;
    setPicked(response);
    setBusy(true);
    setError("");
    try {
      const r = await api.answer(item.id, response, Math.round(performance.now() - shownAt.current));
      setResult(r);
      // the word itself, not a definition (meaning questions answer with a gloss)
      if (r.correct && item.type !== "meaning") speak(r.answer, 0.9, lang);
    } catch (e) {
      setError(e instanceof Error ? e.message : lang === "en" ? "Error, try again." : "Erreur, réessaie.");
    } finally {
      setBusy(false);
    }
  }

  async function next() {
    setResult(null);
    await load();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && result) { e.preventDefault(); void next(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const header = (
    <header className="topbar">
      <button className="btn ghost small" onClick={() => go("/")}>{t.library}</button>
      <h1 className="page-title">{t.defiTitle}</h1>
      <ThemeButton theme={theme} />
    </header>
  );

  if (quiz === undefined) return <div className="splash">⭐</div>;
  if (quiz === null)
    return <main className="defi">{header}<div className="card q-card"><p>{message || error}</p></div></main>;

  if (!item && !result) {
    const s = quiz.summary;
    return (
      <main className="defi">
        {header}
        <div className="card q-card done">
          <div className="bravo-pop">🏆</div>
          <h2>{t.defiDone}</h2>
          <p className="score">{t.firstTry(s.correct, s.total)}</p>
          {s.gold.length > 0 && (
            <>
              <p className="small muted">{t.goldWords}</p>
              <div className="chips">{s.gold.map((w) => <span key={w} className="wchip f5">{w}</span>)}</div>
            </>
          )}
          {s.practice.length > 0 && (
            <>
              <p className="small muted">{t.toReview}</p>
              <div className="chips">{s.practice.map((w) => <span key={w} className="wchip f1">{w}</span>)}</div>
            </>
          )}
          <p className="small muted">{t.nextDefi}</p>
          <button className="btn primary" onClick={() => go(lang === "en" ? "/mots/en" : "/mots")}>{t.bagTitle}</button>
        </div>
      </main>
    );
  }

  const shown = result ? quiz.items.find((i) => i.id === (item?.id ?? -1)) ?? item : item;
  const total = quiz.items.length;
  return (
    <main className="defi">
      {header}
      <div className="progress" aria-label={`${answeredCount} / ${total}`}>
        <div className="bar" style={{ width: `${(100 * answeredCount) / total}%` }} />
      </div>
      {shown && (
        <div className="card q-card" key={shown.id}>
          {shown.prompt.retry && <span className="badge retry">{t.again}</span>}
          <Prompt item={shown} t={t} lang={lang} />
          {shown.prompt.choices ? (
            <div className="choices">
              {shown.prompt.choices.map((c) => {
                const cls = result ? (c === result.answer ? " right" : c === picked ? " wrong" : "") : "";
                return (
                  <button key={c} className={`btn choice${cls}`} disabled={!!result || busy} onClick={() => submit(c)}>
                    {c}
                  </button>
                );
              })}
            </div>
          ) : (
            <form className="dictation" onSubmit={(e: FormEvent) => { e.preventDefault(); void submit(typed); }}>
              <input ref={inputRef} value={typed} onChange={(e) => setTyped(e.target.value)} disabled={!!result}
                     autoCapitalize="none" autoCorrect="off" spellCheck={false} lang={lang} aria-label={t.yourAnswer} />
              {lang === "fr" && <div className="accents">
                {ACCENTS.map((a) => (
                  <button type="button" key={a} className="chip" disabled={!!result}
                          onClick={() => { setTyped(typed + a); inputRef.current?.focus(); }}>{a}</button>
                ))}
              </div>}
              <button className="btn primary" disabled={!!result || busy || !typed.trim()}>{t.submit}</button>
            </form>
          )}

          {result && (
            <div className={`feedback ${result.correct ? "ok" : "ko"}`}>
              {result.correct ? (
                <p className="fb-title">{result.familiarity === 5 ? t.mastered : t.bravo}</p>
              ) : (
                <>
                  <p className="fb-title">{t.rightAnswer} <b>{result.answer}</b></p>
                  {result.hint && <p>{result.hint}</p>}
                </>
              )}
              {result.sentence && <p className="fb-sentence">{t.quoteOpen}{result.sentence}{t.quoteClose}</p>}
              <button className="btn primary" onClick={() => void next()}>
                {result.left > 0 ? t.next : t.seeResult}
              </button>
            </div>
          )}
          {error && <p className="error">{error}</p>}
        </div>
      )}
    </main>
  );
}
