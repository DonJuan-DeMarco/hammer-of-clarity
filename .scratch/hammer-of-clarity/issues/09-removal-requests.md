# 09 — Removal requests

**Blocked by:** 07
**Spec:** §4 (`RemovalRequest`), §7.2, §7.3 (what resets), §7.8 · **Decisions:** D9, D11, D21, D23, D32, D33

## What to build

- `core/removal.ts`: the state machine in SPEC §7.2 — cooling → confirmable → confirmed / expired, cancel from either live state. One open request per target.
- Cooldowns (fixed, D33): 24h for a personal block, a site exception, or a whole `social`/`short-video` category; 7 days for a whole `adult`/`gambling` category. Confirm window 24h after `readyAt`.
- `confirmText`: the reason for that block/category, else *"I am choosing to remove this wall, and I accept what comes with it."*
- Matching: trimmed, whitespace runs collapsed, case-sensitive. Paste blocked in the input.
- Effects on confirm (table in §7.2):
  - personal block → removed, `personal` resets;
  - `social`/`short-video` site → exception added, category resets;
  - `adult`/`gambling` site → exception added, **no reset** (D32);
  - whole category → disabled.
- `expire` evaluated lazily on read and by an hourly alarm.
- Settings: "Request removal" on categories, sites inside categories, personal blocks. A requests section with countdown, **Cancel**, and the confirm field once ready. The popup shows a count of open requests.
- The block stays fully active until confirmed.

## Acceptance

- [x] Vitest with a fake clock: every transition; confirm before `readyAt` refused; confirm after `expiresAt` refused; wrong text refused; second request for same target returns the first; each effect row above.
- [x] Removing a personal block end to end: request → wait (fake time in e2e or shortened via test hook) → retype → site reachable.
- [x] Pasting into the confirm field does nothing.

## Out of scope

Graduation's cooldown skip (ticket 11).

## Result (done)

- `src/core/removal.ts`: status from time (`cooling` → `confirmable` → `expired`), `resolveTarget` (only things currently blocked; exception domains normalized; curated exceptions must be list entries), cooldowns, confirm text, `applyRemoval` (SPEC §7.2 table), and `resetCategory` (start of Forging, graduation cleared), ready for ticket 10.
- Reducer: `requestRemoval` (a second request for the same target returns the first), `cancelRemoval`, `confirmRemoval`, `expireRemovals`. Every command first drops expired requests, so they vanish lazily; an hourly `chrome.alarms` alarm tidies up when nothing else happens (new `alarms` permission).
- If the target disappeared while a request waited (e.g. the category was turned off another way), confirming drops the request instead of applying it.
- The fixed sentence comes from i18n and is passed in with the request, so it's stored in the user's language.
- Removing the last personal block turns `personal` off; otherwise removing one resets it.
- **Settings:** "Removal requests" section at the top; "Ask to turn off" on each category; a "Sites" list inside curated categories with per-site "Request removal"; a "Your sites" section for personal blocks. Once asked, the button becomes "Removal requested". Paste and drop are refused in the retype field; autocomplete and spellcheck are off.
- **Deviation:** instead of a ticking countdown, a request shows "Ready from <day, time>" and "Confirm before <day, time>". It's the same information without a clock to watch. The popup says "A removal request is waiting in settings." rather than a count, keeping the popup free of numbers.
- Tests: 70 unit, 15 e2e. The e2e tests make the cooldown "pass" by moving the stored request's times back; there's no time hook in the shipped code.
