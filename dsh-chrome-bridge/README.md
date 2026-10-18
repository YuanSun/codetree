# DSH Chrome Bridge

A small Chrome extension plus a local MCP server, so DeepSeek Harness (DSH) can read, and with your permission act on, **tabs you choose to share** in your normal Chrome, using your existing logins.

It does not read Chrome's profile folder, so it needs no macOS Full Disk Access.

```
DSH ──stdio MCP──> server/index.js ──ws://127.0.0.1:17373──> Chrome extension ──> shared tabs
```

Status: v0.1, written and tested outside a real Chrome (see "What was tested").

## Install

1. Unzip so the folder is `~/dsh-chrome-bridge` (avoid Desktop, Documents and iCloud folders).
2. Install the server's dependencies:
   ```
   cd ~/dsh-chrome-bridge/server
   npm install --omit=dev
   ```
3. Print the pairing token (it is created on first use and stored in `~/.dsh-chrome-bridge/token`, readable only by you):
   ```
   node index.js --print-token
   ```
4. In Chrome open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and choose `~/dsh-chrome-bridge/extension`. Pin the icon.
5. Add the server to your DSH patch file (use the absolute path from `which node` if `node` is not found):
   ```yaml
   - insert:
       - id: mcp-chrome-bridge
         name: "@deepseek-ai/dsh-mcp-client"
         config:
           serverName: chrome
           transport: stdio
           command: node
           args:
             - /Users/yuansun/dsh-chrome-bridge/server/index.js
           env: {}
           cwd: !!js process.cwd()
   ```
   Restart `dsh`. Tools appear as `mcp__chrome__tabs_list`, `mcp__chrome__page_snapshot`, and so on.
6. Click the extension icon, paste the token, click **Save & Connect**. Status should read `connected`.

## Daily use

1. Open the page you want help with and click the extension icon.
2. Click **Share this tab**. Chrome asks you to approve access to that one site. Approve it.
3. Ask DSH to work. Start with: "Call `tabs_list`, then `page_snapshot` on the first tab."
4. Reading is on by default. To let DSH click, type, scroll or navigate, tick **Allow actions**. It turns itself off after 10 minutes.
5. When done, click **Stop sharing this tab** or **Stop sharing all**. Both remove the site approval.

## Tools

| Tool | Needs "Allow actions" | What it does |
|---|---|---|
| `tabs_list` | no | Shared tabs, plus whether actions are on |
| `page_snapshot` | no | Title, URL, visible text (capped), numbered interactive elements |
| `page_navigate` | yes | Go to an http(s) URL in a shared tab |
| `page_click` | yes | Click an element by ref |
| `page_type` | yes | Type into a field by ref, optional submit |
| `page_scroll` | yes | Scroll up, down, top or bottom |

Refs (like `e12`) are only valid until the next `page_snapshot`.

## Safety design

- Only tabs you share are visible. Nothing else, including other tabs, history, cookies, saved passwords and downloads, is reachable. The manifest does not request those permissions.
- Site access is per site, granted through Chrome's own prompt, and removed when you stop sharing.
- Actions are off by default and expire after 10 minutes.
- The extension refuses to type into password fields, payment fields (`cc-*`), one-time-code fields, and file pickers, and refuses `javascript:` links. Password field values never appear in snapshots.
- Navigation is limited to http and https.
- The server listens on 127.0.0.1 only, rejects connections whose Origin is not a browser extension (so web pages cannot connect), and requires the token from a file only you can read.
- Everything the pages return is wrapped in `<untrusted_web_content>` with a reminder that it is data, not instructions. This lowers prompt-injection risk, it does not remove it. A small local model can still be tricked by hostile page text, so keep "Allow actions" off unless you are watching.
- Anything running as you on this Mac can read the token file, so this does not defend against malware already on your machine.

## What was tested

- `npm test` runs 41 tests: the MCP server end to end against a mock extension (auth, origin rejection, timeouts, tag-escaping), the page functions in jsdom, and the extension's permission gating against a fake Chrome API.
- **Not tested:** the extension inside real Chrome (popup rendering, Chrome's permission prompt, service-worker keepalive), and DSH itself. Expect small fixes on first run.

## Troubleshooting

- **Status stays `disconnected`:** open `chrome://extensions`, click the extension's **service worker** link, and read the console. Check that the port in the popup matches `DSH_BRIDGE_PORT` (default 17373) and that DSH has started the server (tools visible).
- **`rejected: check the token`:** re-run `node index.js --print-token` and paste it again.
- **Port in use:** set `DSH_BRIDGE_PORT` in the DSH config's `env` and change the port in the popup.
- **Extension won't load or is greyed out:** an employer-managed Chrome can block developer-mode extensions.
- **`no access to this tab`:** click **Share this tab** again on that tab. Navigating to a new site needs a new approval.
- **Pages with iframes or infinite scroll:** v0.1 reads the main frame only. Use `page_scroll` then `page_snapshot` for infinite lists.

## Not included yet

Screenshots, iframe content, file uploads, multi-tab workflows beyond one share per tab, and any Chrome Web Store packaging.
