import { useEffect, useState } from "react";
import { api, ArticleCard, Me } from "../api";
import { go } from "../App";
import { LANGS, Lang, strings } from "../i18n";
import { ThemePref, usePref } from "../prefs";
import ThemeButton from "./ThemeButton";

function Ring({ done, total }: { done: number; total: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const f = total ? done / total : 0;
  return (
    <svg className="ring" viewBox="0 0 56 56" aria-label={`${done} chapitres sur ${total}`}>
      <circle cx="28" cy="28" r={r} className="ring-bg" />
      {f > 0 && <circle cx="28" cy="28" r={r} className="ring-fg" strokeDasharray={`${c * f} ${c}`} transform="rotate(-90 28 28)" />}
      <text x="28" y="33" textAnchor="middle">{f >= 1 ? "✓" : `${done}/${total}`}</text>
    </svg>
  );
}

function hue(slug: string) {
  let h = 0;
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export default function Shelf({ me, onLogout, theme }: {
  me: Me; onLogout: () => void; theme: [ThemePref, (t: ThemePref) => void, boolean];
}) {
  const [items, setItems] = useState<ArticleCard[] | null>(null);
  const [error, setError] = useState("");
  const [lang, setLang] = usePref<Lang>("lm.lang", "fr");

  useEffect(() => {
    api.articles().then(setItems, (e) => setError(e.message));
  }, []);

  const shown = items?.filter((a) => (a.lang ?? "fr") === lang);
  const newest = shown?.[0]?.week_of;
  const en = lang === "en";
  const sfx = en ? "/en" : "";
  // parents see every book's questions (to preview them); a child sees them once she has started the book
  const parent = me.role === "parent" || me.role === "admin";

  return (
    <main className="shelf">
      <header className="topbar">
        <h1>Bonjour {me.display_name} 👋</h1>
        <div className="topbar-actions">
          <ThemeButton theme={theme} />
          <button className="btn ghost small" onClick={onLogout}>Sortir</button>
        </div>
      </header>
      <div className="lang-switch" role="tablist" aria-label="Langue / Language">
        {LANGS.map((l) => (
          <button key={l.lang} role="tab" aria-selected={lang === l.lang} className={`chip big${lang === l.lang ? " on" : ""}`}
                  onClick={() => setLang(l.lang)}>
            {l.label}
            {items && <span className="count">{items.filter((a) => (a.lang ?? "fr") === l.lang).length}</span>}
          </button>
        ))}
      </div>
      <div className="quick">
        <button className="card quick-btn defi" onClick={() => go(`/defi${sfx}`)}>
          <span className="qi">⭐</span><span><b>{en ? "Weekly challenge" : "Défi de la semaine"}</b><br />
            <span className="small muted">{en ? "Practise your English words" : "Revois tes mots"}</span></span>
        </button>
        <button className="card quick-btn bag" onClick={() => go(`/mots${sfx}`)}>
          <span className="qi">👜</span><span><b>{en ? "My word bag" : "Mon sac à mots"}</b><br />
            <span className="small muted">{en ? "All the English words you looked up" : "Tous les mots que tu as cherchés"}</span></span>
        </button>
        {me.role === "student" && (
          <button className="card quick-btn suivi" onClick={() => go("/progres")}>
            <span className="qi">📊</span><span><b>Mes progrès</b><br /><span className="small muted">Ta lecture et tes mots, semaine par semaine</span></span>
          </button>
        )}
        {(me.role === "parent" || me.role === "admin") && (
          <button className="card quick-btn suivi" onClick={() => go("/suivi")}>
            <span className="qi">📊</span><span><b>Suivi</b><br /><span className="small muted">Progrès des enfants (parents)</span></span>
          </button>
        )}
      </div>
      <h2 className="shelf-title">{en ? "My English library" : "Ma bibliothèque"}</h2>
      {error && <p className="error">{error}</p>}
      {shown && shown.length === 0 && <p className="muted">{en ? "Nothing to read here yet. Soon!" : "Pas encore de lecture ici. Bientôt !"}</p>}
      <div className="cards">
        {shown?.map((a) => {
          const done = a.progress?.chapters_done.length ?? 0;
          const start = a.progress && !a.progress.finished ? a.progress.last_chapter : 1;
          return (
            <div key={a.id} className="book-wrap">
            <button className="card book" style={{ ["--h" as string]: hue(a.slug) }}
                    onClick={() => go(`/lire/${a.id}/${start}`)}>
              <div className="book-cover">📚</div>
              <div className="book-body">
                <div className="badges">
                  {a.week_of === newest && !a.progress && <span className="badge new">{en ? "New" : "Nouveau"}</span>}
                  {a.status === "draft" && <span className="badge draft">{en ? "Draft" : "Brouillon"}</span>}
                </div>
                <h3>{a.title}</h3>
                {a.source_note && <p className="muted small">{a.source_note}</p>}
                <p className="small">
                  {en
                    ? (a.progress?.finished ? "Finished! 🎉" : a.progress ? `Continue at chapter ${start}`
                      : a.chapter_count === 1 ? "1 part" : `${a.chapter_count} chapters`)
                    : (a.progress?.finished ? "Terminé ! 🎉" : a.progress ? `Reprendre au chapitre ${start}` : `${a.chapter_count} chapitres`)}
                </p>
              </div>
              <Ring done={done} total={a.chapter_count} />
            </button>
            {a.questions && a.questions.total > 0 && (parent || a.progress || a.questions.answered > 0) && (
              <button className={`chip q-chip${a.questions.answered === a.questions.total ? " on" : ""}`}
                      onClick={() => go(`/questions/${a.id}`)}>
                {strings(a.lang).qShelf(a.questions.answered, a.questions.total)}
              </button>
            )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
