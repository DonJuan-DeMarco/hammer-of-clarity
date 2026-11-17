# 11 — Graduation

**Blocked by:** 10
**Spec:** §7.4 · **Decisions:** D19, D31

## What to build

- `core/graduation.ts`: eligible when the category's stage has run uninterrupted for **66 days** (`social`, `short-video`, `personal`) or **180 days** (`adult`, `gambling`), **and** it has fewer than **3 attempts in the last 30 days**.
- Checked by a daily alarm and on popup open. On eligibility: `graduatedAt = now`.
- One-time announcement on next popup open: *"Social has graduated: you're trusted here now."* Then `graduationAnnounced = true`.
- `core/removal.ts`: requests targeting a graduated category (or a site/block in it) get `readyAt = createdAt`. The retype is still required.
- Any reset of the category clears graduation (already handled by ticket 10's `resetAll`; add it to single-category resets too).
- The block is never lifted automatically.

## Acceptance

- [x] Vitest: 65 vs 66 days, 179 vs 180 days, 2 vs 3 attempts, attempts older than 30 days ignored; graduated request has no cooldown but still needs the text; reset clears graduation.
- [x] Announcement shows once.

## Out of scope

Offering to lift the block (rejected in grilling, D19).

## Result (done)

- `src/core/graduation.ts`: `isEligible` (enabled, not yet graduated, 66 uninterrupted days for social/short-video/personal or 180 for adult/gambling, and fewer than 3 attempts in that category over the last 30 days), `graduateEligible`, `pendingGraduationAnnouncements`, `acknowledgeGraduations`, `isGraduated`. The 30-day attempt window constant moved here from the reducer.
- Reducer: `checkGraduation`, `acknowledgeGraduations`.
- `cooldownFor(state, target)`: zero for a graduated category, a site in it, or a personal block when `personal` has graduated. The retype is unchanged.
- Resets already cleared graduation (`resetCategory`); turning a category off clears it too.
- Checked by a daily `chrome.alarms` alarm and on every popup open (after the incognito check). The popup shows "<Category> has graduated: you are trusted here now." plus "Removing a wall here no longer has a waiting period. You will still type your reason." once.
- **Two fixes found by the new e2e test:**
  - Settings computed request status with a clock that only refreshed every 30 s, so a no-cooldown request looked like it was still waiting. `useNow` now reads the clock on every render.
  - The background saved state before swapping blocking rules, so a page could see "removed" while the old rule still blocked for a moment. It now applies rules first, then saves. (This was making the ticket 09 removal test flaky.)
- Tests: 93 unit, 20 e2e. The e2e test "ages" categories by moving their stored start back 70 days.
