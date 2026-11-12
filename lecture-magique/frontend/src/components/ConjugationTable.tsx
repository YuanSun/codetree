import { useEffect, useState } from "react";
import { api, Conjugation } from "../api";
import { PERSON_LABEL } from "../grammar";

const cache = new Map<number, Conjugation>();
const PERSONS = ["1s", "2s", "3s", "1p", "2p", "3p"];
const SHORT: Record<string, string> = {
  "ind.pres": "Présent", "ind.impf": "Imparfait", "ind.ps": "Passé simple", "ind.fut": "Futur",
  "cond.pres": "Conditionnel", "subj.pres": "Subjonctif", "subj.impf": "Subj. imparfait", "imp.pres": "Impératif",
};

/** Verb table, one tense at a time; opens on the tense of the word she tapped and highlights her form. */
export default function ConjugationTable({ lemmaId, surface, initialTense }: {
  lemmaId: number; surface: string; initialTense: string | null;
}) {
  const [data, setData] = useState<Conjugation | null>(cache.get(lemmaId) ?? null);
  const [error, setError] = useState(false);
  const [tense, setTense] = useState<string | null>(initialTense);

  useEffect(() => {
    if (data) return;
    api.conjugation(lemmaId).then((c) => { cache.set(lemmaId, c); setData(c); }, () => setError(true));
  }, [lemmaId, data]);

  if (error) return <p className="muted small">Pas de tableau de conjugaison pour ce verbe.</p>;
  if (!data) return <p className="muted small">…</p>;
  if (!data.tenses.length) return <p className="muted small">Pas de tableau de conjugaison pour ce verbe.</p>;

  const current = data.tenses.find((t) => t.key === tense) ?? data.tenses[0];
  const me = surface.toLowerCase();
  return (
    <div className="conj">
      <div className="conj-tabs" role="tablist">
        {data.tenses.map((t) => (
          <button key={t.key} role="tab" aria-selected={t.key === current.key}
                  className={`chip${t.key === current.key ? " on" : ""}`} onClick={() => setTense(t.key)}>
            {SHORT[t.key] ?? t.label}
          </button>
        ))}
      </div>
      <table className="conj-table">
        <tbody>
          {PERSONS.map((p) => {
            const forms = current.forms[p] ?? [];
            if (current.key === "imp.pres" && !forms.length) return null;
            return (
              <tr key={p}>
                <th>{current.key === "imp.pres" ? "" : PERSON_LABEL[p]}</th>
                <td>
                  {forms.length ? forms.map((f, i) => (
                    <span key={f}>{i > 0 && " / "}<span className={f === me ? "me" : undefined}>{f}</span></span>
                  )) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="conj-foot">
        {data.participle_past.length > 0 && <>participe passé : <b>{data.participle_past.join(" / ")}</b> · </>}
        {data.participle_present.length > 0 && <>présent : <b>{data.participle_present.join(" / ")}</b></>}
        <br /><span className="muted">Conjugaison : {data.source}</span>
      </p>
    </div>
  );
}
