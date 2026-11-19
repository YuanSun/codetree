import { CSSProperties, forwardRef, useEffect, useState } from "react";
import { Lemma, Sense, WordState } from "../api";
import { formsEn, parseMorph, tenseKey, tenseLabel, tenseLabelEn } from "../grammar";
import { Lang, strings } from "../i18n";
import { canSpeak, speak } from "../speech";
import ConjugationTable from "./ConjugationTable";

const POS_FR: Record<string, string> = {
  VERB: "v.", AUX: "v.", NOUN: "n.", PROPN: "n. pr.", ADJ: "adj.", ADV: "adv.", ADP: "prép.", PRON: "pron.",
  DET: "dét.", CCONJ: "conj.", SCONJ: "conj.", INTJ: "interj.", NUM: "num.", X: "",
};

export type Rating = "unknown" | "vague" | "known";

export type CardInfo = {
  tokenId: number;
  surface: string;
  lemmaId: number | null;
  lemma: Lemma | null;
  senseId: number | null;
  morph: string | null;
  word: WordState | null;
};

const POS_EN: Record<string, string> = {
  VERB: "verb", AUX: "verb", NOUN: "noun", PROPN: "name", ADJ: "adjective", ADV: "adverb", ADP: "preposition",
  PRON: "pronoun", DET: "determiner", CCONJ: "conjunction", SCONJ: "conjunction", INTJ: "interjection", NUM: "number",
  PART: "", X: "",
};

function posLabel(l: Lemma, lang: Lang) {
  if (lang === "en") return POS_EN[l.pos] ?? "";
  const p = POS_FR[l.pos] ?? "";
  if (l.pos === "NOUN" && l.gender) return `n. ${l.gender}.`;
  return p;
}

type Props = {
  info: CardInfo;
  senses: Record<string, Sense>;
  style: CSSProperties;
  sheet: boolean;
  onRate: (r: Rating) => void;
  lang?: Lang;
};

const WordCard = forwardRef<HTMLDivElement, Props>(function WordCard({ info, senses, style, sheet, onRate, lang = "fr" }, ref) {
  const [showOthers, setShowOthers] = useState(false);
  const [showConj, setShowConj] = useState(false);
  const [showEn, setShowEn] = useState(false);
  const { lemma } = info;
  const chosen = info.senseId ? senses[info.senseId] : lemma?.senses.length ? senses[lemma.senses[0]] : undefined;
  const others = lemma ? lemma.senses.filter((id) => id !== info.senseId && senses[id]) : [];
  const isVerb = lemma?.pos === "VERB" || lemma?.pos === "AUX";
  const en = lang === "en";
  const t = strings(lang);
  const tense = isVerb ? (en ? tenseLabelEn(info.morph) : tenseLabel(info.morph)) : null;
  // English gloss of a French word (Wiktionary): in place of the definition when Petit Robert has nothing,
  // otherwise behind an "In English" button, so she reads the French first.
  const english = en || chosen?.def ? null : chosen?.en ?? lemma?.en[0] ?? null;
  const englishHelp = !en && chosen?.def && lemma?.en.length ? lemma.en[0] : null;
  useEffect(() => setShowEn(false), [info.surface, info.lemmaId]);
  const forms = en && lemma ? formsEn(lemma.pos, lemma.lemma, lemma.forms) : [];

  return (
    <div ref={ref} className={`word-card${sheet ? " sheet" : ""}`} style={style} role="dialog" aria-label={info.surface}>
      <div className="wc-head">
        <div>
          <div className="wc-word">{info.surface}</div>
          {lemma && (
            <div className="wc-lemma">
              {lemma.lemma.toLowerCase() !== info.surface.toLowerCase() && <>→ <b>{lemma.lemma}</b> </>}
              <span className="wc-pos">{posLabel(lemma, lang)}</span>
              {lemma.ipa && <span className="wc-ipa"> {en ? `/${lemma.ipa}/` : `[${lemma.ipa}]`}</span>}
            </div>
          )}
          {tense && <div className="wc-tense">{tense}</div>}
          {forms.length > 0 && (
            <div className="wc-forms">
              {forms.map(([label, f], i) => <span key={label}>{i > 0 && " · "}{label} <b>{f}</b></span>)}
            </div>
          )}
        </div>
        {canSpeak() && (
          <button className="btn icon speak" aria-label={t.listen} title={t.listen}
                  onClick={() => speak(info.surface, 0.85, lang)}>🔊</button>
        )}
      </div>

      {chosen?.def ? (
        <div className="wc-sense">
          {chosen.key && <span className="sense-key">{chosen.key}</span>}
          <span className="wc-def">{chosen.def}</span>
          {chosen.ex.length > 0 && (
            <ul className="wc-ex">{chosen.ex.slice(0, 3).map((e, i) => <li key={i}>{e}</li>)}</ul>
          )}
          {englishHelp && (showEn ? (
            <p className="wc-en"><span className="en-tag">EN</span> {englishHelp}</p>
          ) : (
            <button className="btn ghost small en-btn" onClick={() => setShowEn(true)}>🇬🇧 In English</button>
          ))}
        </div>
      ) : english ? (
        <p className="wc-en"><span className="en-tag">EN</span> {english}</p>
      ) : (
        <p className="muted small">{t.notInDict}</p>
      )}

      {isVerb && info.lemmaId && !en && (
        <div className="wc-conj">
          <button className="link" onClick={() => setShowConj(!showConj)}>
            {showConj ? "Masquer la conjugaison" : "Conjugaison"}
          </button>
          {showConj && (
            <ConjugationTable lemmaId={info.lemmaId} surface={info.surface}
                              initialTense={tenseKey(parseMorph(info.morph))} />
          )}
        </div>
      )}

      {others.length > 0 && (
        <div className="wc-others">
          <button className="link" onClick={() => setShowOthers(!showOthers)}>
            {showOthers ? t.hide : t.otherSenses(others.length)}
          </button>
          {showOthers && (
            <ol className="wc-other-list">
              {others.map((id) => (
                <li key={id}>
                  {senses[id].key && <span className="sense-key small">{senses[id].key}</span>} {senses[id].def}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {info.word && info.word.lookups > 0 && (
        <p className="wc-seen">{t.seen(info.word.lookups)}</p>
      )}
      {en && chosen?.def && <p className="wc-credit">Wiktionary (CC BY-SA)</p>}

      <div className="wc-rate">
        <button className="btn rate r-unknown" onClick={() => onRate("unknown")}>{t.rateUnknown}</button>
        <button className="btn rate r-vague" onClick={() => onRate("vague")}>{t.rateVague}</button>
        <button className="btn rate r-known" onClick={() => onRate("known")}>{t.rateKnown}</button>
      </div>
    </div>
  );
});

export default WordCard;
