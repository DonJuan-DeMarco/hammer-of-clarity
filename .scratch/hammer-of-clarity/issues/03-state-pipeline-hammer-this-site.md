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

- [x] Vitest: reducer adds, normalizes, rejects duplicates; rules builder emits correct `urlFilter` for domain and domain+path.
- [x] Blocking `youtube.com/shorts` blocks Shorts but not `youtube.com/watch?...`. (Checked with the same shape on `example.com/only-this` vs `example.com/` in e2e, plus the `urlFilter` unit test; YouTube itself wasn't loaded.)
- [x] State survives a browser restart.
- [x] Playwright: open a page, click "Hammer this site", land on the block page with the typed reason.

## Out of scope

Removing blocks (ticket 09), stages, redirects, styling beyond legible.

## Result (done)

- `src/core/`: `types.ts` (SPEC §4 shapes), `state.ts` (`initialState`), `domain.ts` (`normalizeDomain`, `targetFromUrl`), `reducer.ts` (`addBlock`), `rules.ts`. 16 unit tests.
- Pipeline: UI sends `{ type: 'command' }` → background queues commands one at a time → `reduce` → `saveState` → `buildRules` → `replaceDynamicRules`. Rules are also re-synced from state on install and browser startup.
- Whole-domain rules use `||domain^`, so `a.com` doesn't match `a.community`. Path rules use `||domain/path` (prefix match, so `/shorts` also matches `/shortsale`; acceptable for v1).
- A path block is refused when a whole-domain block already covers it; a whole-domain block next to an existing path block is allowed.
- **Popup:** one view: domain, "Only block /path" checkbox (only when the page has a path), optional reason field, **Hammer this site**. Leaving the reason empty is the "Skip": no separate button, so blocking stays one click.
- The popup accepts `?tabId=` so Playwright can aim it at a tab; a real toolbar popup can't be opened from tests. With `<all_urls>` the popup can read that tab's URL.
- Permissions now: `declarativeNetRequest`, `storage`, `contextMenus`, `activeTab`, host `<all_urls>`.
- e2e (4 tests): block with reason, path-only block leaves the root open, duplicate refused, block survives a browser restart.
- **Not tested end to end:** the right-click "Block this site" menu (Playwright can't drive native context menus). Its handler is three lines on top of the tested reducer; check it by hand.
