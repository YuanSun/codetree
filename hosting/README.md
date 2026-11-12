# Hosting everything in one place

One small gateway ([Caddy](https://caddyserver.com)) serves all the personal web projects from one machine, on one
address and one port. Reach it by whatever name the machine has (`mac-studio.local`, an IP, a Tailscale name):

| URL | What | How it's served |
|---|---|---|
| `http://<machine>:12999/` | Portal page linking to everything | static (`portal/`) |
| `/fund/` | [Fund Accounting Academy](../fund-accounting-academy) | static files |
| `/math/` | [MathCompetition](../MathCompetition) — the **Math Contest Lab** (CJMC / Gauss prep) | reverse proxy to its Python server on `127.0.0.1:12998`, started with `--base-path /math` |
| `/math/study/` | the same project's **School Study** track (normal class sheets, not contest prep) | same server and proxy rule as `/math/`; it has its own portal card, colours and navigation |
| `/notes/` | Family Obsidian vault | static site built by [Quartz](https://quartz.jzhao.xyz); **password-protected** |
| `/budget/` | [Family budget dashboard](../budget-advisor/budget-dashboard) | reverse proxy to its Streamlit app on `127.0.0.1:12997` (`--server.baseUrlPath budget`); **same login as the notes** |
| `/lecture/` | [Lecture Magique](../lecture-magique) (French reading site) | reverse proxy to its own launchd service on `127.0.0.1:8090` (`LECTURE_PORT`); uses relative URLs, so the prefix is simply stripped; **its own login** (set up per [lecture-magique/SETUP.md](../lecture-magique/SETUP.md)) |

Because everything is a path on one host, there is no DNS or hosts-file setup on the devices that connect.
Adding another project later = one more `handle_path` block in `Caddyfile` (static folder or `reverse_proxy`
to a local port; a dynamic app needs to be able to run under a path prefix, like MathCompetition's `--base-path`).

## 1. Run it

```bash
brew install caddy
cd hosting
cp env.example .env
caddy hash-password              # paste the output into NOTES_HASH in .env
./run.sh
```

Open `http://localhost:12999/` on the same machine, or `http://mac-studio.local:12999/` (use your machine's name) from
another device on your network. macOS may ask whether Caddy may accept incoming connections: allow it.

The budget dashboard reads the `family_budget` Postgres database, so before `./run.sh` it needs
`pip install -r budget-advisor/budget-dashboard/requirements.txt` (in its `.venv`, which `run.sh` prefers) and a
`budget-advisor/budget-dashboard/.env` with the database credentials. If either is missing, `run.sh` skips `/budget/`
and starts everything else. The gateway login (`NOTES_USER` / `NOTES_HASH`) guards it in addition to the dashboard's own
admin login, because the data is financial.

## 2. Publish the family notes

```bash
# put VAULT=/path/to/family-vault in hosting/.env, then:
./build-notes.sh
```

The first run downloads Quartz (the tool that turns a vault into a website) into `hosting/.quartz`; later runs reuse it.
Re-run it when notes change. To publish only some folders, set `VAULT_DIRS="Family,Recipes"` in `.env` (comma-separated, relative to `VAULT`). Only the vault folder you point it at is published; keep private notes outside it.
Quartz is served under `/notes/`; if its links or search misbehave there, set `baseUrl` in `.quartz/quartz.config.ts`
to `<your-host>/notes`.

## 3. Reaching it from outside your home network

The gateway speaks plain HTTP, so browsers show "not secure" and anything typed (like the notes password) is unencrypted.
That is acceptable for the academy and math lab on your home Wi-Fi, but not for the notes or for the internet.

| Option | Good for | Setup |
|---|---|---|
| **Home Wi-Fi only** | Just the household | Nothing extra. Give the host a fixed IP in your router so the address stays stable. |
| **Cloudflare Tunnel + Access** (recommended for outside access) | Family anywhere, real HTTPS, email-code login | Needs a domain (~$10/yr) on Cloudflare. Create a tunnel routing your hostname to `http://localhost:12999`, then add an Access policy listing family emails. No router ports opened. |
| **Tailscale** | Your own devices anywhere, encrypted | Install on both machines; use the host's Tailscale name. `tailscale serve` can add HTTPS. |
| **Small VPS** | Machine that never sleeps | Same files; use Caddy's automatic HTTPS (remove `auto_https off` and the `http://` prefix). |

- The host machine must stay awake and online (`caffeinate -s ./run.sh` helps on macOS; a Mac mini or Raspberry Pi is ideal).
- MathCompetition and the academy store progress in each browser's `localStorage`, which is per device and per address, so
  changing the address you use starts progress afresh.

## 4. Start on login (macOS)

```bash
sed "s#__HOSTING__#$PWD#g" com.codetree.gateway.plist > ~/Library/LaunchAgents/com.codetree.gateway.plist
launchctl load ~/Library/LaunchAgents/com.codetree.gateway.plist
```

(Edit the Caddy path inside the plist if `which caddy` isn't `/opt/homebrew/bin/caddy`.)

## Files

```
hosting/
├── Caddyfile                       # routing for all sites
├── load-env.sh                     # reads .env literally (safe for "$" in hashes)
├── run.sh                          # starts MathCompetition + budget dashboard + Caddy
├── build-notes.sh                  # vault -> static site (Quartz)
├── env.example                     # copy to .env
├── com.codetree.gateway.plist      # optional launchd job
└── portal/index.html               # landing page
```

## Exam prep site (/exam/)

Built from the Apple Notes folder by the `exam-prep-site/` subproject (see its README). The page is private and sits behind the
same login as `/notes/`. Build it into `hosting/sites/exam` and the gateway serves it; no restart is needed for content changes.
