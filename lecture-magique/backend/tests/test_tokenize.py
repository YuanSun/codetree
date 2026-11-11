from importer.tokenize import split_hyphenated, tokenize


def words(text):
    return [t.surface for t in tokenize(text) if t.is_word]


def test_offsets_rebuild_original_text():
    text = "« Tu veux des makrouts ? » me souffle Yacer — l’école, 3,5 km… aujourd'hui !"
    toks = tokenize(text)
    rebuilt, pos = "", 0
    for t in toks:
        assert text[t.start:t.end] == t.surface
        rebuilt += text[pos:t.start] + t.surface
        pos = t.end
    assert rebuilt + text[pos:] == text


def test_elision_both_apostrophes():
    assert words("l'école qu'il j’ai d'un n'est s’il jusqu'à c'est lorsqu'on") == [
        "l'", "école", "qu'", "il", "j’", "ai", "d'", "un", "n'", "est", "s’", "il",
        "jusqu'", "à", "c'", "est", "lorsqu'", "on"]


def test_words_that_keep_their_apostrophe():
    assert words("aujourd'hui quelqu'un presqu’île d'aujourd'hui") == [
        "aujourd'hui", "quelqu'un", "presqu’île", "d'", "aujourd'hui"]


def test_hyphens_and_inverted_pronouns():
    assert words("peut-être porte-coton dit-il hurle-t-il est-ce Zoé-la-tête-à-claque") == [
        "peut-être", "porte-coton", "dit", "-il", "hurle", "-t-il", "est", "-ce", "Zoé-la-tête-à-claque"]


def test_numbers_and_punctuation_are_not_words():
    toks = tokenize("En 1872, il partit !")
    assert [(t.surface, t.is_word) for t in toks] == [
        ("En", True), ("1872", False), (",", False), ("il", True), ("partit", True), ("!", False)]


def test_closing_quote_is_not_elision():
    assert [(t.surface, t.is_word) for t in tokenize("les 'mots'")] == [
        ("les", True), ("'", False), ("mots", True), ("'", False)]


def test_split_hyphenated():
    [t] = tokenize("tête-à-claque")
    parts = split_hyphenated(t)
    assert [(p.surface, p.start, p.is_word) for p in parts] == [
        ("tête", 0, True), ("-", 4, False), ("à", 5, True), ("-", 6, False), ("claque", 7, True)]
