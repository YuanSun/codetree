# First-time setup (Mac Studio)

About 20 minutes. Run every command from the `lecture-magique/` folder unless a step says otherwise. Each step
ends with a **Check**: don't move on until it passes.

> ⚠️ **Keep the repo outside `~/Documents`, `~/Desktop`, `~/Downloads` and iCloud Drive** (e.g. in `~/Projects`).
> macOS blocks launchd services from reading those folders; the site would fail with `Operation not permitted`.

## 0. What you need

| Item | How to get it |
|---|---|
| `uv` and Node.js 18+ | `brew install uv node` |
| Postgres running, database `postgres` with your `family_budget` schema | already there (your expense data) |
| Internet access during setup | for Python packages, the spaCy model and the Wiktionary data (kaikki.org) |
| The Petit Robert file | `Le_Nouveau_Petit_Robert_de_la_langue_francaise_2007.ld2`, anywhere on the Mac |
| The book | `mega-trouille-content.zip` (sent separately, not in git) |

**Check:**

```bash
uv --version && node --version && psql -d postgres -c "\dn"
```

The schema list should include `family_budget`. Nothing in that schema is touched: the site gets its own new
schema, `lecture`, next to it in the same `postgres` database.

If your Postgres admin role is not your macOS username (e.g. it is `RyanSun`), tell `psql` once, so every command
in this guide uses it:

```bash
echo 'export PGUSER=RyanSun' >> ~/.zshrc && source ~/.zshrc
```

## 1. Get the code and the book

```bash
cd ~/Projects/codetree        # or: git clone https://github.com/YuanSun/codetree.git ~/Projects/codetree
git pull
cd lecture-magique
mkdir -p content
unzip ~/Downloads/mega-trouille-content.zip -d content
```

**Check:** `ls content` shows `mega-trouille.txt`, `mega-trouille.questions.json`, `mega-trouille.pack.json`.

## 2. Create the database role (once)

Pick a password for the website's database account. Use **letters and digits only**, because it goes inside a URL
in step 3.

```bash
psql -d postgres -v app_password="'PICK_A_PASSWORD'" -f deploy/init_role.sql
```

This creates the new `lecture` schema and a `lecture_app` role that can only use that schema. It grants nothing on
`family_budget` or `public` and doesn't change anything for your other roles.

```
database: postgres
├── schema family_budget   ← your expense data (untouched)
├── schema public
└── schema lecture         ← NEW: the reading site's 18 tables
```

**Check** (two commands):

```bash
psql -d postgres -c "\du lecture_app"
```

One row, `lecture_app`.

```bash
psql -d postgres -tAc "SELECT count(*) FROM pg_tables WHERE schemaname = 'family_budget'
  AND has_table_privilege('lecture_app', format('%I.%I', schemaname, tablename), 'SELECT,INSERT,UPDATE,DELETE')"
```

Prints `0`: the website's account has no access to any of your expense tables.

## 3. Write the config file

```bash
cp deploy/env.example .env
python3 -c "import secrets; print(secrets.token_urlsafe(48))"   # copy the output for SESSION_SECRET
open -e .env
```

Fill in the four values (`.env` is git-ignored):

```ini
DATABASE_URL=postgresql+psycopg://lecture_app:PICK_A_PASSWORD@localhost:5432/postgres
DATABASE_ADMIN_URL=postgresql+psycopg://YOUR_MAC_USERNAME@localhost:5432/postgres
ROBERT_LD2_PATH=/Users/YOUR_MAC_USERNAME/path/to/Le_Nouveau_Petit_Robert_de_la_langue_francaise_2007.ld2
SESSION_SECRET=<the long random string>
PORT=8090
```

- Both URLs end in `/postgres`: that's the database name. The schema (`lecture`) is set by the app itself.
- `DATABASE_URL`: the website's own account, with the password from step 2.
- `DATABASE_ADMIN_URL`: **the same admin role that ran step 2.** It's used only for migrations and imports. Add
  `:password` after the username if your Postgres requires one.

**Check:** `grep -c CHANGE_ME .env` prints `0`.

## 4. Build, migrate and start the service

```bash
deploy/deploy.sh
```

This builds the web pages, installs the Python packages (including the French spaCy model), creates the tables,
and installs a launchd service that starts at login and restarts if it crashes. The first run takes a few minutes.
If macOS asks whether Python may accept incoming network connections, click **Allow**.

**Check:** it ends with `✓ running: http://<your-mac>.local:8090/`, and opening that address in Safari on the Mac
shows the login page.

