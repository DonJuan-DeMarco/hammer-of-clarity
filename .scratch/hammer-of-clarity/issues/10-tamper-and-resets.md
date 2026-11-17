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

- [ ] Vitest: `resetAll` resets every enabled category and only those; incognito transition table.
- [ ] Manual: disable then re-enable the extension → every stage is back to Forging and the message shows once.
- [ ] Manual: turn incognito access off → badge turns red, stages reset; turning it back on clears the badge without another reset.
- [ ] Browser restart does **not** reset anything.

## Out of scope

Anything on uninstall (D18).
