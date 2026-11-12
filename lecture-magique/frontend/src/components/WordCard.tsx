import { CSSProperties, forwardRef, useState } from "react";
import { Lemma, Sense, WordState } from "../api";
import { parseMorph, tenseKey, tenseLabel } from "../grammar";
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

function posLabel(l: Lemma) {
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
};

const WordCard = forwardRef<HTMLDivElement, Props>(function WordCard({ info, senses, style, sheet, onRate }, ref) {
  const [showOthers, setShowOthers] = useState(false);
  const [showConj, setShowConj] = useState(false);
  const { lemma } = info;
  const chosen = info.senseId ? senses[info.senseId] : lemma?.senses.length ? senses[lemma.senses[0]] : undefined;
  const others = lemma ? lemma.senses.filter((id) => id !== info.senseId && senses[id]) : [];
  const isVerb = lemma?.pos === "VERB" || lemma?.pos === "AUX";
  const tense = isVerb ? tenseLabel(info.morph) : null;
  // English (Wiktionary) only when Petit Robert has nothing for this word.
  const english = chosen?.def ? null : chosen?.en ?? lemma?.en[0] ?? null;

  return (
    <div ref={ref} className={`word-card${sheet ? " sheet" : ""}`} style={style} role="dialog" aria-label={info.surface}>
      <div className="wc-head">
        <div>
          <div className="wc-word">{info.surface}</div>
          {lemma && (
            <div className="wc-lemma">
              {lemma.lemma.toLowerCase() !== info.surface.toLowerCase() && <>→ <b>{lemma.lemma}</b> </>}
              <span className="wc-pos">{posLabel(lemma)}</span>
              {lemma.ipa && <span className="wc-ipa"> [{lemma.ipa}]</span>}
            </div>
          )}
          {tense && <div className="wc-tense">{tense}</div>}
        </div>
        {canSpeak() && (
          <button className="btn icon speak" aria-label="Écouter (espace)" title="Écouter (espace)"
                  onClick={() => speak(info.surface)}>🔊</button>
        )}
      </div>

      {chosen?.def ? (
        <div className="wc-sense">
          {chosen.key && <span className="sense-key">{chosen.key}</span>}
          <span className="wc-def">{chosen.def}</span>
          {chosen.ex.length > 0 && (
            <ul className="wc-ex">{chosen.ex.slice(0, 3).map((e, i) => <li key={i}>{e}</li>)}</ul>
          )}
        </div>
      ) : english ? (
        <p className="wc-en"><span className="en-tag">EN</span> {english}</p>
      ) : (
        <p className="muted small">Ce mot n’est pas encore dans le dictionnaire. On le note quand même !</p>
      )}

      {isVerb && info.lemmaId && (
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
            {showOthers ? "Masquer" : `Autres sens (${others.length})`}
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
        <p className="wc-seen">Déjà cherché {info.word.lookups} fois — il est dans ton sac à mots 👜</p>
      )}

      <div className="wc-rate">
        <button className="btn rate r-unknown" onClick={() => onRate("unknown")}>Je ne connais pas</button>
        <button className="btn rate r-vague" onClick={() => onRate("vague")}>Ça me dit quelque chose</button>
        <button className="btn rate r-known" onClick={() => onRate("known")}>En fait, je connais</button>
      </div>
    </div>
  );
});

export default WordCard;
