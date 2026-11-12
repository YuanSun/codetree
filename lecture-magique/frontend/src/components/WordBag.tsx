import { useEffect, useState } from "react";
import { api, BagWord } from "../api";
import { go } from "../App";
import { ThemePref } from "../prefs";
import { canSpeak, speak } from "../speech";
import ThemeButton from "./ThemeButton";

const SECTIONS: { group: BagWord["group"]; title: string; note: string }[] = [
  { group: "mastered", title: "✨ Maîtrisés", note: "Tu les retiens depuis plus d’un mois." },
  { group: "learning", title: "📈 En cours", note: "Tu les as déjà revus dans un défi." },
  { group: "new", title: "🆕 Nouveaux", note: "Cherchés en lisant, pas encore revus." },
  { group: "known", title: "✓ Déjà connus", note: "Tu as dit « je connais » la première fois." },
];

function Dots({ n }: { n: number }) {
  return (
    <span className="dots" aria-label={`familiarité ${n} sur 5`}>
      {[1, 2, 3, 4, 5].map((i) => <span key={i} className={i <= n ? "on" : ""} />)}
    </span>
  );
}

function Highlight({ sentence, surface }: { sentence: string; surface: string | null }) {
  if (!surface) return <>{sentence}</>;
  const i = sentence.indexOf(surface);
  if (i < 0) return <>{sentence}</>;
  return <>{sentence.slice(0, i)}<mark>{surface}</mark>{sentence.slice(i + surface.length)}</>;
}

export default function WordBag({ theme }: { theme: [ThemePref, (t: ThemePref) => void, boolean] }) {
  const [words, setWords] = useState<BagWord[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => { api.words().then(setWords, (e) => setError(e.message)); }, []);

  return (
    <main className="bag">
      <header className="topbar">
        <button className="btn ghost small" onClick={() => go("/")}>← Bibliothèque</button>
        <h1 className="page-title">👜 Mon sac à mots</h1>
        <ThemeButton theme={theme} />
      </header>
      {error && <p className="error">{error}</p>}
      {words && words.length === 0 && <p className="muted">Ton sac est vide. Touche les mots que tu ne connais pas en lisant !</p>}
      {words && words.length > 0 && (
        <p className="bag-count">
          {words.length} mots · <b>{words.filter((w) => w.group === "mastered").length}</b> en or
        </p>
      )}
      {words && SECTIONS.map((s) => {
        const list = words.filter((w) => w.group === s.group);
        if (!list.length) return null;
        return (
          <section key={s.group}>
            <h2 className="bag-title">{s.title} <span className="muted small">({list.length})</span></h2>
            <p className="muted small">{s.note}</p>
            <div className="bag-grid">
              {list.map((w) => (
                <button key={w.lemma_id} className={`card wcard f${w.group === "known" ? "k" : w.familiarity}`}
                        onClick={() => setOpen(open === w.lemma_id ? null : w.lemma_id)} aria-expanded={open === w.lemma_id}>
                  <span className="wcard-word">{w.lemma}</span>
                  {w.group !== "known" && <Dots n={w.familiarity} />}
                  {open === w.lemma_id && (
                    <span className="wcard-more">
                      {w.definition && <span className="wcard-def">{w.definition}</span>}
                      {!w.definition && w.gloss && <span className="wcard-def"><span className="en-tag">EN</span> {w.gloss}</span>}
                      {w.sentence && <span className="wcard-sent">« <Highlight sentence={w.sentence} surface={w.surface} /> »</span>}
                      <span className="small muted">Cherché {w.lookups} fois</span>
                      {canSpeak() && (
                        <span role="button" tabIndex={0} className="btn icon speak"
                              onClick={(e) => { e.stopPropagation(); speak(w.lemma); }}>🔊</span>
                      )}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}
