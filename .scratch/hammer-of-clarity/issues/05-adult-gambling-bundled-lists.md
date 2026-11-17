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

- [ ] Vitest: parser handles every format above plus junk lines; keyword regex blocks `freeporn.example` but not `google.com/search?q=porn+addiction+help`.
- [ ] Enabling `gambling` blocks a domain from the HaGeZi list.
- [ ] Enabling `adult` blocks a domain near the end of the OISD list and a keyword-only domain.
- [ ] If ticket 02 recorded a fallback, it's what's built.

## Out of scope

Weekly refresh (ticket 06), exception requests (ticket 09).
