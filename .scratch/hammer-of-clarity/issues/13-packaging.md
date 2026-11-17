# 13 — Packaging: icons, license, store readiness

**Blocked by:** 01
**Spec:** §6.4, §8 · **Decisions:** D3, D20, D30, D33

## What to build

- **Icons (D30):**
  - 128 px: the full emblem (`C:\Users\Vlad\Pictures\hammer-of-clarity\hammer_of_clarity_holy_emblem.svg`).
  - 16 / 32 / 48 px: hammer head + blue gem only, no rays or sparkles, tuned to read at 16 px.
  - Compare against the user's second icon idea once it's provided.
- **License:** `LICENSE` (GPLv3). `NOTICE` and an in-extension credits page attributing OISD and HaGeZi with their licenses and source URLs.
- **Manifest check:** permissions are exactly what's used (finding from ticket 01 decides `<all_urls>`); `minimum_chrome_version: "157"`.
- **Store prep (draft only, not submitted):** privacy statement ("no data leaves your device except downloading public block lists"), permission justifications, short description.
- `pnpm build` produces a zip ready to load or upload.

## Acceptance

- [ ] Toolbar icon is legible at 16 px on light and dark toolbars.
- [ ] Credits page reachable from settings.
- [ ] Built zip loads unpacked with no manifest warnings.

## Out of scope

Actually publishing; uninstall page.
