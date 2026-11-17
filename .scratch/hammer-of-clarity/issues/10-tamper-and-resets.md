# 10 — Tamper detection and gentle resets

**Blocked by:** 08, 09
**Spec:** §7.3 (reset message), §7.5 · **Decisions:** D1, D9, D10, D13, D14

## What to build

- `core/tamper.ts`: `resetAll(state, now)` — every enabled category's `stageStartedAt = now`, graduation cleared, a pending reset message flagged.
- `adapters/lifecycle.ts`:
  - `runtime.onExtensionLoaded` with `reason === 'enable'` → `resetAll`.
  - On every service-worker start and popup open: `chrome.extension.isAllowedIncognitoAccess()`.
    - on → off: `resetAll`, `incognitoWasAllowed = false`, red badge.
    - still off: red badge; popup shows a button opening `chrome://extensions/?id=<id>`.
    - off → on: clear badge.
- **Reset message** on next popup open or block page: calm, no numbers, never mentions what was lost, shows the reason and a redirect. Shown once. Example: *"You're starting fresh. A slip doesn't undo what you've learned. Here's why you started: …"*
- Single-category resets from ticket 09 also set the pending message for that category.

## Acceptance

- [x] Vitest: `resetAll` resets every enabled category and only those; incognito transition table.
- [x] Manual: disable then re-enable the extension → every stage is back to Forging and the message shows once.
- [ ] Manual: turn incognito access off → badge turns red, stages reset; turning it back on clears the badge without another reset.
- [x] Browser restart does **not** reset anything.

## Out of scope

Anything on uninstall (D18).

## Result (done, with two manual checks open)

- `src/core/tamper.ts`: `resetAll` (every enabled category back to Forging via `resetCategory`, graduation cleared, notice flagged), `applyIncognitoStatus` (only on → off is tamper; never-allowed is just unfinished setup), `acknowledgeResets`, `pendingResets`.
- New optional field `CategoryState.resetNoticePending`. `resetCategory` (ticket 09) sets it too, so single-category resets get the same gentle message.
- Reducer: `tamper`, `incognitoStatus { allowed }`, `acknowledgeResets`.
- `src/adapters/lifecycle.ts`: `onReEnabled` (`runtime.onExtensionLoaded`, reason `enable`), `isIncognitoAllowed`, `openIncognitoSetting` (opens `chrome://extensions/?id=…`), `setIncognitoWarning` (red `!` badge).
- Background: registers `onReEnabled` first thing, checks incognito access on every worker start, and `syncBrowser` now sets the badge from `incognitoWasAllowed` along with the rules.
- Popup: checks incognito on open *before* deciding on the reset message (so a reset caused by that check shows immediately); shows the incognito warning with **Open the setting**, and the reset message (heading, "A slip does not undo what you have learned.", the reason, a redirect). Block page shows a short form (it already shows reason and redirect). Shown once: the first place that shows it acknowledges it; the text is captured on first render so acknowledging doesn't hide it mid-read.
- Tests: 80 unit, 19 e2e. The e2e tests flip the real **enable** switch on `chrome://extensions`: re-enabling resets every wall and the message appears once (block page or popup, whichever comes first). A browser restart doesn't reset.

**Manual checks still needed (can't be automated here):**
1. **Incognito on → off → reset.** With a command-line-loaded extension, Chromium unloads it when the incognito switch is flipped and doesn't bring it back, so Playwright can't drive this. Unit tests cover the transition logic.
2. **Turning incognito access *on* must not count as tamper.** Chrome reloads the extension when that switch changes. If it reports that reload as `enable` rather than `reload`, doing the right thing would reset every wall. Load the extension unpacked in real Chrome, block a site, turn incognito access on, and check the popup shows no reset message. If it does, the fix is to ignore an `enable` that arrives together with a newly allowed incognito access.
