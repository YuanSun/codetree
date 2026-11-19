import { useEffect, useState } from "react";
import { api, BagWord } from "../api";
import { go } from "../App";
import { ThemePref } from "../prefs";
import { canSpeak, speak } from "../speech";
import ThemeButton from "./ThemeButton";
import { Lang, strings } from "../i18n";

const GROUPS: BagWord["group"][] = ["mastered", "learning", "new", "known"];

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

export default function WordBag({ theme, lang = "fr" }: { theme: [ThemePref, (t: ThemePref) => void, boolean]; lang?: Lang }) {
  const t = strings(lang);
  const [words, setWords] = useState<BagWord[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [removed, setRemoved] = useState<BagWord | null>(null);
  const [showEn, setShowEn] = useState<number | null>(null);

  // A word tapped by mistake: out of the bag (and of the défi) at once, with an undo while the note shows.
  const remove = async (w: BagWord) => {
    try { await api.removeWord(w.lemma_id); } catch (e) { setError((e as Error).message); return; }
    setWords((ws) => ws && ws.filter((x) => x.lemma_id !== w.lemma_id));
    setOpen(null);
    setRemoved(w);
  };
  const undo = async () => {
    const w = removed;
    if (!w) return;
    setRemoved(null);
    try { await api.restoreWord(w.lemma_id, w.group === "known" ? "known" : "learning"); }
    catch (e) { setError((e as Error).message); return; }
    setWords((ws) => ws && [...ws, w].sort((a, b) => b.familiarity - a.familiarity));
  };
  useEffect(() => {
    if (!removed) return;
    const id = window.setTimeout(() => setRemoved(null), 8000);
    return () => window.clearTimeout(id);
  }, [removed]);

  useEffect(() => { api.words(lang).then(setWords, (e) => setError(e.message)); }, [lang]);

  return (
    <main className="bag">
      <header className="topbar">
        <button className="btn ghost small" onClick={() => go("/")}>{t.library}</button>
        <h1 className="page-title">{t.bagTitle}</h1>
        <ThemeButton theme={theme} />
      </header>
      {error && <p className="error">{error}</p>}
      {words && words.length === 0 && <p className="muted">{t.bagEmpty}</p>}
      {words && words.length > 0 && (
        <p className="bag-count">
          {t.bagCount(words.length)} · <b>{words.filter((w) => w.group === "mastered").length}</b> {t.inGold}
        </p>
      )}
      {words && GROUPS.map((group) => {
        const list = words.filter((w) => w.group === group);
        if (!list.length) return null;
        const [title, note] = t.bagSections[group];
        return (
          <section key={group}>
            <h2 className="bag-title">{title} <span className="muted small">({list.length})</span></h2>
            <p className="muted small">{note}</p>
            <div className="bag-grid">
              {list.map((w) => (
                <button key={w.lemma_id} className={`card wcard f${w.group === "known" ? "k" : w.familiarity}`}
                        onClick={() => setOpen(open === w.lemma_id ? null : w.lemma_id)} aria-expanded={open === w.lemma_id}>
                  <span className="wcard-word">{w.lemma}</span>
                  {w.group !== "known" && <Dots n={w.familiarity} />}
                  {open === w.lemma_id && (
                    <span className="wcard-more">
                      {w.definition && <span className="wcard-def">{w.definition}</span>}
                      {w.definition && w.gloss && lang === "fr" && (showEn === w.lemma_id ? (
                        <span className="wcard-def"><span className="en-tag">EN</span> {w.gloss}</span>
                      ) : (
                        <span role="button" tabIndex={0} className="btn ghost small en-btn"
                              onClick={(e) => { e.stopPropagation(); setShowEn(w.lemma_id); }}
                              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setShowEn(w.lemma_id); } }}>
                          🇬🇧 In English
                        </span>
                      ))}
                      {!w.definition && w.gloss && (
                        <span className="wcard-def">{lang === "fr" && <span className="en-tag">EN</span>} {w.gloss}</span>
                      )}
                      {w.sentence && (
                        <span className="wcard-sent">{t.quoteOpen}<Highlight sentence={w.sentence} surface={w.surface} />{t.quoteClose}</span>
                      )}
                      <span className="small muted">{t.lookedUp(w.lookups)}</span>
                      {canSpeak() && (
                        <span role="button" tabIndex={0} className="btn icon speak"
                              onClick={(e) => { e.stopPropagation(); speak(w.lemma, 0.85, lang); }}>🔊</span>
                      )}
                      <span role="button" tabIndex={0} className="btn ghost small remove"
                            onClick={(e) => { e.stopPropagation(); void remove(w); }}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); void remove(w); } }}>
                        🗑 {t.remove}
                      </span>
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>
        );
      })}
      {removed && (
        <div className="undo-bar" role="status">
          <span>{t.removed(removed.lemma)}</span>
          <button className="btn small" onClick={undo}>{t.undo}</button>
        </div>
      )}
    </main>
  );
}
