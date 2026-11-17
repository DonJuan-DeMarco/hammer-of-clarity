# 07 — Stages

**Blocked by:** 04
**Spec:** §3 (Stage), §7.3 (stageFor only) · **Decisions:** D2, D9, D27

## What to build

- `core/stages.ts`: `stageFor(category, now)` → `forging` (< 21 days) | `tempering` (< 66) | `clear`.
- Show the stage name (translated) in:
  - the popup, for each enabled category, including `personal` once it has a block;
  - the settings category cards;
  - the block page, for the category being blocked.
- **No numbers anywhere** — no days, no progress percentages. A simple three-step icon or bar is fine.
- `personal`'s `stageStartedAt` is set when its first block is added.

## Acceptance

- [ ] Vitest with a fake clock: day 20 → forging, day 21 → tempering, day 65 → tempering, day 66 → clear.
- [ ] Grep/test: no UI component renders a day count.

## Out of scope

Resets (tickets 09, 10), graduation (11).
