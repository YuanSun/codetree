"""Extract Le Petit Robert (Lingoes .ld2) into JSONL: one line per headword, with numbered senses."""
import sys, re, html, json
from ld2 import entries

TAG = re.compile(r'<[^>]+>')
def text(s):
    return re.sub(r'\s+', ' ', html.unescape(TAG.sub(' ', s))).strip()

SENSE_SPLIT = re.compile(r'<a id="E\d+"></a>')
LABEL = re.compile(r'background-color: rgb\(69,86,130\)[^>]*><span>&nbsp;([^&<]+)&nbsp;</span>')
DEF = re.compile(r'<SPAN style="color: rgb\(51,51,153\)[^"]*">(.*?)</SPAN>', re.S)
EX = re.compile(r'<SPAN style="font-family: Times New Roman, serif; font-style: italic[^"]*">(.*?)</SPAN>', re.S)
IPA = re.compile(r'\[\$PhoneticFont\][^>]*>\[([^\]]+)\]')
POS = re.compile(r'color: rgb\(0,30,0\);">([^<]+)</SPAN>')

def parse(word, xml):
    head, *chunks = SENSE_SPLIT.split(xml)
    hom = re.match(r'(\d+)\.\s*(.+)', word)
    out = {
        'headword': hom.group(2) if hom else word,
        'homograph': int(hom.group(1)) if hom else None,
        'ipa': html.unescape(m.group(1)) if (m := IPA.search(head)) else None,
        'pos': m.group(1).strip() if (m := POS.search(head)) else None,
        'senses': [],
    }
    roman = None
    for c in chunks:
        lab = LABEL.search(c)
        label = lab.group(1).strip() if lab else None
        defs = [text(d) for d in DEF.findall(c)]
        exs = [text(e) for e in EX.findall(c)]
        if label and re.fullmatch(r'[IVX]+', label):
            roman = label
            if not defs:
                continue
        if not defs and not exs:
            continue
        key = f'{roman}.{label}' if roman and label and not re.fullmatch(r'[IVX]+', label) else (label or '')
        out['senses'].append({'key': key, 'definition': ' '.join(defs), 'examples': exs[:6]})
    if not out['senses']:
        defs = [text(d) for d in DEF.findall(xml)]
        exs = [text(e) for e in EX.findall(xml)]
        if defs:
            out['senses'].append({'key': '', 'definition': ' '.join(defs), 'examples': exs[:6]})
    out['kind'] = 'author' if re.match(r"^[A-Z][a-z]?\.( [A-Z]\.)* ", word) else 'word'
    return out

if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    n = 0
    with open(dst, 'w', encoding='utf-8') as f:
        for w, x in entries(src):
            f.write(json.dumps(parse(w, x), ensure_ascii=False) + '\n'); n += 1
    print('entries', n)
