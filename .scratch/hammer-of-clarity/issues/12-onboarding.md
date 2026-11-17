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

- [x] Playwright: complete onboarding with `adult` + `social` selected → both block. (Both block as soon as step 2 is done; the final Finish needs incognito, checked by hand.)
- [x] Can't pass step 4 with incognito off.
- [x] No category is selected unless clicked.

## Out of scope

Uninstall page (D18), languages other than English.

## Result (done; the final step needs a manual check)

- `src/entrypoints/onboarding/` (`onboarding.html`): Welcome → Categories → Redirects → Incognito → Done, with a row of dots instead of "step N of 5" (no numbers). Same calm palette as the block page.
- **Categories:** four large cards, none pre-selected (D22); one click picks a card. Social and short-video show their checklist (LinkedIn unticked); every picked card takes an optional reason. "Turn on and continue" applies them through the normal `enableCategory` command; with nothing picked the button reads "Skip for now". Already-on categories show "On" and can't be picked again. A note says turning them off later takes time.
- **Redirects:** the settings editor, moved to `src/ui/RedirectsEditor.tsx` and shared. Continue is disabled with none (can't happen: the last one can't be removed).
- **Incognito:** explains the side door, opens the setting, and re-checks on tab focus and every 2 s. **Finish setup** stays disabled until access is on.
- New reducer command `completeOnboarding`, which refuses with `incognitoRequired` until incognito access has been seen on; the gate is in the core, not just the button.
- Background opens setup on `onInstalled` with reason `install` (not on updates). The popup shows **Finish setup** until it's complete.
- Tests: 117 unit, 27 e2e. The e2e test walks setup from the tab the extension opens itself, picks adult + social, checks nothing was pre-selected, LinkedIn is unticked, the redirects step has the three defaults, Finish is locked with incognito off, both categories already block, and the popup offers Finish setup. "Choosing nothing" is covered too. `SCREENSHOT=<path>` captures the categories step.
- **Manual check:** finishing setup end to end needs incognito access switched on, which Playwright can't do here (see ticket 10). Load unpacked in real Chrome, allow incognito, and check the step unlocks and Done appears.
- Test fix: the list-refresh test now waits for the downloaded rule to come off after switching refresh off (it's removed just after the bundled list goes on, deliberately, so there's no gap).
