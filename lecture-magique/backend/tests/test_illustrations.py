"""Pictures in a chapter: text2pack @image lines, import (and refusal), the chapter API, access rules,
and replacing pictures on an article that already has lookups. Pictures are generated here."""
import copy
import struct
import uuid
import zlib
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.auth import hash_password, lockout
from importer import images
from importer.article import ImportRefused, import_pack, replace_images, set_status
from importer.robert import import_entries as import_robert
from tests.test_article_import import PACK, dictionary

PW = "secret123"


def png(w: int, h: int) -> bytes:
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))
    raw = b"".join(b"\x00" + b"\x80\x40\x20" * w for _ in range(h))
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


def jpeg_header(w: int, h: int) -> bytes:
    app0 = b"\xff\xe0" + struct.pack(">H", 16) + b"JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
    sof = b"\xff\xc0" + struct.pack(">HBHHB", 11, 8, h, w, 1) + b"\x01\x11\x00"
    return b"\xff\xd8" + app0 + sof + b"\xff\xd9"


def test_image_info():
    assert images.image_info(png(30, 20)) == ("image/png", 30, 20)
    assert images.image_info(jpeg_header(1200, 900)) == ("image/jpeg", 1200, 900)
    with pytest.raises(images.ImageRefused):
        images.image_info(b"GIF89a....")


def test_text2pack_image_lines():
    import sys
    sys.path.insert(0, str(Path(__file__).parents[2] / "tools"))
    from text2pack import parse
    doc = parse("@title T\n## 1 Un\n@image a.jpg | Le marchand\n\nPremier.\n\nDeuxième.\n\n@image b.png\n\nTroisième.\n")
    ch = doc["chapters"][0]
    assert len(ch["paragraphs"]) == 3
    assert ch["images"] == [{"after": 0, "file": "a.jpg", "caption": "Le marchand"},
                            {"after": 2, "file": "b.png", "caption": None}]


def pack_with_pictures(tmp_path: Path) -> dict:
    (tmp_path / "img").mkdir()
    (tmp_path / "img" / "a.png").write_bytes(png(40, 30))
    (tmp_path / "img" / "b.png").write_bytes(png(20, 50))
    pack = copy.deepcopy(PACK)
    pack["chapters"][0]["images"] = [{"after": 0, "file": "img/a.png", "caption": "Un départ"},
                                     {"after": 1, "file": "img/b.png"}]
    return pack


@pytest.fixture
def world(db, tmp_path):
    lockout.fails.clear()
    lockout.until.clear()
    pack = pack_with_pictures(tmp_path)
    with db.begin() as c:
        import_robert(c, dictionary())
        rep = import_pack(c, pack, base=tmp_path)
        for name, role in (("grace", "student"), ("ryan", "parent")):
            c.execute(text("INSERT INTO lecture.app_user (username, display_name, password_hash, role) "
                           "VALUES (:u, :u, :h, :r)"), {"u": name, "h": hash_password(PW), "r": role})
    from app.main import app
    return {"app": app, "db": db, "rep": rep, "pack": pack, "base": tmp_path}


def login(world, name):
    c = TestClient(world["app"])
    assert c.post("/api/auth/login", json={"username": name, "password": PW}).status_code == 200
    return c


def test_chapter_api_and_access(world):
    assert world["rep"]["images"] == 2
    aid = world["rep"]["article_id"]
    g, papa = login(world, "grace"), login(world, "ryan")
    pics = papa.get(f"/api/articles/{aid}/chapters/1").json()["illustrations"]
    assert [(p["after"], p["width"], p["height"], p["caption"]) for p in pics] == [(0, 40, 30, "Un départ"), (1, 20, 50, None)]
    r = papa.get(f"/api/illustrations/{pics[0]['id']}")
    assert r.status_code == 200 and r.headers["content-type"] == "image/png" and r.content == png(40, 30)
    assert "immutable" in r.headers["cache-control"]
    # draft: not for children yet; nobody without a session
    assert g.get(f"/api/illustrations/{pics[0]['id']}").status_code == 404
    assert TestClient(world["app"]).get(f"/api/illustrations/{pics[0]['id']}").status_code == 401
    with world["db"].begin() as c:
        set_status(c, PACK["slug"], "published")
    assert g.get(f"/api/illustrations/{pics[0]['id']}").content == png(40, 30)
    assert g.get(f"/api/articles/{aid}/chapters/2").json()["illustrations"] == []


def test_bad_pictures_are_refused(db, tmp_path):
    with db.begin() as c:
        import_robert(c, dictionary())
    for spec, msg in (({"after": 0, "file": "nope.png"}, "not found"),
                      ({"after": 99, "file": "a.png"}, "paragraphs"),
                      ({"after": 0, "file": "big.png"}, "limit")):
        (tmp_path / "a.png").write_bytes(png(4, 4))
        (tmp_path / "big.png").write_bytes(png(4, 4) + b"\x00" * images.MAX_BYTES)
        pack = copy.deepcopy(PACK)
        pack["chapters"][0]["images"] = [spec]
        with pytest.raises(images.ImageRefused, match=msg), db.begin() as c:
            import_pack(c, pack, base=tmp_path)
        with db.connect() as c:  # the whole import rolled back
            assert c.execute(text("SELECT count(*) FROM lecture.article")).scalar() == 0


def test_replace_pictures_keeps_lookups(world):
    with world["db"].begin() as c:
        set_status(c, PACK["slug"], "published")
    g = login(world, "grace")
    with world["db"].connect() as c:
        tid = c.execute(text("SELECT t.id FROM lecture.token t WHERE t.lemma_id IS NOT NULL LIMIT 1")).scalar()
    assert g.post("/api/lookups", json={"events": [{"id": str(uuid.uuid4()), "token_id": tid}]}).status_code == 200
    pack = world["pack"]
    with pytest.raises(ImportRefused), world["db"].begin() as c:  # full re-import refused once read...
        import_pack(c, pack, base=world["base"])
    pack["chapters"][0]["images"] = [{"after": 2, "file": "img/b.png", "caption": "Plus loin"}]
    with world["db"].begin() as c:  # ...but the pictures alone can be swapped
        assert replace_images(c, pack, world["base"]) == 1
    with world["db"].connect() as c:
        assert c.execute(text("SELECT after_seq, caption FROM lecture.illustration")).all() == [(2, "Plus loin")]
        assert c.execute(text("SELECT count(*) FROM lecture.lookup_event WHERE token_id = :t"), {"t": tid}).scalar() == 1
    changed = copy.deepcopy(pack)
    changed["chapters"][0]["paragraphs"].append("Un paragraphe de plus.")
    with pytest.raises(ImportRefused, match="differ"), world["db"].begin() as c:
        replace_images(c, changed, world["base"])
