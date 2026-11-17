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

- [ ] Vitest: sanity-floor logic; switching refresh off produces the static-only rule plan.
- [ ] Manually triggering the alarm installs a fresh list; a blocked domain still redirects afterwards.
- [ ] With network off, the refresh fails silently and blocking keeps working.

## Out of scope

Refresh more often than weekly; custom list URLs.
