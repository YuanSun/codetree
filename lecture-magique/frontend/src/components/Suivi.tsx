import { useEffect, useState } from "react";
import { api, ChildReport } from "../api";
import { go } from "../App";
import { ThemePref } from "../prefs";
import BarChart from "./BarChart";
import ThemeButton from "./ThemeButton";

const short = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

function Tile({ value, label, note }: { value: number | string; label: string; note?: string }) {
  return (
    <div className="card tile">
      <div className="tile-value">{value}</div>
      <div className="tile-label">{label}</div>
      {note && <div className="small muted">{note}</div>}
    </div>
  );
}

function Highlight({ sentence, surface }: { sentence: string; surface: string | null }) {
  const i = surface ? sentence.indexOf(surface) : -1;
  if (!surface || i < 0) return <>{sentence}</>;
  return <>{sentence.slice(0, i)}<mark>{surface}</mark>{sentence.slice(i + surface.length)}</>;
}

/** Parents: any child's progress (child picker). self: the logged-in child's own progress, kid-friendly words. */
export default function Suivi({ theme, self = false }: { theme: [ThemePref, (t: ThemePref) => void, boolean]; self?: boolean }) {
  const [kids, setKids] = useState<{ id: number; display_name: string }[] | null>(null);
  const [kid, setKid] = useState<number | null>(null);
  const [rep, setRep] = useState<ChildReport | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (self) { api.myReport(8).then(setRep, (e) => setError(e.message)); return; }
    api.children().then((k) => { setKids(k); if (k.length) setKid(k[0].id); }, (e) => setError(e.message));
  }, [self]);
  useEffect(() => {
    if (self || kid === null) return;
    setRep(null);
    api.report(kid, 8).then(setRep, (e) => setError(e.message));
  }, [kid, self]);

  const thisWeek = rep ? rep.weeks[rep.weeks.length - 1] : undefined;
  const lastDefi = rep ? [...rep.weeks].reverse().find((w) => w.defi && w.defi.answered > 0) : undefined;

  return (
    <main className="suivi">
      <header className="topbar">
        <button className="btn ghost small" onClick={() => go("/")}>← Bibliothèque</button>
        <h1 className="page-title">{self ? "📊 Mes progrès" : "📊 Suivi"}</h1>
        <ThemeButton theme={theme} />
      </header>
      {error && <p className="error">{error}</p>}
      {kids && kids.length === 0 && <p className="muted">Aucun compte enfant pour l’instant.</p>}
      {kids && kids.length > 1 && (
        <div className="conj-tabs">
          {kids.map((k) => (
            <button key={k.id} className={`chip${k.id === kid ? " on" : ""}`} onClick={() => setKid(k.id)}>{k.display_name}</button>
          ))}
        </div>
      )}
      {!rep && (self || kid !== null) && !error && <p className="muted">…</p>}
      {rep && thisWeek && (
        <>
          {!self && <h2 className="suivi-name">{rep.child.display_name}</h2>}
          <div className="tiles">
            <Tile value={thisWeek.minutes} label="minutes de lecture cette semaine" />
            <Tile value={thisWeek.active_days} label="jours actifs cette semaine" note="lecture ≥ 1 min, mot cherché ou défi" />
            <Tile value={lastDefi?.defi ? `${lastDefi.defi.correct}/${lastDefi.defi.questions}` : "—"}
                  label={lastDefi ? `défi du ${short(lastDefi.week)}` : "pas encore de défi"} note="justes du premier coup" />
            <Tile value={rep.bag.new + rep.bag.learning + rep.bag.mastered} label={self ? "mots dans ton sac" : "mots dans son sac"}
                  note={`${rep.bag.mastered} en or · ${rep.bag.due_soon} à revoir cette semaine`} />
          </div>

          <div className="charts">
            <BarChart title="Minutes de lecture par semaine" color="c1" unit="min"
                      bars={rep.weeks.map((w) => ({ label: short(w.week), value: w.minutes,
                        tip: `${w.minutes} min · ${w.active_days} jour(s) actif(s)` }))} />
            <BarChart title="Mots cherchés par semaine" color="c1" unit="mots"
                      bars={rep.weeks.map((w) => ({ label: short(w.week), value: w.taps,
                        tip: `${w.taps} touchés · ${w.words} mots différents · ${w.unknown} « je ne connais pas »` }))} />
            <BarChart title="Défi : % juste du premier coup" color="c2" unit="%" max={100}
                      bars={rep.weeks.map((w) => ({ label: short(w.week),
                        value: w.defi && w.defi.answered ? Math.round((100 * w.defi.correct) / w.defi.questions) : null,
                        tip: w.defi ? `${w.defi.correct} / ${w.defi.questions} justes${w.defi.status === "done" ? "" : " (en cours)"}`
                          : "pas de défi" }))} />
          </div>
          <p className="small muted">Les minutes par jour sont enregistrées depuis cette mise à jour ; le temps lu avant
            ne compte que dans le total par livre.</p>

          <h2 className="bag-title">{self ? "Mots à retravailler 💪" : "Mots difficiles"}</h2>
          <p className="muted small">{self
            ? "Ces mots te donnent un peu de mal : relis la phrase, écoute-les, ils reviendront au prochain défi."
            : "Classés par erreurs au défi, puis oublis, puis nombre de fois cherchés."}</p>
          {rep.hard_words.length === 0 && <p className="muted">{self ? "Aucun pour l’instant, bravo !" : "Rien à signaler pour l’instant."}</p>}
          <div className="hard-list">
            {rep.hard_words.map((h) => (
              <div key={h.lemma} className="card hard">
                <div className="hard-head">
                  <span className="wcard-word">{h.lemma}</span>
                  {h.gloss && <span className="muted small">{h.gloss}</span>}
                </div>
                <div className="hard-badges">
                  {h.errors > 0 && <span className="pill bad">{h.errors} erreur{h.errors > 1 ? "s" : ""} au défi</span>}
                  {h.lapses > 0 && <span className="pill">oublié {h.lapses} fois</span>}
                  <span className="pill">cherché {h.lookups} fois</span>
                  <span className="pill">niveau {h.familiarity}/5</span>
                </div>
                {h.definition && <p className="hard-def">{h.definition}</p>}
                {h.sentence && <p className="wcard-sent">« <Highlight sentence={h.sentence} surface={h.surface} /> »</p>}
              </div>
            ))}
          </div>

          <h2 className="bag-title">Lectures</h2>
          {rep.books.length === 0 && <p className="muted">Pas encore de lecture.</p>}
          {rep.books.map((b) => (
            <div key={b.title} className="card book-row">
              <div>
                <b>{b.title}</b>
                <div className="small muted">
                  {b.finished ? "terminé 🎉" : `chapitre ${b.last_chapter}`} · {b.minutes} min · {b.lookups} mots cherchés · depuis le {short(b.started)}
                </div>
              </div>
              <div className="progress small-bar" aria-label={`${b.chapters_done} chapitres sur ${b.chapters}`}>
                <div className="bar" style={{ width: `${(100 * b.chapters_done) / Math.max(1, b.chapters)}%` }} />
              </div>
              <span className="small">{b.chapters_done}/{b.chapters}</span>
            </div>
          ))}
        </>
      )}
    </main>
  );
}
