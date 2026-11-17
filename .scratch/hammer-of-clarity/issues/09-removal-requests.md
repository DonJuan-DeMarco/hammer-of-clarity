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

- [ ] Vitest with a fake clock: every transition; confirm before `readyAt` refused; confirm after `expiresAt` refused; wrong text refused; second request for same target returns the first; each effect row above.
- [ ] Removing a personal block end to end: request → wait (fake time in e2e or shortened via test hook) → retype → site reachable.
- [ ] Pasting into the confirm field does nothing.

## Out of scope

Graduation's cooldown skip (ticket 11).
