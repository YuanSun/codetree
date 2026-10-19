# DSH Chrome Bridge

A small Chrome extension plus a local MCP server, so DeepSeek Harness (DSH) can read, and with your permission act on, **tabs you choose to share** in your normal Chrome, using your existing logins.

It does not read Chrome's profile folder, so it needs no macOS Full Disk Access.

```
DSH ──stdio MCP──> server/index.js ──ws://127.0.0.1:17373──> Chrome extension ──> shared tabs
```

Status: v0.3. Tested with automated tests only; the real-Chrome checklist in `docs/verification.md` still needs a manual pass.

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
           env:
             DSH_BRIDGE_EXTENSION_ID: fpahkekcpddpmobinggnphafjockjcea
           cwd: !!js process.cwd()
   ```
   The extension's ID is pinned by the `key` in its manifest, so it is always `fpahkekcpddpmobinggnphafjockjcea` however you load it. With `DSH_BRIDGE_EXTENSION_ID` set, the server refuses any other extension, even one that has the token. Leave `env` empty to accept any extension that has the token.

   Restart `dsh`. Tools appear as `mcp__chrome__tabs_list`, `mcp__chrome__page_snapshot`, and so on.
6. Click the extension icon, paste the token, click **Save & Connect**. Status should read `connected`.

## Daily use

1. Open the page you want help with and click the extension icon.
2. Click **Share this tab**. Chrome asks you to approve access to that one site. Approve it.
3. Ask DSH to work. Start with: "Call `tabs_list`, then `page_snapshot` on the first tab."
4. Reading is on by default. To let DSH click, type, scroll or navigate, tick **Allow actions**. By default it turns itself off after 10 minutes. If you only use a model you trust, tick **Keep actions on until I switch them off** to remove the expiry; **Stop sharing all** and Alt+Shift+K still switch actions off.
5. When done, click **Stop sharing this tab** or **Stop sharing all**. Both remove the site approval, except for allowed sites (below).
6. Emergency stop: press **Alt+Shift+K** (change it at `chrome://extensions/shortcuts`). It stops all sharing, closes tabs DSH opened, and switches actions off. The badge is red while actions are on.

### Allowed sites (let DSH open its own tabs)

1. Open the site (for example `https://www.linkedin.com`), click the icon, click **Allow this site**, approve Chrome's prompt once.
2. DSH can now call `page_open` for any https URL on that exact origin. The tab opens in the background and is shared automatically. Reading needs no "Allow actions" tick.
3. DSH sees only tabs it opened itself and tabs you shared. Tabs you opened on an allowed site stay invisible unless you share them.
4. Up to 5 tabs opened by DSH at a time. Remove a site in the popup to unshare its tabs, close the ones DSH opened there, and drop Chrome's access.
5. https only, exact origins only, and sign-in hosts (`accounts.google.com`, `login.microsoftonline.com`, `appleid.apple.com`) can never be allowed. The list is `DENYLIST` in `extension/core.js`.
6. A page that redirects to a site you did not allow is closed.
7. The popup's **Recent activity** list shows the last commands: method, tab, site, outcome. It never stores page content, typed text or full URLs.

## Debugger build (v0.3)

A second control lane that works the way Claude in Chrome does: it sends Chrome DevTools Protocol (CDP) commands through `chrome.debugger`. It adds screenshots, an accessibility tree, real mouse and keyboard input, iframe reading, console and network summaries, and an optional page-script tool. It needs a separate build because Chrome does not allow `debugger` as an optional permission.

- Build it: `cd server && npm run build:debugger`, then load `dist/extension-debugger` unpacked **instead of** `extension/` (both have the same ID, so load only one). `npm run pack` also writes `dsh-chrome-bridge-<version>-debugger.zip`.
- Chrome shows a **"started debugging this browser"** banner on attached tabs. That is by design and is never hidden. Pressing **Cancel** on it detaches the debugger and switches actions and script off.
- The debugger only attaches to tabs that are **shared and on an allowlisted site**, and detaches on unshare, tab close, leaving the site, five idle minutes, and when the actions window ends (for tabs used for actions). Tick **Keep the debugger attached until I detach it** in the popup to remove the idle timeout. With **Keep actions on until I switch them off** there is no actions window either. Alt+Shift+K detaches everything.
- Every CDP method goes through one allowlist in `extension/cdp.js` (`ALLOWED_METHODS`). Cookies, storage, request or response headers and bodies, and fetch interception are never reachable. Network tracking keeps only method, origin and path (no query string), status, type and size.
- Typing and keys are refused when a password, payment, one-time-code or file field has focus. Paste is refused. Only select all, copy, cut, undo and redo are allowed with Ctrl or Cmd.
- `input_type` reads the control back and fails if the content is not what it should be. A control it cannot read (for example some code editors) is reported as `verified: false`, never as success.
- **`page_eval` runs JavaScript in the page.** It is off by default and needs three things: the popup's **Allow script** (5 minutes, or until you switch it off if you tick **Keep script on until I switch it off**), **Allow actions**, and **Allow script on this site** for that origin. Cookie, storage and network APIs are refused by a text check. That check is a speed bump, not a sandbox, and a determined script can get around it. The toggles, the per-site list, the expiry and the activity log (first 120 characters of the expression) are the real controls.
- Images and the accessibility tree come from web pages, so they are returned as untrusted data with a note.
- `DSH_BRIDGE_IMAGE_MODE=file` saves screenshots to `~/.dsh-chrome-bridge/shots/` and returns the path, for MCP clients that drop images.
- Screenshots use CSS-pixel coordinates: the result states the scale and origin. To click image point (ix, iy) use `x = ix / scale + origin x`.

