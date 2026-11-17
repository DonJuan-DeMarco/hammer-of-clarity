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

- [x] Vitest with a fake clock: day 20 → forging, day 21 → tempering, day 65 → tempering, day 66 → clear.
- [x] Grep/test: no UI component renders a day count.

## Out of scope

Resets (tickets 09, 10), graduation (11).

## Result (done)

- `src/core/stages.ts`: `stageFor(category, now)` → `forging` | `tempering` | `clear`, or `null` when the category is off or never started. Days are whole days since `stageStartedAt`; a clock set before the start counts as day 0.
- `src/ui/StageBadge.tsx`: the stage name plus three marks (◆◆◇), no numbers. Shown on the block page (for the blocking category, `personal` for `?b=`), on enabled settings cards, and in a new "Your walls" list in the popup.
- `src/ui/useAppState.ts` (moved out of settings) keeps popup, settings and block page in step with storage.
- Guard test `src/ui/noDayCounts.test.ts`: UI files may not mention `stageStartedAt`, `DAY_MS` or `graduatedAt`, and no message string may contain a day count. This enforces "progress only as a stage name" structurally.
- Tests: 43 unit, 8 e2e (the popup test also asserts the popup has no digits at all).
