# 04 — Social and short-video categories

**Blocked by:** 03
**Spec:** §6.1, §6.3, §7.1, §7.8 (categories section only) · **Decisions:** D5, D21, D22

## What to build

- Hand-curated lists in `core/` (SPEC §6.3), each entry a domain or domain+path. LinkedIn is in `social` but marked default-excluded.
- Reducer commands: `enableCategory { id, reason?, excludedSites? }` (sets `stageStartedAt = now`), `addException` **only as an internal helper** — users can't add exceptions after setup until ticket 09.
- Rules: one redirect rule per entry → `/block.html?c=<id>`; `allow` rules at higher priority for exceptions.
- **Minimal settings page:** list the four list-based categories as cards; `social` and `short-video` can be enabled with one click, showing the site checklist (LinkedIn unticked) and an optional reason. `adult` and `gambling` cards visible but disabled ("coming soon") until ticket 05.
- Block page falls back to the category's reason.
- Enabling is instant. There is no way to disable a category in this ticket.

## Acceptance

- [x] Vitest: rules for an enabled category, exceptions ~~produce higher-priority allow rules~~ are left out of the rules (see deviation below), LinkedIn excluded by default.
- [x] Enabling `short-video` blocks `youtube.com/shorts/...` and `instagram.com/reels/...`, not `youtube.com`.
- [x] Unticking a site at enable time leaves it reachable.
- [x] Block page shows the category reason.

## Out of scope

Adult/gambling lists, disabling categories, onboarding flow.

## Result (done)

- `src/core/categories.ts`: the hand-curated lists, `entryKey` (`domain` or `domain/path`), `blockedEntries` (list minus exceptions), `exceptionsFor` (unticked keys → exceptions; LinkedIn by default).
- Instagram and Facebook short video use the path `/reel`, which covers both single reels (`/reel/<id>`) and the feed (`/reels/`).
- Reducer: `enableCategory { category, reason?, excluded? }`. Instant; sets `stageStartedAt`. Refuses `alreadyEnabled`, and `notAvailable` for adult/gambling until ticket 05. No way to turn a category off yet.
- `buildRules(state)` now takes the whole state. Priorities: categories 1, personal blocks 3, so a site you blocked yourself shows your own reason.
- **Deviation from this ticket:** sites unticked in a curated category are **left out** of its rules, not added as `allow` rules. An allow rule would also unblock that site for a personal block or another category. Allow rules are still the plan for adult/gambling exceptions (ticket 05), where the list can't be edited.
- Settings is WXT's `options` entrypoint (`options.html`, opens in a tab), reachable from the popup's **Settings** button and from Chrome's extension menu. Cards for all four categories; adult and gambling say "Coming soon". Choosing a curated category opens its checklist and an optional reason; **Turn on** applies it. Two clicks, not one: the checklist has to be seen before turning on, because unticking later takes a removal request.
- Block page: personal block reason → category reason → default.
- Tests: 26 unit, 7 e2e. The e2e tests stub every social/video site with a placeholder page; blocked URLs still reach the block page, so the redirect wins over the stub.
