# 01 — Scaffold + tracer bullet: one site redirects to a block page

**Blocked by:** —
**Spec:** §5 Architecture, §6.1, §6.4, §8, §9 · **Decisions:** D4, D17, D26, D29, D33

## What to build

The thinnest path through every layer, so later tickets only add behaviour.

- WXT project, TypeScript, Preact, Vitest, Playwright. `minimum_chrome_version: "157"`.
- Folder layout from SPEC §5: `src/core/`, `src/adapters/`, `src/entrypoints/{background,popup,settings,block}`. Empty stubs are fine for anything not used yet.
- `_locales/en/messages.json` wired up; every UI string in this ticket goes through `chrome.i18n` (D26). Add a lint rule or test that fails on hard-coded UI strings if cheap.
- `core/rules.ts`: a pure function that turns a hard-coded list of one domain (`example.com`) into a DNR redirect rule → `/block.html?b=test`.
- `adapters/dnr.ts`: installs that rule as a dynamic rule on install.
- Block page: renders one translated line ("You chose to keep this out.") and a **Go back** button.
- Block page listed in `web_accessible_resources`.

## Permission check (D33)

Find out, by trying it, whether a redirect rule to an extension page works with `declarativeNetRequest` and **no** host permissions. Record the answer in this ticket and in SPEC §6.4. Keep `<all_urls>` only if it's actually needed.

## Acceptance

- [ ] `pnpm dev` (or npm) loads the extension in Chrome; visiting `https://example.com` shows the block page.
- [ ] Vitest runs and has one passing test for `core/rules.ts`.
- [ ] Playwright launches Chrome with the unpacked extension and asserts the redirect.
- [ ] `src/core/` imports nothing from `chrome`/`browser`.
- [ ] Permission finding recorded.

## Out of scope

State, storage, popup, categories, styling.
