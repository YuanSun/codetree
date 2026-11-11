"""Import Le Petit Robert into lecture.lemma / lecture.sense / lecture.word_form.

    uv run python -m importer.robert                      # reads $ROBERT_LD2_PATH
    uv run python -m importer.robert --jsonl robert.jsonl # or a robert_extract.py output

Idempotent: lemmas are upserted on (lemma, pos, homograph), senses on (lemma_id, source, seq).
Senses that disappear on re-import are deleted (tokens pointing at them are re-pointed first).
The dictionary is commercial content: never commit the .ld2, the JSONL or anything exported from it.
"""
import argparse
import json
import sys
import time
from collections.abc import Iterable, Iterator
from pathlib import Path

from sqlalchemy import Column, Connection, Integer, MetaData, SmallInteger, Table, Text, text
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.config import settings
from app.db import get_engine

from .headword import map_pos, normalize_headword

TOOLS = Path(__file__).resolve().parents[2] / "tools"
SOURCE = "petit_robert"
MAX_EXAMPLES = 6
BATCH = 1000

LEMMA = Table("lemma", MetaData(schema="lecture"),
              Column("id", Integer, primary_key=True), Column("lemma", Text), Column("pos", Text),
              Column("homograph", SmallInteger), Column("gender", Text), Column("ipa", Text))


def iter_ld2(path: str) -> Iterator[dict]:
    sys.path.insert(0, str(TOOLS))
    from ld2 import entries  # type: ignore
    from robert_extract import parse  # type: ignore

    for word, xml in entries(path):
        yield parse(word, xml)


def iter_jsonl(path: str) -> Iterator[dict]:
    with open(path, encoding="utf-8") as f:
        for line in f:
            if line.strip():
                yield json.loads(line)


def prepare(entries: Iterable[dict]) -> tuple[dict, dict]:
    """Group parsed entries by (lemma, pos, homograph). Returns (lemmas, stats)."""
    lemmas: dict[tuple, dict] = {}
    stats = {"entries": 0, "authors": 0, "no_senses": 0}
    for e in entries:
        stats["entries"] += 1
        if e.get("kind") == "author":
            stats["authors"] += 1
            continue
        hw = normalize_headword(e["headword"])
        if not hw.lemma:
            continue
        upos, gender = map_pos(e.get("pos"))
        key = (hw.lemma, upos, e.get("homograph") or 0)
        item = lemmas.setdefault(key, {"gender": gender, "ipa": e.get("ipa"), "senses": [], "forms": set()})
        item["forms"].update(hw.forms)
        if not e.get("senses"):
            stats["no_senses"] += 1
        for s in e.get("senses") or []:
            item["senses"].append({
                "sense_key": s.get("key") or None,
                "definition_fr": s.get("definition") or None,
                "examples": (s.get("examples") or [])[:MAX_EXAMPLES],
            })
    return lemmas, stats


def write(conn: Connection, lemmas: dict) -> dict:
    keys = list(lemmas)
    n_senses = n_forms = 0
    for i in range(0, len(keys), BATCH):
        chunk = keys[i:i + BATCH]
        rows = [{"lemma": k[0], "pos": k[1], "homograph": k[2], "gender": lemmas[k]["gender"],
                 "ipa": lemmas[k]["ipa"]} for k in chunk]
        stmt = pg_insert(LEMMA).values(rows)
        stmt = stmt.on_conflict_do_update(
            index_elements=[LEMMA.c.lemma, LEMMA.c.pos, LEMMA.c.homograph],
            set_={"gender": stmt.excluded.gender, "ipa": stmt.excluded.ipa},
        ).returning(LEMMA.c.id, LEMMA.c.lemma, LEMMA.c.pos, LEMMA.c.homograph)
        ids = {(r.lemma, r.pos, r.homograph): r.id for r in conn.execute(stmt)}
        sense_rows, form_rows, keep = [], [], []
        for k in chunk:
            lid = ids[k]
            senses = lemmas[k]["senses"]
            keep.append({"lid": lid, "n": len(senses)})
            for seq, s in enumerate(senses):
                sense_rows.append({
                    "lid": lid, "src": SOURCE, "seq": seq, "key": s["sense_key"], "def": s["definition_fr"],
                    "ex": s["examples"][0] if s["examples"] else None,
                    "raw": json.dumps({"examples": s["examples"]}, ensure_ascii=False),
                })
            form_rows.append({"form": k[0].lower(), "lid": lid, "tags": ["lemma"]})
            for form, tag in lemmas[k]["forms"]:
                form_rows.append({"form": form.lower(), "lid": lid, "tags": [tag]})
        if sense_rows:
            conn.execute(text("""
                INSERT INTO lecture.sense (lemma_id, source, seq, sense_key, definition_fr, example_fr, raw)
                VALUES (:lid, :src, :seq, :key, :def, :ex, CAST(:raw AS jsonb))
                ON CONFLICT (lemma_id, source, seq) DO UPDATE SET
                  sense_key = EXCLUDED.sense_key, definition_fr = EXCLUDED.definition_fr,
                  example_fr = EXCLUDED.example_fr, raw = EXCLUDED.raw"""), sense_rows)
        # Drop senses beyond the new count (entry got shorter since the last import).
        conn.execute(text("""
            UPDATE lecture.token t SET sense_id = NULL FROM lecture.sense s
            WHERE t.sense_id = s.id AND s.lemma_id = :lid AND s.source = 'petit_robert' AND s.seq >= :n"""), keep)
        conn.execute(text("""
            DELETE FROM lecture.sense WHERE lemma_id = :lid AND source = 'petit_robert' AND seq >= :n"""), keep)
        conn.execute(text("""
            INSERT INTO lecture.word_form (form, lemma_id, tags) VALUES (:form, :lid, :tags)
            ON CONFLICT (form, lemma_id) DO NOTHING"""), form_rows)
        n_senses += len(sense_rows)
        n_forms += len(form_rows)
    return {"lemmas": len(keys), "senses": n_senses, "forms": n_forms}


def import_entries(conn: Connection, entries: Iterable[dict]) -> dict:
    lemmas, stats = prepare(entries)
    stats.update(write(conn, lemmas))
    return stats


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ld2", default=settings.robert_ld2_path, help="path to the .ld2 (default $ROBERT_LD2_PATH)")
    ap.add_argument("--jsonl", help="use a robert_extract.py JSONL instead of the .ld2")
    a = ap.parse_args(argv)
    if not a.jsonl and not a.ld2:
        ap.error("set ROBERT_LD2_PATH or pass --ld2 / --jsonl")
    t = time.time()
    source = iter_jsonl(a.jsonl) if a.jsonl else iter_ld2(a.ld2)
    with get_engine(settings.admin_url or None).begin() as conn:
        stats = import_entries(conn, source)
    stats["seconds"] = round(time.time() - t, 1)
    print(json.dumps(stats, ensure_ascii=False))


if __name__ == "__main__":
    main()
