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

- [ ] Vitest: 65 vs 66 days, 179 vs 180 days, 2 vs 3 attempts, attempts older than 30 days ignored; graduated request has no cooldown but still needs the text; reset clears graduation.
- [ ] Announcement shows once.

## Out of scope

Offering to lift the block (rejected in grilling, D19).