## 5. Import the dictionary (once, about a minute)

```bash
cd backend
uv run python -m importer.robert
```

It prints a summary line (`"lemmas": …, "senses": …`).

**Check** (the acceptance test from CLAUDE.md):

```bash
psql -d postgres -c "SELECT s.sense_key, left(s.definition_fr, 45) FROM lecture.sense s
  JOIN lecture.lemma l ON l.id = s.lemma_id WHERE l.lemma = 'entamer' ORDER BY s.seq"
```

There should be 6 rows, and the `I.2` row starts with *Couper en enlevant une partie*. You can re-run the import
safely: it updates entries, it never duplicates them.

## 5b. Import Wiktionary: conjugations and English glosses (once, about a minute)

Still in `backend/`. This streams the French Wiktionary extract from kaikki.org (~590 MB, not saved to disk) and
adds every verb's conjugation table, noun/adjective forms (*beaux → beau*) and short English glosses:

```bash
uv run python -m importer.wiktionary
```

It prints a summary (`"forms": …, "glossed_lemmas": …`). With it, a conjugated verb such as *demande* is matched
to **demander** instead of the noun *la demande*, the card shows its tense (*présent · il/elle*) and offers a
**Conjugaison** table. Re-running it is safe. Offline? Download the file once
(`curl -O https://kaikki.org/dictionary/French/kaikki.org-dictionary-French.jsonl`) and pass its path.

**Check:**

```bash
psql -d postgres -c "SELECT l.lemma, f.tags FROM lecture.word_form f JOIN lecture.lemma l ON l.id = f.lemma_id
  WHERE f.form = 'demande' AND l.pos = 'VERB'"
```

One row: `demander` with tags such as `ind.pres.1s, ind.pres.3s, subj.pres.3s …`.

## 6. Create the accounts

Still in `backend/`. Each command asks for the password twice.

```bash
uv run python -m app.cli create-user grace --role student
uv run python -m app.cli create-user ryan --role parent
```

**Check:** `uv run python -m app.cli list-users` lists both.

## 7. Import and publish the book

Import **after** the dictionary (step 5), otherwise no words get matched.

```bash
uv run python -m importer.article import ../content/mega-trouille.pack.json
```

It prints the word coverage and the most frequent unmatched words. Expect names (Lathuile, Trouperdec, Zaza…) and
Zoé's blocked-nose words (*ch'est*, *merchi*). The full list is in `../import-reports/`.

The article is now a **draft**: only parent accounts see it. Log in as `ryan`, open the book, tap a few words. When
you're happy:

```bash
uv run python -m importer.article publish 2026-w47-mega-trouille-au-chateau
```

**Check:** `uv run python -m importer.article list` shows it as `published`. Logged in as `grace`, the bookshelf
shows *Méga trouille au château*.

## 8. Set up Grace's devices

Find the Mac's address:

```bash
scutil --get LocalHostName
```

The site is `http://<that-name>.local:8090/`.

- **iPad (Safari):** open the address, log in, then Share → **Add to Home Screen**. For the read-aloud button, a
  French voice must be installed: Settings → Accessibility → Spoken Content → Voices → French → download
  *French (Canada)* if available.
- **Chromebook (Chrome):** open the address, log in, bookmark it. If `.local` doesn't resolve on the school
  Chromebook, use the Mac's IP instead (System Settings → Wi-Fi → Details), and reserve that IP for the Mac in your
  router so it doesn't change.

**Check** on each device: tap a word. The card appears immediately, and 🔊 speaks French.

## 9. Back up her reading history (recommended)

Add this to your existing backup routine (daily). It saves only the `lecture` schema (your `family_budget`
backup stays as it is):

```bash
pg_dump -d postgres --schema=lecture -Fc -f ~/Backups/lecture-$(date +%F).dump
```

---

## Upgrading an existing install

When a `git pull` brings new features (for example the Wiktionary conjugations, verb tenses and the weekly défi):

```bash
deploy/deploy.sh
```

This builds the front end and applies database migrations. Then, if you have not imported Wiktionary yet (step 5b),
import it and re-match the books already on the shelf. The re-match keeps her lookups:

```bash
cd backend && uv run python -m importer.wiktionary && uv run python -m importer.article rematch
```

The site is also on the family gateway at `http://<mac>:12999/lecture/` once the hosting gateway is restarted
(`hosting/run.sh`; check the config first with `caddy validate --config hosting/Caddyfile`).

## Serve it from the family gateway (optional)

