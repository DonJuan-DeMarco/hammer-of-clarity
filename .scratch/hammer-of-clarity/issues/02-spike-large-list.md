# 02 — Spike: install a ~493k-domain list as one rule

**Blocked by:** 01
**Spec:** §6.1, §6.2, §10 risk 1 · **Decisions:** D16, D17, D20

## Question to answer

Can the extension hold the OISD NSFW list (~493k domains) as DNR rules, both ways it will need to?

1. **Static:** a ruleset JSON generated at build time with one rule whose `requestDomains` has every domain.
2. **Dynamic:** the same rule installed at runtime with `updateDynamicRules`.

The research found no documented limit on `requestDomains` length, but a ~10–20 MB single `updateDynamicRules` call is untested.

## What to do

- Download `https://nsfw.oisd.nl/domainswild2` once (don't commit it if it's large; a script that fetches it is enough).
- Write the minimal parser needed (strip comments, lowercase). The real parser is ticket 05.
- Try static, then dynamic. Measure: install time, service-worker memory, whether redirects still work for a domain near the end of the list.
- If dynamic fails: try splitting into N rules (e.g. 10 × 50k). If that also fails: try HaGeZi NSFW (~84k) and record that the fallback is needed.

## Acceptance

- [x] Written result appended to this file: what worked, sizes, timings, any error messages.
- [x] SPEC §6.2 and §10 updated with the outcome (and D20 in CONTEXT.md if the fallback becomes the default).
- [x] Spike code kept on a `prototype/large-list` branch, not merged.

## Out of scope

Production parser, refresh alarm, UI.

## Result (done, 2026-11-17)

**It works, both ways, as a single rule.** No fallback needed: OISD NSFW stays the adult source (D20).

Measured in Playwright's Chromium 159 on the author's Windows machine, OISD NSFW `domainswild2` version 202611170906: 492,757 domains + 1 synthetic test domain, no non-ASCII entries.

| Mode | Size | Install time | Blocks last list domain | Blocks subdomain + path | Leaves unlisted site alone |
|---|---|---|---|---|---|
| Static ruleset, 1 rule | 9.69 MB JSON | 23 ms to enable (indexed at load) | ✓ | ✓ | ✓ |
| Dynamic, 1 rule | 8.7 MB text fetched → 1 rule | 704 ms `updateDynamicRules` | ✓ | ✓ | ✓ |
| Dynamic, 10 rules × ~49k | same | 579 ms | ✓ | ✓ | ✓ |
| Replace dynamic rule (remove + add in one call, the weekly refresh case) | same | 768 ms | — | — | — |

- Navigation to a listed domain lands on `block.html?c=adult` in ~130–165 ms.
- The whole static ruleset costs **1 rule** of the static budget: available static rules went 330,000 → 329,999.
- Matching checked with `testMatchOutcome` (needs `declarativeNetRequestFeedback`, spike only), so no adult site was ever loaded; the only real navigation was to `spike-test.example`.
- Not measured: service-worker / browser memory (`performance.memory` isn't available in the service worker). Worth a look in Chrome's task manager during ticket 05.

**For tickets 05 and 06:**
- One rule per list is fine. Splitting gains nothing worth the complexity.
- The build-time static ruleset is ~9.7 MB, which goes into the extension package. Should be fine; confirm against Chrome Web Store package limits in ticket 13.
- Refresh can swap the list in one `updateDynamicRules` call (~0.8 s). Not checked: whether blocking has a gap during those 0.8 s. If it matters, add the new rule under a new id first, then remove the old one.

Spike code: branch `prototype/large-list` (`scripts/spike/`, `tests/e2e/spike-large-list.spec.ts`, spike hooks in `src/entrypoints/background.ts`).
