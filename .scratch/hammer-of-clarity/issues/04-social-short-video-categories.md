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

- [ ] Vitest: rules for an enabled category, exceptions produce higher-priority allow rules, LinkedIn excluded by default.
- [ ] Enabling `short-video` blocks `youtube.com/shorts/...` and `instagram.com/reels/...`, not `youtube.com`.
- [ ] Unticking a site at enable time leaves it reachable.
- [ ] Block page shows the category reason.

## Out of scope

Adult/gambling lists, disabling categories, onboarding flow.
