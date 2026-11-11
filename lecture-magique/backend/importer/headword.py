"""Robert headword normalization and POS mapping.

"tubéreux, euse"  -> lemma "tubéreux", extra form "tubéreuse"
"cheval, aux"     -> lemma "cheval",   extra form "chevaux"
"bas, basse"      -> lemma "bas",      extra form "basse"
"beau ou bel, belle" -> lemma "beau", extra forms "bel", "belle"
"2. livre"        -> handled by robert_extract.parse (homograph=2)
"""
import re
import unicodedata
from dataclasses import dataclass, field


def strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def apply_suffix(base: str, suffix: str) -> str:
    """Build the full form from a Robert ending: ('actif', 'ive') -> 'active'."""
    if len(suffix) >= 3 and strip_accents(suffix[:2]).lower() == strip_accents(base[:2]).lower():
        return suffix  # already a full word: "bas, basse", "sec, sèche", "blanc, blanche"
    for fold in (lambda s: s, strip_accents):
        b, x = fold(base), fold(suffix)
        for k in range(min(len(x), len(b)), 0, -1):
            i = b.rfind(x[:k])
            if i > 0:
                return base[:i] + suffix
    return base + suffix


@dataclass
class Headword:
    lemma: str
    forms: list[tuple[str, str]] = field(default_factory=list)  # (form, tag)


def normalize_headword(word: str) -> Headword:
    word = re.sub(r"\s+", " ", word).strip()
    word = re.sub(r"^\d+\.\s*", "", word)  # homograph number is parsed separately
    parts = [p.strip() for p in word.split(",") if p.strip()]
    if not parts:
        return Headword(word)
    alts = [a.strip() for a in re.split(r"\s+ou\s+", parts[0]) if a.strip()]
    hw = Headword(alts[0])
    for a in alts[1:]:
        hw.forms.append((a, "variant"))
    for suffix in parts[1:]:
        for s in re.split(r"\s+ou\s+", suffix):
            s = s.strip()
            if s and re.fullmatch(r"[\w'’ -]+", s):
                hw.forms.append((apply_suffix(hw.lemma, s), "inflection"))
    return hw


# Robert part-of-speech labels -> spaCy UPOS. Checked in order; first hit wins.
_POS_RULES: list[tuple[str, str]] = [
    (r"^(verbe|v\.)", "VERB"),
    (r"^(adj(ectif)?\.?\s*(numéral|num\.)|numéral)", "NUM"),
    (r"^(adj|a\.)", "ADJ"),
    (r"^adv", "ADV"),
    (r"^(prép|prep)", "ADP"),
    (r"^conj(onction)?\.?\s*(de\s+)?(sub|subordination)", "SCONJ"),
    (r"^conj", "CCONJ"),
    (r"^pron", "PRON"),
    (r"^interj", "INTJ"),
    (r"^(art|déterminant|dét)", "DET"),
    (r"^(nom|n\.|subst)", "NOUN"),
    (r"^(élément|préf|suff)", "X"),
]


def map_pos(robert_pos: str | None) -> tuple[str, str | None]:
    """Return (UPOS, gender) for a Robert POS label such as 'nom féminin' or 'n. m.'."""
    if not robert_pos:
        return "X", None
    p = robert_pos.strip().lower()
    upos = next((u for pat, u in _POS_RULES if re.search(pat, p)), "X")
    gender = None
    if upos == "NOUN":
        masc = re.search(r"masculin|\bm\.", p)
        fem = re.search(r"féminin|\bf\.", p)
        if masc and not fem:
            gender = "m"
        elif fem and not masc:
            gender = "f"
    return upos, gender
