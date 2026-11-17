# Hammer of Clarity

A browser extension that blocks distracting or harmful sites. Blocking is easy; unblocking is deliberately slow. All logic runs on the user's machine — no backend.

## Glossary

- **Block** — one entry the user wants kept out: a domain (`reddit.com`) or a domain + path (`youtube.com/shorts`).
- **Category** — a prebuilt group of blocks the user toggles on in one click. v1: `adult`, `gambling`, `social`, `short-video`.
- **Keyword rule** — a URL substring match (e.g. `porn`). Exists only inside the `adult` category.
- **Reason** — the user's own words for why they blocked something. Shown back to them on the block page.
- **Redirect** — something to do instead (a link, or an instruction like "20 push-ups"). Offered as one button on the block page.
- **Block page** — what the user sees instead of a blocked site: their reason, a redirect, their stage.
- **Stage** — named progress, never a number: *Forging → Tempering → Clear*. Tracked per category.
- **Clear** — the final stage, reached after 66 uninterrupted days.
- **Reset** — the category's stage going back to the start.
- **Tamper** — the extension being disabled and then re-enabled, or incognito access being switched off. Cannot be prevented, only detected.
- **Removal request** — the slow path to remove a block or weaken a setting: cooldown, then confirmation.
- **Attempt** — the user hitting the block page. Never punished.

## Decisions

1. **Defence model: impulse, plus a tamper alarm.** The extension does not try to stop a determined user (impossible for an extension). It adds friction against impulses and detects being disabled after the fact.
2. **No visible numbers, ever.** Progress is shown only as named stages, so a count can't become an excuse ("I've earned one slip"). Clear at 66 days (median from Lally et al. 2009; the "21 days" figure is a myth).
3. **Built for personal use first, written to be published.** Minimal permissions, no user data leaves the machine.
4. **Chromium only, Chrome 157+** (`minimum_chrome_version`). Manifest V3. The code that does the actual blocking sits behind one module so Firefox can be added later.
5. **v1 categories:** adult, gambling, social, short-form video.
6. **Block granularity:** domain or domain + path. Keyword rules only within `adult`.
7. **Block page:** shows the user's reason (falling back to the category reason, then a default) and one redirect chosen at random from a single global list. Onboarding pre-fills sensible default redirects so the user can skip that step.
8. **Always-on list only in v1.** No schedules or focus timers. Data model leaves room to add schedules later.
9. **Progress per category.** Removing a block resets its category. Tamper resets every category. Attempts never reset anything.
10. **Resets are gentle.** Back to the start, no shame, never show what was lost. The message points to the reason and a redirect.
11. **Asymmetric friction.** Changes toward safety are instant. Changes away from safety (removing a block, weakening a setting) go through a removal request: block stays active → cooldown (24h for a site, 7 days for adult and gambling) → come back within 24h and retype the original reason → else the request expires. Cancellable in one click.
12. **One-click adding.** Toolbar "Hammer this site" (current domain, optionally narrowed to path) and a right-click menu on links. Reason is optional, with Skip.
13. **Incognito required.** Setup can't finish without incognito access; the toolbar badge is red while it's off; switching it off counts as tamper. Detected with `chrome.extension.isAllowedIncognitoAccess()`; the extension can only open its own settings page, not flip the toggle.
14. **Tamper detection:** `runtime.onExtensionLoaded` with `reason === "enable"` (Chrome 157+). No heartbeat fallback needed.
15. **Lists: GPLv3 sources (HaGeZi / OISD).** Bigger and updated more often than the MIT alternatives. Implies the extension itself is GPLv3.
16. **List freshness:** a snapshot is bundled; a weekly refresh downloads the plain list from GitHub into dynamic rules. On by default, with a setting to stay fully offline. Only plain domain text is fetched; rules are built inside the extension.
17. **Block page uses redirect rules.** These are "unsafe" in Chrome's terms, so store updates can't skip review — acceptable, because the runtime refresh carries list freshness. A whole list fits in one rule's `requestDomains`. Verified in ticket 02: the ~493k-domain OISD list installs as one rule, static or dynamic, in under a second.
18. **No uninstall page in v1.**
19. **Graduation removes the cooldown, never the block.** A category graduates when it has gone uninterrupted for 66 days (social, short-video) or 180 days (adult, gambling) **and** had fewer than 3 attempts in the last 30 days. A graduated category's removal requests skip the cooldown but still require the retype. Graduation is announced once ("Social has graduated: you're trusted here now"). A reset removes graduation. The block itself is never lifted automatically.
20. **Lists: OISD NSFW for adult, HaGeZi Gambling *medium* for gambling.** The extension is licensed GPLv3. If the ~493k-domain OISD rule fails to install at runtime, fall back to HaGeZi NSFW.
21. **Social and short-video lists are hand-curated.** Sites can be unticked freely during setup; LinkedIn is unticked by default. After setup, taking one site out is a removal request (24h).
22. **No category pre-selected** during setup. One click per category card.
23. **Retype fallback.** With no reason written, confirming a removal means retyping: *"I am choosing to remove this wall, and I accept what comes with it."*
24. **Popup and settings show:** categories with stage, removal requests in progress (countdown + cancel), redirects, the refresh setting, incognito status. No attempt or tamper history is ever shown; an internal 30-day attempt log exists only for graduation.
25. **Local storage only** (`chrome.storage.local`). No sync in v1.
26. **English only in v1**, all strings in `chrome.i18n` message files from the start.
27. **Stage boundaries:** Forging days 0–20, Tempering days 21–65, Clear from day 66. Day 21 is a milestone that feels good, not a scientific claim.
28. **System clock changes are accepted as a risk.** Moving the clock forward to skip a cooldown is deliberate, not an impulse (see decision 1).
29. **Stack:** WXT + TypeScript, Preact for popup/settings/block page, Vitest for logic, Playwright for a few end-to-end checks with the extension loaded. Domain logic (stages, removal requests, graduation, rule building) is plain TypeScript with no browser calls, so it is testable without a browser.
30. **Icons:** the 128 px store icon is the full emblem; 16/32/48 px toolbar icons are just the hammer head and blue gem, no rays. The incognito warning is Chrome's badge on top. The second icon idea is still to be compared.
31. **Hand-added blocks live in a fifth category, `personal`,** with its own stage and graduation at 66 days. Removing a personal block resets `personal`.
32. **Wrongly-blocked sites in `adult` / `gambling`:** an exception request with a 24h cooldown and the retype, and **no** reset. The list's mistake shouldn't cost the user progress.
33. **Cooldowns are fixed in v1** (not user-configurable), so only removals go through removal requests. Redirects (at least one must remain) and the list refresh toggle change instantly. `<all_urls>` host permission is accepted for redirect rules.