The family gateway (`hosting/`, Caddy on port 12999) can run Lecture Magique together with the other family sites.
It is then at `http://<mac>.local:12999/lecture/` only, and port 8090 no longer answers other devices.

1. Install the gateway from this checkout, not from `~/Documents` (hosting/README.md: `.env`, `./run.sh` once in the
   foreground, then section 4 for the launchd job).
2. Add `RUN_BY=gateway` to `lecture-magique/.env` and run `deploy/deploy.sh --no-build`. It removes the separate
   `com.lecture-magique` service, restarts the gateway (whose `run.sh` starts the site on `127.0.0.1`), and ends with
   "running behind the gateway".
3. On the iPad and Chromebook, replace the bookmark with `http://<mac>.local:12999/lecture/` and log in once.

After a `git pull`, `deploy/deploy.sh` keeps working the same way. To go back to the separate service, set
`RUN_BY=launchd` and deploy again. (If you only want to close port 8090 but keep the separate service, use
`HOST=127.0.0.1` instead.)

## Later

| Task | Command |
|---|---|
| Update after a `git pull` | `deploy/deploy.sh` (or `deploy/deploy.sh --no-build` if only Python changed) |
| Re-match words of books already imported (after a new Wiktionary/Robert import) | `cd backend && uv run python -m importer.article rematch` (keeps her lookups) |
| Restart | `launchctl kickstart -k gui/$(id -u)/com.lecture-magique` |
| Stop / start | `launchctl bootout gui/$(id -u)/com.lecture-magique` / `deploy/deploy.sh --no-build` |
| Logs | `tail -f ~/Library/Logs/lecture-magique.log` |
| New password for Grace | `cd backend && uv run python -m app.cli set-password grace` |
| Weekly article | see "Every week" in [README.md](README.md) |
| See Grace's progress | log in as your parent account → **📊 Suivi**, or `psql -d postgres -v kid=grace -f tools/progress.sql` |

## If something goes wrong

| Symptom | Cause and fix |
|---|---|
| `Operation not permitted` in the log | The repo is under `~/Documents` (or Desktop/Downloads/iCloud). Clone it to `~/Projects`, copy `.env` and `content/`, delete `backend/.venv`, run `deploy/deploy.sh`. |
| `password authentication failed for user "ryan"` (or another name) during migration | `DATABASE_ADMIN_URL` in `.env` must use your real admin role (e.g. `RyanSun`). |
| `Bootstrap failed: 5: Input/output error` | launchd had not finished stopping the old copy, or the service was turned off with `launchctl disable`. `deploy.sh` now waits, re-enables and retries; on an older checkout run `launchctl enable gui/$(id -u)/com.lecture-magique` then `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.lecture-magique.plist`. |
| `Failed to spawn: alembic` | `backend/.venv` was copied from another folder. `rm -rf backend/.venv` and deploy again. |
| `Missing …/.env` from deploy.sh | Step 3 not done, or `.env` isn't in `lecture-magique/`. |
| `password authentication failed for user "lecture_app"` | The password in `DATABASE_URL` differs from step 2. Reset it: `psql -d postgres -c "ALTER ROLE lecture_app PASSWORD 'NEW'"` and update `.env`, then `launchctl kickstart -k gui/$(id -u)/com.lecture-magique`. |
| `permission denied for table …` or `for schema lecture` in the log | Migrations ran as a different role than step 2. Run as admin: `psql -d postgres -c "GRANT USAGE ON SCHEMA lecture TO lecture_app; GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA lecture TO lecture_app; GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA lecture TO lecture_app;"` |
| `✗ not answering yet` from deploy.sh | Read `~/Library/Logs/lecture-magique.log`. Usually a typo in `.env` or Postgres isn't running. |
| Works on the Mac but not on the iPad | Same Wi-Fi? Firewall: System Settings → Network → Firewall → allow Python. Try the IP instead of `.local`. |
| Tests (`pytest`) say "Refusing to run tests…" | On purpose: tests delete and recreate the `lecture` schema, so they refuse the `postgres` database and any database with a `family_budget` schema. Use a separate test database (see README → Tests). |
| Almost every word unmatched after importing the book | The book was imported before the dictionary. Run step 7's import again; it replaces the draft (allowed until someone has tapped words in it). |
| `… lookups already point at this article's tokens` | Someone already read it, so re-import is blocked to protect her history. Import the corrected pack under a new `slug`. |
| Card shows "pas encore dans le dictionnaire" | That word isn't in Petit Robert (often a name); expected, and the tap is still recorded. |
