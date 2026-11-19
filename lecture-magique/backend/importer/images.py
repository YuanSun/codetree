"""Pictures of an article pack: read the files a pack names and store them in lecture.illustration.

In a pack, each chapter may list its pictures:
    "images": [{"after": 0, "file": "images/book/ch1.jpg", "caption": "..."}]
`after` is the paragraph the picture follows (0 = top of the chapter); `file` is relative to the pack file.
JPEG and PNG only, at most MAX_BYTES each (crop and shrink them first: about 1200 px wide is plenty).
"""
import struct
from pathlib import Path

from sqlalchemy import Connection, text

MAX_BYTES = 1_500_000


class ImageRefused(ValueError):
    pass


def image_info(data: bytes) -> tuple[str, int, int]:
    """(mime, width, height) from the file header, without an imaging library."""
    if data[:8] == b"\x89PNG\r\n\x1a\n" and data[12:16] == b"IHDR":
        w, h = struct.unpack(">II", data[16:24])
        return "image/png", w, h
    if data[:2] == b"\xff\xd8":
        i = 2
        while i + 9 < len(data):
            if data[i] != 0xFF:
                i += 1
                continue
            marker = data[i + 1]
            if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7 or marker == 0xFF:
                i += 1 if marker == 0xFF else 2
                continue
            seg = struct.unpack(">H", data[i + 2:i + 4])[0]
            if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                h, w = struct.unpack(">HH", data[i + 5:i + 9])
                return "image/jpeg", w, h
            i += 2 + seg
    raise ImageRefused("not a JPEG or PNG picture")


def load(base: Path | None, spec: dict) -> tuple[str, int, int, bytes]:
    if base is None:
        raise ImageRefused("this pack has pictures: import it from its file so their paths can be resolved")
    path = (base / spec["file"]).resolve()
    if not path.is_file():
        raise ImageRefused(f"picture not found: {path}")
    data = path.read_bytes()
    if len(data) > MAX_BYTES:
        raise ImageRefused(f"{path.name}: {len(data) // 1000} kB, the limit is {MAX_BYTES // 1000} kB — shrink it first")
    try:
        mime, w, h = image_info(data)
    except ImageRefused as e:
        raise ImageRefused(f"{path.name}: {e}") from None
    return mime, w, h, data


def store(conn: Connection, article_id: int, pack: dict, base: Path | None) -> int:
    """Replace the article's pictures with the pack's. Text and tokens are untouched, so this also works
    on a published article that already has lookups. Returns the number of pictures stored."""
    chapters = dict(conn.execute(text("SELECT seq, id FROM lecture.chapter WHERE article_id = :a"),
                                 {"a": article_id}).all())
    loaded = []  # read every file first: a missing one changes nothing
    for ch in pack["chapters"]:
        n_paras = len(ch["paragraphs"])
        seen = set()
        for spec in ch.get("images", []):
            after = int(spec.get("after", 0))
            if not 0 <= after <= n_paras:
                raise ImageRefused(f"chapter {ch['seq']}: picture after paragraph {after}, "
                                   f"but the chapter has {n_paras} paragraphs")
            if after in seen:
                raise ImageRefused(f"chapter {ch['seq']}: two pictures after paragraph {after}")
            seen.add(after)
            if ch["seq"] not in chapters:
                raise ImageRefused(f"chapter {ch['seq']} is not in the imported article")
            loaded.append((chapters[ch["seq"]], after, spec.get("caption"), *load(base, spec)))
    conn.execute(text("DELETE FROM lecture.illustration WHERE chapter_id = ANY(:c)"), {"c": list(chapters.values())})
    if loaded:
        conn.execute(text("""INSERT INTO lecture.illustration (chapter_id, after_seq, caption, mime, width, height, data)
            VALUES (:c, :a, :cap, :m, :w, :h, :d)"""),
                     [{"c": c, "a": a, "cap": cap, "m": m, "w": w, "h": h, "d": d} for c, a, cap, m, w, h, d in loaded])
    return len(loaded)
