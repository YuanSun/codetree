import { useState } from "react";
import { api, Grade } from "../api";

// Copy without the Clipboard API: it is only available on HTTPS, and the app is served over plain http at home.
function copyText(s: string): boolean {
  const ta = document.createElement("textarea");
  ta.value = s;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, s.length);
  let ok = false;
  try { ok = document.execCommand("copy"); } catch { ok = false; }
  document.body.removeChild(ta);
  return ok;
}

/** Claude's reply, pasted as is: tolerates text or ``` fences around the JSON, {"grades": [...]} or a bare list. */
export function parseGrades(raw: string): Grade[] {
  const s = raw.replace(/```(?:json)?/g, "");
  const start = s.search(/[[{]/);
  const end = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
  if (start < 0 || end < start) throw new Error("Pas de JSON trouvé dans le texte collé.");
  const data = JSON.parse(s.slice(start, end + 1));
  const list = Array.isArray(data) ? data : data.grades;
  if (!Array.isArray(list) || list.length === 0) throw new Error("Le JSON ne contient pas de liste « grades ».");
  return list.map((g: Record<string, unknown>, i: number) => {
    if (typeof g.answer_id !== "number" || typeof g.score !== "number")
      throw new Error(`Élément ${i + 1} : il faut answer_id et score (des nombres).`);
    return { answer_id: g.answer_id, score: g.score, feedback: typeof g.feedback === "string" ? g.feedback : "" };
  });
}

/** Parents: send the child's unmarked answers to Claude (download or copy), then paste Claude's JSON reply back. */
export default function GradingPanel({ kid, name, onImported }: { kid: number; name: string; onImported: () => void }) {
  const [regrade, setRegrade] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const fetchExport = async () => {
    setError("");
    setNote("");
    const exp = await api.gradingExport(kid, regrade);
    if (exp.answers.length === 0) {
      setNote(regrade ? "Aucune réponse." : "Toutes les réponses sont déjà corrigées. 🎉");
      return null;
    }
    return { exp, json: JSON.stringify(exp, null, 2) };
  };

  const download = async () => {
    try {
      const r = await fetchExport();
      if (!r) return;
      const url = URL.createObjectURL(new Blob([r.json], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `reponses-${name.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNote(`${r.exp.answers.length} réponse(s) exportée(s). Donne le fichier à Claude, puis colle sa réponse ci-dessous.`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const copy = async () => {
    try {
      const r = await fetchExport();
      if (!r) return;
      setNote(copyText(r.json)
        ? `${r.exp.answers.length} réponse(s) copiée(s). Colle-les dans Claude, puis colle sa réponse ci-dessous.`
        : "La copie n’a pas marché : utilise « Télécharger ».");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const save = async () => {
    setError("");
    setNote("");
    let grades: Grade[];
    try {
      grades = parseGrades(reply);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    setBusy(true);
    try {
      const r = await api.importGrades(grades);
      setNote(`✓ ${r.graded} réponse(s) notée(s). ${name} voit maintenant la note et le commentaire.`);
      setReply("");
      onImported();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card grading">
      <b>📝 Correction par Claude</b>
      <ol className="small grading-steps">
        <li>Exporte les réponses pas encore corrigées (avec la consigne de correction).</li>
        <li>Donne le fichier (ou colle le texte) à Claude, dans une conversation.</li>
        <li>Colle sa réponse JSON ici et enregistre : {name} verra la note et le commentaire sous chaque question.</li>
      </ol>
      <div className="grading-row">
        <button className="btn primary small" onClick={download}>⬇️ Télécharger</button>
        <button className="btn ghost small" onClick={copy}>📋 Copier</button>
        <label className="small"><input type="checkbox" checked={regrade} onChange={(e) => setRegrade(e.target.checked)} />
          {" "}tout recorriger</label>
      </div>
      <textarea className="cq-answer" rows={4} value={reply} placeholder="Colle ici la réponse de Claude (JSON)…"
                spellCheck={false} onChange={(e) => setReply(e.target.value)} />
      <div className="grading-row">
        <button className="btn primary small" disabled={busy || !reply.trim()} onClick={save}>Enregistrer les notes</button>
      </div>
      {note && <p className="small cq-saved">{note}</p>}
      {error && <p className="error small">{error}</p>}
    </div>
  );
}
