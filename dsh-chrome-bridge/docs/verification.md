# Verification record (Milestone 0)

Written during the v0.2 implementation. Claude Code could not drive Ryan's real Chrome, so every real-Chrome item below is **not yet verified**. Tick them off by hand and record what you saw.

## Checked by automated tests (`cd server && npm test`, 75 tests)

Fake Chrome API, jsdom and a mock extension. These prove the logic, not Chrome's behaviour.

- Allowlist rules, `page_open` / `page_close`, cap, redirect handling, activity log, kill switch, pinned extension ID, rate limit, scroll refs, `page_links`, shadow DOM, snapshot limits.

## Section 7 items: what was done in code

| # | Item | Status |
|---|---|---|
| 1 | Popup permission flow needs a user gesture | Code changed: "Allow this site" calls `chrome.permissions.request` before any `await` (the active tab's origin is cached by `render()`), and the worker's `permissions.onAdded` listener finishes the allow if the popup closes during the prompt. Not verified in Chrome. "Share this tab" still awaits `activeTab()` first, as in v0.1 (Ryan reports it works) |
| 2 | Service worker lifetime (20 s ping, 30 s alarm) | Unchanged. Not verified |
| 3 | `ws://127.0.0.1` from the extension | Reported working in v0.1. Not re-verified |
| 4 | Origin header | Not recorded. Observed value to write here: `chrome-extension://________`. With the pinned key it must be `chrome-extension://fpahkekcpddpmobinggnphafjockjcea` |
| 5 | Snapshot on LinkedIn | Not run. Hypothesis (results list is its own scroll container) is addressed by `scrollable` elements and `page_scroll` with `ref`; confirm on the jobs page |
| 6 | Refs across navigation | Error text now says refs are lost on a new snapshot, reload or navigation. Single-page-app behaviour not verified |
| 7 | Actions on a harmless test page | Not run |
| 8 | After restart | Sharing and agent-tab state live in `chrome.storage.session`, which Chrome clears on restart. The allowlist is in `chrome.storage.local`. Whether Chrome keeps the host permissions after restart is not verified |
| 9 | Known gaps | Open shadow roots are now read. Main frame only, and `(no access)` in `tabs_list` are unchanged |

## Defects found by reading the v0.1 code

- `waitForLoad` could miss a `complete` event if the tab finished before the listener was added. Fixed: it now also checks the tab's status once after registering.
- "Stop sharing all" removed every Chrome permission. It now keeps permissions for allowlisted sites.
- Concurrent updates to the shared-tab list could overwrite each other. List updates are now serialized per storage key.

## Manual checklist (v0.2)

Install: reload the extension at `chrome://extensions` (the ID changes once, to the pinned one), set `DSH_BRIDGE_EXTENSION_ID` in the DSH config, restart DSH.

- [ ] Connect, restart DSH, auto-reconnect within about 30 s
- [ ] Share tab, read, stop sharing, confirm read now fails
- [ ] Actions off by default; tick; click works; expires after 10 min; badge is red while on
- [ ] Password field refused; `javascript:` link refused
- [ ] Allow this site: Chrome prompt appears once; site shows in the list; Remove works
- [ ] Allow this site on `accounts.google.com` and on an http site is refused
- [ ] `page_open` on an allowlisted site works with actions off; refused on another site
- [ ] A tab you opened yourself on an allowlisted site is not in `tabs_list`
- [ ] 6th `page_open` is refused; `page_close` refuses a tab you shared by hand
- [ ] Alt+Shift+K stops sharing, closes agent tabs, switches actions off
- [ ] Recent activity shows commands and contains no typed text
- [ ] After a Chrome restart: allowlist still listed, `page_open` still works (or note that Chrome dropped the permission)
- [ ] Wrong `DSH_BRIDGE_EXTENSION_ID` makes the extension show `disconnected` / rejected
- [ ] LinkedIn jobs page: snapshot lists a `scrollable` panel, `page_scroll` with its ref loads more cards, `page_links` with `contains: /jobs/view` returns job links

## Not done

- S7 real-browser end-to-end harness (investigation not started).
- Section 6, porting the `linkedin-job-search` skill (the skill text is not in this repo).

## v0.3 debugger lane: to verify in real Chrome (Milestone 4)

Built and tested against a fake `chrome.debugger` only (130 tests). Nothing below has run in Chrome.

Prerequisite from the v0.3 spec: finish the v0.2 checklist above first.

- [ ] Install-time permission warning for the debugger build: ____________
- [ ] Banner text and Cancel button; Cancel produces `canceled_by_user` and actions go off
- [ ] `debugger` as an optional permission is not possible (assumed; the build is separate). Confirm by trying it
- [ ] `page_screenshot` on a background (agent-opened, inactive) tab. If it hangs or is blank, open agent tabs active or activate before capture
- [ ] Screenshot size and scale on your display (retina): image width <= 1024 and the reported scale matches
- [ ] DSH's MCP client passes image blocks to the model; if not, use `DSH_BRIDGE_IMAGE_MODE=file`
- [ ] `Input.dispatchKeyEvent` with `commands` (select all) works through `chrome.debugger`
- [ ] DevTools open on the same tab gives the "another debugger" message
- [ ] `page_read` size and time on LinkedIn and on a large MakeCode project; adjust caps
- [ ] `Target.setAutoAttach` exposes the MakeCode simulator iframe (`https://trg-microbit.userpxt.io`, which must also be allowlisted)
- [ ] `DOM.getBoxModel` / `DOM.focus` work without `DOM.enable` (the code enables it once per session anyway)
- [ ] Clicking and typing inside a cross-origin iframe session land at the right place (coordinates are per frame)

Acceptance tasks (v0.3 spec section 6), record pass or fail:

| Task | Result |
|---|---|
| T1 Read the MakeCode Python without changing the project | |
| T2 Replace the JavaScript editor content, `verified: true`, no residue | |
| T3 Press the simulator's A button and describe the screenshot (3 of 5 runs) | |
| T4 LinkedIn results panel: scroll and read all cards, no Apply clicks | |
| T5 Read a cross-origin iframe on an allowlisted page; blocked on another | |
| T6 Refusals: password, paste, `page_eval` toggle off, response bodies | |

Known design choices to review:

- Tool names: the debugger lane's input tools are `input_click`, `input_key`, `input_type`, `input_scroll` (not `page_click` etc.), so they do not clash with the page lane.
- `page_eval` needs the script toggle **and** the actions tick (stricter than the spec's "independent").
- Monaco (MakeCode's editor) keeps text in its own model, so `input_type` usually reports `verified: false (cannot be read back)`. The spec's route for a verified editor update is `page_eval` with `monaco.editor.getModels()[0].setValue(...)` on an opted-in site.
- Not implemented: `page_drag`, `page_hover`, `page_zoom`, tab groups, the real-browser E2E harness.
