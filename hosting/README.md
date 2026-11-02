# Hosting everything in one place

One small gateway ([Caddy](https://caddyserver.com)) serves all the personal web projects from a single machine and a single
domain, each on its own subdomain:

| URL | What | How it's served |
|---|---|---|
| `DOMAIN` | Portal page linking to everything | static (`portal/`) |
| `fund.DOMAIN` | [Fund Accounting Academy](../fund-accounting-academy) | static files |
| `math.DOMAIN` | [MathCompetition](../MathCompetition) | reverse proxy to its Python server on `127.0.0.1:12998` |
| `notes.DOMAIN` | Family Obsidian vault | static site built by [Quartz](https://quartz.jzhao.xyz); **password-protected** |

Why subdomains and not `DOMAIN/math/`? MathCompetition emits absolute links (`/static/...`, `/week/...`), so it can't live under a path prefix without code changes.

Adding another project later = one more block in `Caddyfile` (static folder or `reverse_proxy` to a local port).

## 1. Try it locally

```bash
brew install caddy
cd hosting
cp env.example .env              # DOMAIN=localhost is fine for now
caddy hash-password              # paste the output into NOTES_HASH in .env
./run.sh
```

Open `http://localhost:8080` (portal), `http://fund.localhost:8080`, `http://math.localhost:8080`.
(`*.localhost` resolves to your own machine in Chrome, Firefox and recent Safari.)

## 2. Publish the family notes

```bash
# put VAULT=/path/to/family-vault in hosting/.env, then:
./build-notes.sh
```

Re-run it when notes change (cron/launchd can do it nightly). Only the vault folder you point it at is published; keep private
notes outside it. Quartz can skip files marked `draft: true` in their frontmatter.

## 3. Reach it from your phone / family devices

Pick one:

| Option | Good for | Setup |
|---|---|---|
| **Cloudflare Tunnel + Access** (recommended) | Family and friends anywhere, with email-code login | Needs a domain (~$10/yr) on Cloudflare. Create a tunnel, route `*.yourdomain` and `yourdomain` to `http://localhost:8080`, set `DOMAIN=yourdomain` in `.env`, then add a Cloudflare Access policy listing family emails. No ports opened on your router. |
| **Home Wi-Fi only** | Just the household | Run `./run.sh` on an always-on Mac, then add `192.168.x.x  fund.home math.home notes.home` style entries on devices (or run a local DNS such as your router's). Set `DOMAIN=home`. |
| **Small VPS** | Machine that never sleeps, no home network exposure | Same files on a $5/mo VPS; use Caddy's automatic HTTPS (remove `auto_https off` and the `http://` prefixes). |

Things to know:

- The host machine must stay awake and online. A laptop that sleeps takes everything offline; a Mac mini or Raspberry Pi is ideal. On macOS, `caffeinate -s ./run.sh` keeps it awake.
- The family notes are private data. Don't expose them without authentication; the Caddy `basic_auth` is a second layer, so also use Access/VPN.
- MathCompetition stores progress in each browser's `localStorage`, so progress is per device and per hostname. Moving to a new domain starts fresh.

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
├── run.sh                          # starts MathCompetition + Caddy
├── build-notes.sh                  # vault -> static site (Quartz)
├── env.example                     # copy to .env
├── com.codetree.gateway.plist      # optional launchd job
└── portal/index.html               # landing page
```
