import { useEffect, useState } from "react";
import { api, ArticleCard, Me } from "../api";
import { go } from "../App";
import { ThemePref } from "../prefs";
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

  useEffect(() => {
    api.articles().then(setItems, (e) => setError(e.message));
  }, []);

  const newest = items?.[0]?.week_of;

  return (
    <main className="shelf">
      <header className="topbar">
        <h1>Bonjour {me.display_name} 👋</h1>
        <div className="topbar-actions">
          <ThemeButton theme={theme} />
          <button className="btn ghost small" onClick={onLogout}>Sortir</button>
        </div>
      </header>
      <h2 className="shelf-title">Ma bibliothèque</h2>
      {error && <p className="error">{error}</p>}
      {items && items.length === 0 && <p className="muted">Pas encore de lecture ici. Bientôt !</p>}
      <div className="cards">
        {items?.map((a) => {
          const done = a.progress?.chapters_done.length ?? 0;
          const start = a.progress && !a.progress.finished ? a.progress.last_chapter : 1;
          return (
            <button key={a.id} className="card book" style={{ ["--h" as string]: hue(a.slug) }}
                    onClick={() => go(`/lire/${a.id}/${start}`)}>
              <div className="book-cover">📚</div>
              <div className="book-body">
                <div className="badges">
                  {a.week_of === newest && !a.progress && <span className="badge new">Nouveau</span>}
                  {a.status === "draft" && <span className="badge draft">Brouillon</span>}
                </div>
                <h3>{a.title}</h3>
                {a.source_note && <p className="muted small">{a.source_note}</p>}
                <p className="small">
                  {a.progress?.finished ? "Terminé ! 🎉" : a.progress ? `Reprendre au chapitre ${start}` : `${a.chapter_count} chapitres`}
                </p>
              </div>
              <Ring done={done} total={a.chapter_count} />
            </button>
          );
        })}
      </div>
    </main>
  );
}
