# 12 — Onboarding

**Blocked by:** 05, 08, 10
**Spec:** §7.6 · **Decisions:** D7, D13, D22

## What to build

A first-run page opened on install, reusing the category, redirect and incognito pieces already built:

1. **Welcome** — one sentence: easy to block, slow to unblock.
2. **Categories** — four large cards, none pre-selected. `social`/`short-video` show their site checklist (LinkedIn unticked). Optional reason per selected category. Choosing none is allowed.
3. **Redirects** — the three defaults pre-filled, editable; at least one required.
4. **Incognito** — explains why; button opens `chrome://extensions/?id=<id>`; re-checks on focus. **Next is disabled until access is on.**
5. **Done** — `onboardingComplete = true`.

- If the user closes the tab mid-way, the popup shows "Finish setup" until complete.
- Enabling categories here goes through the same reducer commands as settings.

## Acceptance

- [ ] Playwright: complete onboarding with `adult` + `social` selected → both block.
- [ ] Can't pass step 4 with incognito off.
- [ ] No category is selected unless clicked.

## Out of scope

Uninstall page (D18), languages other than English.
