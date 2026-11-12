import { FormEvent, useEffect, useRef, useState } from "react";
import { AnswerResult, api, Quiz, QuizItem } from "../api";
import { go } from "../App";
import { ThemePref } from "../prefs";
import { canSpeak, speak } from "../speech";
import ThemeButton from "./ThemeButton";

const ACCENTS = ["é", "è", "ê", "à", "â", "ç", "ù", "û", "î", "ï", "ô", "ë", "œ"];

function Prompt({ item }: { item: QuizItem }) {
  const p = item.prompt;
  switch (item.type) {
    case "meaning":
      return (
        <>
          <p className="q-ask">Que veut dire ce mot ?</p>
          <p className="q-word">{p.word} {canSpeak() && <button className="btn icon speak" onClick={() => speak(p.word!)}>🔊</button>}</p>
        </>
      );
    case "cloze":
      return (
        <>
          <p className="q-ask">Quel mot manque dans la phrase de ton livre ?</p>
          <p className="q-sentence">{p.sentence}</p>
        </>
      );
    case "definition":
      return (
        <>
          <p className="q-ask">Quel mot correspond à cette définition ?</p>
          <p className="q-def">{p.definition}</p>
        </>
      );
    default:
      return (
        <>
          <p className="q-ask">Écoute et écris le mot (avec les accents !)</p>
          {canSpeak() && <button className="btn big listen" onClick={() => speak(p.say!)}>🔊 Écouter</button>}
          {p.hint && <p className="q-hint">Indice : {p.hint}</p>}
        </>
      );
  }
}

export default function Defi({ theme }: { theme: [ThemePref, (t: ThemePref) => void, boolean] }) {
  const [quiz, setQuiz] = useState<Quiz | null | undefined>(undefined);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [typed, setTyped] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const shownAt = useRef(performance.now());
  const inputRef = useRef<HTMLInputElement>(null);

  const load = () => api.quiz().then((r) => { setQuiz(r.quiz); setMessage(r.message ?? ""); }, (e) => setError(e.message));
  useEffect(() => { void load(); }, []);

  const item = quiz?.items.find((i) => !i.answered) ?? null;
  const answeredCount = quiz ? quiz.items.filter((i) => i.answered).length : 0;

  useEffect(() => {
    shownAt.current = performance.now();
    setTyped("");
    if (item?.type === "dictation") {
      speak(item.prompt.say!);
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
      if (r.correct && item.type !== "meaning") speak(r.answer, 0.9);  // French words only, not English glosses
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur, réessaie.");
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
      <button className="btn ghost small" onClick={() => go("/")}>← Bibliothèque</button>
      <h1 className="page-title">⭐ Défi de la semaine</h1>
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
          <h2>Défi terminé !</h2>
          <p className="score">{s.correct} / {s.total} du premier coup</p>
          {s.gold.length > 0 && (
            <>
              <p className="small muted">Mots maîtrisés (en or ✨)</p>
              <div className="chips">{s.gold.map((w) => <span key={w} className="wchip f5">{w}</span>)}</div>
            </>
          )}
          {s.practice.length > 0 && (
            <>
              <p className="small muted">À revoir</p>
              <div className="chips">{s.practice.map((w) => <span key={w} className="wchip f1">{w}</span>)}</div>
            </>
          )}
          <p className="small muted">Prochain défi lundi prochain.</p>
          <button className="btn primary" onClick={() => go("/mots")}>👜 Mon sac à mots</button>
        </div>
      </main>
    );
  }

  const shown = result ? quiz.items.find((i) => i.id === (item?.id ?? -1)) ?? item : item;
  const total = quiz.items.length;
  return (
    <main className="defi">
      {header}
      <div className="progress" aria-label={`${answeredCount} sur ${total}`}>
        <div className="bar" style={{ width: `${(100 * answeredCount) / total}%` }} />
      </div>
      {shown && (
        <div className="card q-card" key={shown.id}>
          {shown.prompt.retry && <span className="badge retry">Encore une fois !</span>}
          <Prompt item={shown} />
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
                     autoCapitalize="none" autoCorrect="off" spellCheck={false} lang="fr" aria-label="Ta réponse" />
              <div className="accents">
                {ACCENTS.map((a) => (
                  <button type="button" key={a} className="chip" disabled={!!result}
                          onClick={() => { setTyped(typed + a); inputRef.current?.focus(); }}>{a}</button>
                ))}
              </div>
              <button className="btn primary" disabled={!!result || busy || !typed.trim()}>Valider</button>
            </form>
          )}

          {result && (
            <div className={`feedback ${result.correct ? "ok" : "ko"}`}>
              {result.correct ? (
                <p className="fb-title">{result.familiarity === 5 ? "✨ Bravo, ce mot est maîtrisé !" : "✓ Bravo !"}</p>
              ) : (
                <>
                  <p className="fb-title">✗ La bonne réponse : <b>{result.answer}</b></p>
                  {result.hint && <p>{result.hint}</p>}
                </>
              )}
              {result.sentence && <p className="fb-sentence">« {result.sentence} »</p>}
              <button className="btn primary" onClick={() => void next()}>
                {result.left > 0 ? "Suivant →" : "Voir mon résultat"}
              </button>
            </div>
          )}
          {error && <p className="error">{error}</p>}
        </div>
      )}
    </main>
  );
}
