# 05 — Adult and gambling categories (bundled lists)

**Blocked by:** 02, 04
**Spec:** §6.1, §6.2 (bundled snapshot), §7.1 · **Decisions:** D5, D6, D15, D20, D32

## What to build

- `core/lists.ts`: production parser. Accepts plain domains, `*.domain`, hosts lines (`0.0.0.0 domain`), `||domain^`; strips comments; lowercases; punycode; dedupes.
- Build script (WXT hook or `scripts/`): fetches OISD NSFW and HaGeZi Gambling medium, parses, writes static rulesets (shape decided by the ticket 02 spike — one rule or N). Fetched list text is not committed; generated rulesets are build output.
- Keyword rules for `adult` only, matching the **hostname** only: `^https?://[^/]*(porn|xxx|hentai)` → redirect `?c=adult`.
- `adapters/dnr.ts`: enable/disable static rulesets via `updateEnabledRulesets` when the category is enabled.
- Settings: `adult` and `gambling` cards become enable-able (one click, optional reason).
- Exceptions inside these categories use the same allow-rule mechanism as ticket 04.

## Acceptance

- [x] Vitest: parser handles every format above plus junk lines; keyword regex blocks `freeporn.example` but not `google.com/search?q=porn+addiction+help`.
- [x] Enabling `gambling` blocks a domain from the HaGeZi list.
- [x] Enabling `adult` blocks a domain near the end of the OISD list and a keyword-only domain.
- [x] If ticket 02 recorded a fallback, it's what's built.

## Out of scope

Weekly refresh (ticket 06), exception requests (ticket 09).

## Result (done)

- `src/core/lists.ts`: `parseDomainList` (plain, `*.domain`, hosts lines, `||domain^$opts`, `#`/`!` comments, inline comments, CRLF; lowercase, punycode, dedupe) and `listDomain` (rejects IPs and bad labels). Unlike `normalizeDomain` it keeps `www.`, so a list naming `www.x` doesn't block all of `x`.
- Build: a WXT `build:publicAssets` hook in `wxt.config.ts` calls `scripts/lists.ts`, which downloads both lists (cached in `.cache/lists/`, git-ignored; falls back to the cache if offline; refuses to build below a sanity floor) and emits `rulesets/adult.json` (492,753 domains, 9.7 MB) and `rulesets/gambling.json` (98,273 domains, 2.0 MB), each one rule. Declared in the manifest, off by default.
- `enabledRulesets(state)` + `setEnabledRulesets` switch them with the category, inside `syncBrowser`.
- Adult keyword rule: `^https?://[^/]*(porn|xxx|hentai)`, hostname only, as a dynamic `regexFilter` rule while adult is on.
- **Priorities** (`PRIORITY` in `rules.ts`): gambling 1, gambling exception 2, adult 3, adult exception 4, curated 5, personal 6. An exception is an `allow` just above its own list, so it can't cancel a hand-picked category or a personal block. (Side effect: an adult exception also lets through that domain if it's on the gambling list. Acceptable for false-positive fixes.)
- `enableCategory` now accepts adult and gambling (no checklist; any `excluded` is ignored). Only `personal` is refused.
- **Settings:** adult and gambling cards turn on with an optional reason. Once on, "A site blocked by mistake?" lets the user ask to let a domain through: a normal removal request (24 h + retype) that never resets the category (D32), and the card lists what's been let through.
- Tests: 102 unit, 23 e2e. Every e2e request in the adult/gambling tests gets a placeholder page, so no real adult or gambling site can ever load; blocked URLs still reach the block page because the extension's redirect runs first. List domains for the tests are read from the built rulesets.
- Test fix: e2e "time travel" edits to storage could be overwritten by the block page's own save (the visit log) landing a moment later. `finishCooldowns` (now shared in `fixtures.ts`) re-applies the edit until it sticks. Not an extension bug: users don't edit storage.
- Memory use with both lists on wasn't measured (noted in ticket 02).
