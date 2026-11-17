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

- [x] Vitest: attempt pruning; redirect removal refused when only one remains; random pick covers all redirects.
- [x] Block page shows a redirect and the right reason for a personal block and a category block.
- [x] No attempt count visible in any UI.

## Out of scope

Reset and graduation messages (tickets 10, 11).

## Result (done)

- `src/core/redirects.ts`: `pickRedirect` (random, injectable for tests) and `cleanRedirect` (trims; links must be `http(s)`, so a redirect can't be a `javascript:` URL).
- Reducer: `seedRedirects` (only into an empty list), `addRedirect`, `updateRedirect`, `removeRedirect` (refuses `lastRedirect`), `recordAttempt` (prunes to 30 days on every write, never touches stages).
- Defaults are seeded by the background on install from `chrome.i18n` strings, so they arrive in the user's language once translations exist. "What you're feeling" became "what you are feeling" to keep apostrophes out of the message file.
- **Block page:** emblem (`src/assets/emblem.svg`, copied as-is including its content-credentials metadata, 24 KB), "This one stays out.", stage, reason, an "Instead" card with one redirect, and a quiet **Go back**. Instruction → text + **Done**, which closes the tab. Link → opens in the same tab. Warm off-white / dark-mode palette taken from the emblem's gold. The redirect is picked once per visit so it doesn't change when storage updates.
- Each block-page load sends `recordAttempt` for its category (`personal` for `?b=`). The guard test now also forbids any UI file from reading `.attempts`.
- **Settings:** "Do this instead" section to add, edit (in place) and remove redirects, instruction or link. Removing the last one shows "Keep at least one."
- Tests: 52 unit, 12 e2e. `SCREENSHOT=<path> pnpm exec playwright test tests/e2e/block-page.spec.ts` saves a screenshot of the block page for design checks.
- Possible polish later: the emblem's SVG has wide empty margins, so the hammer looks smaller than its box.
