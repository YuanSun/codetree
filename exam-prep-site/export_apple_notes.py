#!/usr/bin/env python3
"""Export one Apple Notes folder to Markdown files (for the Quartz family-notes site).

  ./export-apple-notes.py ExamPreparation ~/FamilyVault/Grace/ExamPreparation

Needs macOS (osascript) and pandoc (brew install pandoc). Run it on the Mac that has the notes.
SKIP="word,other" leaves out notes whose title contains any of those words.
The output holds private notes, so keep it outside the git repo (e.g. inside the Obsidian vault).
"""
import os, pathlib, re, subprocess, sys, tempfile

SAVE = '''
on run argv
  set i to 0
  tell application "Notes"
    repeat with a in (attachments of note id (item 1 of argv))
      set i to i + 1
      try
        set nm to name of a
        if nm is missing value then set nm to "attachment"
        save a in (POSIX file ((item 2 of argv) & "/" & i & "-" & nm))
      end try
    end repeat
  end tell
end run
'''
SEP_NOTE, SEP_FIELD = "\x1e", "\x1f"
SCRIPT = '''
on run argv
  set out to ""
  tell application "Notes"
    repeat with n in (notes of folder (item 1 of argv))
      set out to out & (id of n) & (ASCII character 31) & (name of n) & (ASCII character 31) & ((creation date of n) as «class isot» as string) & (ASCII character 31) & ((modification date of n) as «class isot» as string) & (ASCII character 31) & (body of n) & (ASCII character 30)
    end repeat
  end tell
  return out
end run
'''


def slug(name):
    s = re.sub(r'[\\/:*?"<>|#^\[\]]+', " ", name).strip()
    return re.sub(r"\s+", " ", s) or "untitled"


def save_attachments(nid, folder):
    folder.mkdir(parents=True, exist_ok=True)
    subprocess.run(["osascript", "-e", SAVE, nid, str(folder)], capture_output=True, text=True)
    return sorted(p for p in folder.iterdir() if p.is_file())


def link(f, dest):
    rel = f.relative_to(dest).as_posix().replace(" ", "%20")
    label = re.sub(r"^\d+-", "", f.name)
    if f.suffix.lower() in (".png", ".jpg", ".jpeg", ".gif", ".webp"):
        return f"![{label}]({rel})\n"
    return f"- [{label}]({rel})"


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    folder, dest = sys.argv[1], pathlib.Path(sys.argv[2]).expanduser()
    raw = subprocess.run(["osascript", "-e", SCRIPT, folder], capture_output=True, text=True)
    if raw.returncode:
        sys.exit("osascript failed (allow Terminal to control Notes in System Settings > Privacy):\n" + raw.stderr)
    dest.mkdir(parents=True, exist_ok=True)
    used, count = set(), 0
    for rec in raw.stdout.split(SEP_NOTE):
        if SEP_FIELD not in rec:
            continue
        nid, name, created, modified, body = rec.strip("\n").split(SEP_FIELD, 4)
        if any(w and w.lower() in name.lower() for w in os.environ.get("SKIP", "").split(",")):
            continue
        # Apple's isot value looks like 2026-08-06T22:14:11; keep the date for sorting.
        day = created[:10]
        base = slug(name)
        fname = f"{day} {base}" if re.fullmatch(r"\d{4}-\d\d-\d\d", day) else base
        while fname in used:
            fname += " 2"
        used.add(fname)
        with tempfile.TemporaryDirectory() as tmp:
            media = pathlib.Path(tmp)
            html = pathlib.Path(tmp) / "n.html"
            html.write_text(body, encoding="utf-8")
            md = subprocess.run(
                ["pandoc", "-f", "html", "-t", "gfm-raw_html", "--wrap=none",
                 "--extract-media", str(dest / "attachments" / fname), str(html)],
                capture_output=True, text=True)
            if md.returncode:
                sys.exit(f"pandoc failed on '{name}':\n{md.stderr}")
        text = re.sub(r"(?m)^\\\s*$", "", md.stdout)        # lone "\" lines come from <br>
        text = re.sub(r"\A# .*\n", "", text.lstrip())            # title is shown by Quartz already
        files = save_attachments(nid, dest / "files" / fname)
        if files:
            text += "\n## Attachments\n\n" + "\n".join(link(f, dest) for f in files) + "\n"
        text = re.sub(r"\n{3,}", "\n\n", text).strip() + "\n"
        title = name.replace('"', "'")
        front = f'---\ntitle: "{title}"\ndate: {day}\nmodified: {modified[:10]}\ntags: [exam-prep]\n---\n\n'
        (dest / f"{fname}.md").write_text(front + text, encoding="utf-8")
        count += 1
    print(f"Exported {count} notes from '{folder}' to {dest}")


if __name__ == "__main__":
    main()
