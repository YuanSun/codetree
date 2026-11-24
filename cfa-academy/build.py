#!/usr/bin/env python3
"""Assemble the CFA study site: content/curriculum.json (from extract.py) + assets -> ../hosting/sites/cfa."""
import json, pathlib, shutil, sys

HERE = pathlib.Path(__file__).resolve().parent
OUT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else HERE.parent / "hosting" / "sites" / "cfa"
src = HERE / "content" / "curriculum.json"
if not src.is_file():
    sys.exit("Run extract.py first (see README.md).")
tmp = OUT.with_name(OUT.name + ".new")
shutil.rmtree(tmp, ignore_errors=True)
shutil.copytree(HERE / "assets", tmp)
data = json.loads(src.read_text(encoding="utf-8"))
(tmp / "curriculum.js").write_text("const CURRICULUM = " + json.dumps(data, ensure_ascii=False) + ";\n", encoding="utf-8")
shutil.rmtree(OUT, ignore_errors=True)
tmp.rename(OUT)
print(f"Built {sum(len(t['readings']) for t in data)} readings -> {OUT}")
