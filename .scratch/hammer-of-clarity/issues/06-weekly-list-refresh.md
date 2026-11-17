# 06 — Weekly list refresh

**Blocked by:** 05
**Spec:** §6.2 (weekly refresh, refresh off) · **Decisions:** D16, D33

## What to build

- `adapters/lists.ts`: weekly `chrome.alarms` alarm. For each enabled list category: fetch plain text → `core/lists.ts` parse → install as dynamic rule(s) → disable that category's static ruleset.
- Host permissions: `nsfw.oisd.nl`, `raw.githubusercontent.com` only.
- On any failure (network, parse, too few domains, install error): keep what's installed, try again next week. A sanity floor (e.g. refuse a list with < 50% of the previous count) avoids installing a truncated download.
- Only plain domain text is fetched. Nothing is eval'd. No user data is sent.
- Settings: refresh toggle (instant, D33), "last refreshed" date. Turning it off removes dynamic list rules and re-enables static rulesets.
- `ListMeta` in state.

## Acceptance

- [x] Vitest: sanity-floor logic; switching refresh off produces the static-only rule plan.
- [x] Manually triggering the alarm installs a fresh list; a blocked domain still redirects afterwards.
- [x] With network off, the refresh fails silently and blocking keeps working.

## Out of scope

Refresh more often than weekly; custom list URLs.

## Result (done)

- `src/core/refresh.ts`: `LIST_SOURCES` (now shared with the build script), `LIST_RULE_IDS` (1,000,001 / 1,000,002, far above state rule ids), `acceptRefreshedList` (category floor, and at least half of what's installed), `listRulePlan` (per enabled list category: downloaded dynamic rule if installed and refresh is on, otherwise the bundled static ruleset), `recordRefreshedList`, `setListRefresh`, `forgetInstalledList`.
- `ListMeta.installed` records which downloaded lists are in place (domain count and time). Turning refresh off, or turning a list category off, forgets it, so turning back on always starts from the bundled list, never from a rule that's already been removed.
- Reducer: `listRefreshed`, `setListRefresh`.
- Background: weekly `refresh-lists` alarm (first run one minute after install). Downloads happen outside the command queue so a slow site never holds up a click; installing happens inside it after re-checking the category and the setting. Failures are logged and leave everything as it was.
- `src/adapters/dnr.ts`: `applyRules` replaces state rules and drops unplanned list rules in **one** `updateDynamicRules` call, without reading dynamic rules back (which would copy ~10 MB each time), and only touches static rulesets when they differ. `installListRule` swaps a list in one call, so there's no gap.
- No new permissions: `<all_urls>` already covers the two list hosts.
- Settings: "Block lists" section with the refresh switch (instant both ways, D33) and "Last updated <time>." / "Using the lists that came with the extension."
- Tests: 112 unit, 25 e2e. Playwright serves a fake 100,001-domain list to the background's download (it intercepts service-worker requests), so the real list is never fetched in tests. Checked: the download replaces the bundled list; switching refresh off goes straight back; an offline download changes nothing.
- Test fix: the redirect test clicked Remove three times faster than the page redrew; it now waits between clicks.
