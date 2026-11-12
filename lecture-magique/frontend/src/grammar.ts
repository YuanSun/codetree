// spaCy morphology ("Mood=Ind|Number=Sing|Person=3|Tense=Pres|VerbForm=Fin") -> French labels.

export function parseMorph(m: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const kv of (m ?? "").split("|")) {
    const [k, v] = kv.split("=");
    if (k && v) out[k] = v;
  }
  return out;
}

const PRONOUN: Record<string, string> = {
  "1Sing": "je", "2Sing": "tu", "3Sing": "il/elle", "1Plur": "nous", "2Plur": "vous", "3Plur": "ils/elles",
};
export const PERSON_LABEL: Record<string, string> = {
  "1s": "je", "2s": "tu", "3s": "il/elle", "1p": "nous", "2p": "vous", "3p": "ils/elles",
};

/** Key of the conjugation table row (same codes as importer/wiktionary.py), e.g. "ind.pres". */
export function tenseKey(f: Record<string, string>): string | null {
  if (f.VerbForm !== "Fin") return null;
  if (f.Mood === "Imp") return "imp.pres";
  if (f.Mood === "Cnd") return "cond.pres";
  if (f.Mood === "Sub") return f.Tense === "Imp" ? "subj.impf" : "subj.pres";
  return { Pres: "ind.pres", Imp: "ind.impf", Past: "ind.ps", Fut: "ind.fut" }[f.Tense ?? ""] ?? null;
}

export function personKey(f: Record<string, string>): string | null {
  const n = f.Number === "Plur" ? "p" : f.Number === "Sing" ? "s" : "";
  return f.Person && n ? `${f.Person}${n}` : null;
}

const TENSE_FR: Record<string, string> = {
  "ind.pres": "présent", "ind.impf": "imparfait", "ind.ps": "passé simple", "ind.fut": "futur",
  "cond.pres": "conditionnel présent", "subj.pres": "subjonctif présent", "subj.impf": "subjonctif imparfait",
  "imp.pres": "impératif",
};

/** "présent · il/elle", "participe passé", "infinitif" — or null if there is nothing to say. */
export function tenseLabel(morph: string | null): string | null {
  const f = parseMorph(morph);
  if (f.VerbForm === "Inf") return "infinitif";
  if (f.VerbForm === "Part") return f.Tense === "Pres" ? "participe présent" : "participe passé";
  const key = tenseKey(f);
  if (!key) return null;
  const who = f.Mood === "Imp" ? null : PRONOUN[`${f.Person ?? ""}${f.Number ?? ""}`];
  return who ? `${TENSE_FR[key]} · ${who}` : TENSE_FR[key];
}
