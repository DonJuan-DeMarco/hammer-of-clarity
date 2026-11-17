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

- [ ] Written result appended to this file: what worked, sizes, timings, any error messages.
- [ ] SPEC §6.2 and §10 updated with the outcome (and D20 in CONTEXT.md if the fallback becomes the default).
- [ ] Spike code kept on a `prototype/large-list` branch, not merged.

## Out of scope

Production parser, refresh alarm, UI.
