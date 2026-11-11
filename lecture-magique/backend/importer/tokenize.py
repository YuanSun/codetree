"""French tokenizer that keeps exact character offsets.

Joining text[start:end] of every token plus the untouched gaps between them gives back
the original paragraph character for character (the reader rebuilds it that way).

- Elision is split off:   l'école -> l' + école ; qu'il -> qu' + il ; both ' and ’.
- Words that only look elided stay whole: aujourd'hui, quelqu'un, presqu'île ...
- Hyphenated words stay whole (peut-être, porte-coton); inverted pronouns are split off
  (dit-il -> dit + -il, hurle-t-il -> hurle + -t-il, est-ce -> est + -ce).
- Numbers and punctuation are tokens with is_word=False.
"""
import re
from dataclasses import dataclass

APOS = "'’"
_WORD = r"[^\W\d_]+(?:[-'’][^\W\d_]+)*[’']?"
TOKEN_RE = re.compile(rf"(?P<word>{_WORD})|(?P<num>\d+(?:[.,]\d+)*)|(?P<punct>\S)")

ELISION = {"l", "d", "j", "m", "t", "s", "n", "c", "ç", "qu", "jusqu", "lorsqu", "puisqu", "quoiqu"}
WHOLE = {"aujourd'hui", "quelqu'un", "quelqu'une", "presqu'île", "presqu'îles", "prud'homme",
         "prud'hommes", "entr'acte", "main-d'œuvre", "c'est-à-dire", "d'abord"}
WHOLE_ELISION_OK = {"d'abord"}  # still split: d' + abord
CLITICS = {"je", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles", "ce", "moi", "toi", "le", "la",
           "les", "lui", "leur", "en", "y", "t-il", "t-elle", "t-on", "t-ils", "t-elles"}


@dataclass
class Tok:
    surface: str
    start: int
    end: int
    is_word: bool


def _norm(s: str) -> str:
    return s.lower().replace("’", "'")


def _split_word(w: str, start: int) -> list[Tok]:
    out: list[Tok] = []
    # elision prefixes, possibly chained: "qu'aujourd'hui", "s'il"
    while True:
        n = _norm(w)
        if n in WHOLE and n not in WHOLE_ELISION_OK:
            break
        m = re.match(r"([^\W\d_]+)['’](?=[^\W\d_])", w)
        if not m or _norm(m.group(1)) not in ELISION:
            break
        cut = m.end()
        out.append(Tok(w[:cut], start, start + cut, True))
        w, start = w[cut:], start + cut
    # trailing inverted pronouns: dit-il, hurle-t-il, est-ce, donne-le-moi
    tail: list[Tok] = []
    while "-" in w and _norm(w) not in WHOLE:
        parts = w.split("-")
        two = "-".join(parts[-2:]).lower() if len(parts) >= 3 else None
        if two in CLITICS and len(parts) >= 3:  # -t-il
            cut = len(w) - len(two) - 1
        elif parts[-1].lower() in CLITICS:
            cut = len(w) - len(parts[-1]) - 1
        else:
            break
        if cut <= 0:
            break
        tail.insert(0, Tok(w[cut:], start + cut, start + len(w), True))
        w = w[:cut]
    if w:
        out.append(Tok(w, start, start + len(w), True))
    return out + tail


def tokenize(text: str) -> list[Tok]:
    toks: list[Tok] = []
    for m in TOKEN_RE.finditer(text):
        if m.group("word"):
            w, s = m.group(), m.start()
            if w[-1] in APOS and _norm(w[:-1]) not in ELISION:  # closing quote, not elision
                toks.extend(_split_word(w[:-1], s))
                toks.append(Tok(w[-1], m.end() - 1, m.end(), False))
            else:
                toks.extend(_split_word(w, s))
        else:
            toks.append(Tok(m.group(), m.start(), m.end(), False))
    return toks


def split_hyphenated(t: Tok) -> list[Tok]:
    """Fallback when a hyphenated word is not in the dictionary: words and '-' separately."""
    out = []
    for m in re.finditer(r"[^-]+|-", t.surface):
        out.append(Tok(m.group(), t.start + m.start(), t.start + m.end(), m.group() != "-"))
    return out
