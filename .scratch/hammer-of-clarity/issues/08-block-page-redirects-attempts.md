# 08 — Block page: reason, redirects, attempts

**Blocked by:** 07
**Spec:** §4 (`Redirect`, `Attempt`), §7.6 step 3 (defaults), §7.7, §7.8 (redirects) · **Decisions:** D7, D9, D14 (Q14), D24, D33

## What to build

- Redirects in state, seeded with three defaults on install:
  - *Take a 10-minute walk.*
  - *Drink a glass of water and do 20 push-ups.*
  - *Write down what you're feeling right now.*
- Settings: add / edit / remove redirects, instantly. At least one must remain. Each is a link or an instruction.
- **Block page, complete:** emblem, stage name, reason (block → category → default), one random redirect, **Go back**.
  - Link redirect: navigates the same tab.
  - Instruction redirect: shown as text with **Done**, which closes the tab.
- **Attempts:** each block-page load records `{ category, at }`. Pruned to 30 days on every write. Never displayed anywhere (D24).
- Design pass on the block page: calm, not scolding. Copy the emblem SVG into `assets/` (source path in ticket 13).

## Acceptance

- [ ] Vitest: attempt pruning; redirect removal refused when only one remains; random pick covers all redirects.
- [ ] Block page shows a redirect and the right reason for a personal block and a category block.
- [ ] No attempt count visible in any UI.

## Out of scope

Reset and graduation messages (tickets 10, 11).
