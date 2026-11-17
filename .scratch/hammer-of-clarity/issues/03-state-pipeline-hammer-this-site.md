# 03 — State pipeline + "Hammer this site"

**Blocked by:** 01
**Spec:** §4, §5, §6.1 (personal blocks), §7.1, §7.7 (reason only) · **Decisions:** D6, D12, D25, D31

## What to build

The real state pipeline, proven with the first feature: blocking the site you're on.

- `core/` types from SPEC §4 (`State`, `Block`, `CategoryState` etc.). Only the fields this ticket uses need behaviour; the rest can be typed and defaulted.
- `core/reducer.ts`: `(state, command, now) → state`. Commands for this ticket: `addBlock { domain, pathPrefix?, reason? }`.
  - Normalizes domain (lowercase, punycode, strip `www.`).
  - Refuses duplicates and returns a "already blocked" result.
- `core/rules.ts`: one redirect rule per personal block, `urlFilter: "||domain/path"`, → `/block.html?b=<id>`. Replace the hard-coded rule from 01.
- `adapters/storage.ts`: load/save `State` under one versioned key in `chrome.storage.local`.
- Background: `command → reducer → save → buildRules → dnr`. The only path for change.
- **Popup:** "Hammer this site" for the active tab (`activeTab`). Toggle to narrow to current path. Optional one-line reason with **Skip**. After blocking, the tab reloads into the block page.
- **Context menu** on links: "Block this site" — adds the link's domain, no reason prompt.
- **Block page:** shows the block's reason, else "You chose to keep this out."
- Blocks belong to the `personal` category (D31).

## Acceptance

- [ ] Vitest: reducer adds, normalizes, rejects duplicates; rules builder emits correct `urlFilter` for domain and domain+path.
- [ ] Blocking `youtube.com/shorts` blocks Shorts but not `youtube.com/watch?...`.
- [ ] State survives a browser restart.
- [ ] Playwright: open a page, click "Hammer this site", land on the block page with the typed reason.

## Out of scope

Removing blocks (ticket 09), stages, redirects, styling beyond legible.