The page lane stays as it was. Use `page_snapshot` for text, `page_read` for app UIs, `input_*` when `page_click`/`page_type` are not enough.

## Tools

| Tool | Needs "Allow actions" | What it does |
|---|---|---|
| `tabs_list` | no | Shared tabs, plus whether actions are on |
| `page_snapshot` | no | Title, URL, visible text (capped), numbered interactive elements, scrollable panels. `maxElements` (default 150, max 400) |
| `page_links` | no | Visible links as `text → URL`, deduplicated. `contains`, `maxItems` (default 100, max 500), `stripQuery` |
| `page_wait_for` | no | Wait until text appears (case-insensitive), `timeoutMs` default 10000, max 20000 |
| `page_back` | yes | One step back in the tab's history; refs are lost |
| `page_screenshot` | no | Debugger build. Image of the tab, with size and scale |
| `page_read` | no | Debugger build. Accessibility tree with `ax` refs, optional subtree and frame |
| `page_console`, `page_network` | no | Debugger build. Console messages; request summaries without headers, bodies or queries |
| `input_click`, `input_key`, `input_type`, `input_scroll` | yes | Debugger build. Real mouse and keyboard input; `input_type` verifies the result |
| `page_eval` | yes, plus "Allow script" | Debugger build. JavaScript in the page; per-site opt-in |
| `page_batch` | per step | Debugger build. Up to 10 click/type/key/scroll/wait/screenshot/read steps in one call |
| `page_open` | no | Open an https URL on an allowed site in a background tab, shared automatically |
| `page_close` | no | Close a tab that `page_open` created (refuses any other) |
| `page_navigate` | yes | Go to an http(s) URL in a shared tab |
| `page_click` | yes | Click an element by ref |
| `page_type` | yes | Type into a field by ref, optional submit |
| `page_scroll` | yes | Scroll up, down, top or bottom. With `ref` of a `scrollable` element (or anything inside it) it scrolls that panel |

Refs (like `e12`) are only valid until the next `page_snapshot`, and are lost when the page reloads or navigates.

## Safety design

- Only tabs you share are visible. Nothing else, including other tabs, history, cookies, saved passwords and downloads, is reachable. The manifest does not request those permissions.
- Site access is per site, granted through Chrome's own prompt, and removed when you stop sharing (allowed sites keep it until you remove them).
- At most 120 commands per minute per connection (`DSH_BRIDGE_RATE_LIMIT`).
- Actions are off by default and expire after 10 minutes, unless you tick "Keep actions on until I switch them off" in the popup.
- The extension refuses to type into password fields, payment fields (`cc-*`), one-time-code fields, and file pickers, and refuses `javascript:` links. Password field values never appear in snapshots.
- Navigation is limited to http and https.
- The server listens on 127.0.0.1 only, rejects connections whose Origin is not a browser extension (so web pages cannot connect), and requires the token from a file only you can read.
- Everything the pages return is wrapped in `<untrusted_web_content>` with a reminder that it is data, not instructions. This lowers prompt-injection risk, it does not remove it. A small local model can still be tricked by hostile page text, so keep "Allow actions" off unless you are watching.
- Anything running as you on this Mac can read the token file, so this does not defend against malware already on your machine.

## What was tested

- `npm test` runs 130 tests: the MCP server end to end against a mock extension (auth, origin rejection, timeouts, tag-escaping), the page functions in jsdom, and the extension's permission gating against a fake Chrome API.
- **Not tested:** the extension inside real Chrome (popup rendering, Chrome's permission prompt, service-worker keepalive), and DSH itself. Expect small fixes on first run.

## Troubleshooting

- **Status stays `disconnected`:** open `chrome://extensions`, click the extension's **service worker** link, and read the console. Check that the port in the popup matches `DSH_BRIDGE_PORT` (default 17373) and that DSH has started the server (tools visible).
- **`rejected: check the token`:** re-run `node index.js --print-token` and paste it again.
- **Port in use:** set `DSH_BRIDGE_PORT` in the DSH config's `env` and change the port in the popup.
- **Extension won't load or is greyed out:** an employer-managed Chrome can block developer-mode extensions.
- **`no access to this tab`:** click **Share this tab** again on that tab. Navigating to a new site needs a new approval.
- **Pages with iframes:** only the main frame is read. Open shadow roots are read.
- **Infinite lists:** `page_snapshot`, find the `scrollable` panel, `page_scroll` with its `ref`, then `page_snapshot` again.
- **Debugging the server:** set `DSH_BRIDGE_DEBUG=1` in the DSH config's `env`. It logs tool name, tab id, duration and result size to stderr, never page content.

## Packaging

`cd server && npm run pack` writes `dist/dsh-chrome-bridge-<version>.zip` and `dist/dsh-chrome-bridge-<version>-debugger.zip`, both without `node_modules`. It needs the `zip` command.

## Not included yet

Screenshots, iframe content, file uploads, multi-tab workflows beyond one share per tab, and any Chrome Web Store packaging.
