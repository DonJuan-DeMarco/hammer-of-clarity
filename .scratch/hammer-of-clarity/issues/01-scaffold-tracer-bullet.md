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

- [x] The built extension loaded in Chromium redirects `https://example.com` to the block page (checked via Playwright; `pnpm dev` not tried by hand).
- [x] Vitest runs and has one passing test for `core/rules.ts`.
- [x] Playwright launches Chrome with the unpacked extension and asserts the redirect.
- [x] `src/core/` imports nothing from `chrome`/`browser`.
- [x] Permission finding recorded.

## Out of scope

State, storage, popup, categories, styling.

## Result (done)

- Scaffold: WXT 0.21.5, Vite 8, TypeScript 7, Preact 11, Vitest 5, Playwright 1.65 (Chromium 159). `pnpm dev`, `pnpm build`, `pnpm test`, `pnpm test:e2e`, `pnpm typecheck`.
- Adapters use `browser` from `wxt/browser`, not `chrome`, to keep the Firefox door open (D4).
- Locales live in `public/_locales/` (WXT's public dir is at the project root, not under `src/`). `t()` in `src/adapters/i18n.ts` is typed against the message keys.
- The "fail on hard-coded UI strings" lint was skipped: not cheap with the current tooling. Revisit if strings start slipping through.
- **Permission finding (D33):** a `redirect` rule to the extension's own page, with only the `declarativeNetRequest` permission, installs fine but **never fires**: the page loads normally. Adding `host_permissions: ['<all_urls>']` makes the same rule redirect. So `<all_urls>` is required for the block page. (Possible store-friendlier variant for later: declare it under `optional_host_permissions` and request it during onboarding. Same grant, but asked for in context.)
