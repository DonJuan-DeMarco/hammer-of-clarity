# Hammer of Clarity — v1 Spec

Source of truth for terms and decisions: [CONTEXT.md](../CONTEXT.md). Decision numbers below (D1, D2…) refer to that file.

## 1. Summary

A Chromium (Chrome 157+) Manifest V3 extension that blocks distracting or harmful sites. Blocking takes one click. Unblocking is slow by design: a cooldown, then retyping your reason. Progress is shown as named stages, never as numbers. Everything runs locally; the only network traffic is an optional weekly download of public domain lists.

**Defence model (D1):** friction against impulses, plus detection of tampering after the fact. It does not try to stop a determined user.

## 2. Goals and non-goals

**Goals**
- Block a site, a path, or a whole category in one or two clicks.
- Make every move away from safety slow and deliberate; every move toward safety instant (D11).
- Show progress in a way that can't be bargained with (D2).
- Notice when the extension or its incognito access is switched off, and reset gently (D9, D10, D13, D14).
- Keep all user data on the machine (D3, D25).

**Non-goals for v1**
- Schedules, focus timers (D8)
- Firefox and Safari (D4)
- Sync across devices (D25)
- Languages other than English (D26) — but all strings go through `chrome.i18n`
- An uninstall page (D18)
- Any history of attempts or tamper events shown to the user (D24)
- Defending against clock changes, devtools edits or other deliberate bypasses (D1, D28)

## 3. Concepts

| Concept | Definition |
|---|---|
| **Category** | `adult`, `gambling`, `social`, `short-video`, plus **`personal`** for blocks the user adds by hand (D31) |
| **Block** | A domain (`reddit.com`, matches subdomains) or a domain + path prefix (`youtube.com/shorts`) |
| **Exception** | A site taken out of a category (e.g. LinkedIn from `social`, or a wrongly-listed site from `adult`) |
| **Stage** | Forging (days 0–20), Tempering (21–65), Clear (66+), computed from the category's `stageStartedAt` (D27) |
| **Removal request** | The slow path to take a block, category or exception's protection away (D11) |
| **Attempt** | One load of the block page. Logged for 30 days, never shown, never punished (D9, D24) |
| **Tamper** | Extension re-enabled after being disabled, or incognito access turned off (D13, D14) |
| **Graduation** | A category earning the right to skip cooldowns (D19) |

## 4. Data model

All state lives in `chrome.storage.local` under a single versioned key. Times are epoch milliseconds.

```ts
type CategoryId = 'adult' | 'gambling' | 'social' | 'short-video' | 'personal';

interface State {
  schemaVersion: 1;
  onboardingComplete: boolean;
  categories: Record<CategoryId, CategoryState>;
  blocks: Block[];                  // hand-added blocks, all in `personal`
  removalRequests: RemovalRequest[];
  redirects: Redirect[];            // at least one, always
  attempts: Attempt[];              // pruned to the last 30 days
  lists: ListMeta;                  // refresh setting + last successful refresh
  incognitoWasAllowed: boolean;     // to detect the on → off transition
}

interface CategoryState {
  enabled: boolean;
  reason?: string;
  stageStartedAt: number;           // reset sets this to now
  exceptions: Exception[];          // sites taken out of this category
  graduatedAt?: number;
  graduationAnnounced: boolean;
}

interface Block {
  id: string;
  domain: string;                   // lowercase, punycode
  pathPrefix?: string;              // e.g. "/shorts"
  reason?: string;
  createdAt: number;
}

interface Exception { domain: string; pathPrefix?: string; addedAt: number; }

type RemovalTarget =
  | { kind: 'category'; category: CategoryId }
  | { kind: 'block'; blockId: string }
  | { kind: 'exception'; category: CategoryId; domain: string; pathPrefix?: string };

interface RemovalRequest {
  id: string;
  target: RemovalTarget;
  createdAt: number;
  readyAt: number;                  // createdAt + cooldown (or createdAt if graduated)
  expiresAt: number;                // readyAt + 24h
  confirmText: string;              // the reason, or the fixed sentence (D23)
}

interface Redirect { id: string; kind: 'link' | 'instruction'; text: string; url?: string; }
interface Attempt { category: CategoryId; at: number; }
interface ListMeta { refreshEnabled: boolean; lastRefreshedAt?: number; }
```

Schedules (D8) can be added later as an optional `schedule` field on `CategoryState` and `Block` without migrating existing data.

## 5. Architecture

```
src/
  core/            Plain TypeScript. No chrome.* calls. Clock passed in.
    stages.ts        stageFor(category, now)
    removal.ts       create / confirm / cancel / expire removal requests
    graduation.ts    isEligible(category, attempts, now), graduate()
    tamper.ts        resetAll(state, now)
    rules.ts         buildRules(state, lists) → DNR rule set
    lists.ts         parse list text → normalized, deduped domains
    reducer.ts       (state, command, now) → new state; the only way state changes
  adapters/        The only code that touches chrome.*
    storage.ts       load/save State
    dnr.ts           apply rule set (static rulesets on/off + dynamic rules)
    lists.ts         fetch list text, weekly alarm
    lifecycle.ts     runtime.onExtensionLoaded, incognito check, badge
  entrypoints/     WXT entrypoints (D29)
    background.ts
    popup/           Preact
    settings/        Preact
    block/           Preact — the block page
    onboarding/      Preact
```

**Rule:** every change goes `command → core/reducer → save → core/rules → adapters/dnr`. The UI never writes state or rules directly. This keeps all the psychology rules testable with Vitest and a fake clock.

## 6. Blocking mechanics

### 6.1 Rules

| Source | DNR rule | Notes |
|---|---|---|
| `adult` list | One rule, all domains in `condition.requestDomains`, action `redirect` → `/block.html?c=adult` | ~493k domains (OISD NSFW) |
| `adult` keywords | One `regexFilter` rule per keyword, matching the **hostname only**: `^https?://[^/]*(porn\|xxx\|hentai)` | Hostname-only so a search for "porn addiction help" isn't blocked |
| `gambling` list | One rule, `requestDomains`, redirect `?c=gambling` | ~98k domains (HaGeZi medium) |
| `social`, `short-video` | One rule per entry, `urlFilter: "\|\|domain/path"`, redirect `?c=<id>` | Hand-curated, under 50 entries |
| Personal blocks | One rule per block, redirect `?b=<blockId>` | |
| Exceptions | `allow` rules at higher priority | |

- Resource types: `main_frame` and `sub_frame` only. Blocking images or scripts on other sites is out of scope.
- The block page must be listed in `web_accessible_resources`.
- The original URL is never passed to or stored by the block page.

### 6.2 Lists (D15, D16, D20)

| Category | Source | URL | License |
|---|---|---|---|
| adult | OISD NSFW | `https://nsfw.oisd.nl/domainswild2` | GPLv3 |
| adult (fallback) | HaGeZi NSFW | `raw.githubusercontent.com/hagezi/dns-blocklists/main/wildcard/nsfw-onlydomains.txt` | GPLv3 |
| gambling | HaGeZi Gambling medium | `raw.githubusercontent.com/hagezi/dns-blocklists/main/wildcard/gambling.medium-onlydomains.txt` | GPLv3 |

- **Bundled snapshot:** at build time, each list is fetched, parsed and written as a static ruleset. Enabled when its category is on.
- **Weekly refresh (on by default):** a `chrome.alarms` alarm downloads the plain text, parses it in `core/lists.ts`, installs it as a dynamic rule, then disables the matching static ruleset. On any failure (network, parse, install), keep what's installed and try again next week. No user data is sent.
- **Refresh off:** remove the dynamic list rules and use the bundled static rulesets.
- The parser accepts plain domains, `*.domain` wildcards, hosts-file lines (`0.0.0.0 domain`) and `||domain^`. It lowercases, converts to punycode, drops comments and duplicates.
- Host permissions needed for refresh: `nsfw.oisd.nl`, `raw.githubusercontent.com`.

### 6.3 Initial hand-curated lists (D21)

- **social:** facebook.com, instagram.com, x.com, twitter.com, reddit.com, tiktok.com, snapchat.com, threads.net, pinterest.com, tumblr.com, linkedin.com (**unticked by default**)
- **short-video:** youtube.com/shorts, instagram.com/reels, facebook.com/reel, tiktok.com

### 6.4 Permissions

`declarativeNetRequest`, `storage`, `alarms`, `contextMenus`, `activeTab`, plus `host_permissions: ["<all_urls>"]` (D33). Verified in ticket 01: without host access a redirect rule installs but never fires.

## 7. Behaviour

### 7.1 Adding (D12, D22) — always instant

- **Toolbar popup → "Hammer this site":** blocks the current tab's domain. A toggle narrows it to the current path. Optional one-line reason with **Skip**. The tab reloads into the block page.
- **Right-click on a link → "Block this site":** blocks that link's domain, no reason prompt.
- **Enabling a category** in settings or onboarding: instant, `stageStartedAt = now`.
- Adding a block that already exists, or is already covered by an enabled category, says so and does nothing.

### 7.2 Removal requests (D11, D19, D23)

```
            create
              │
              ▼
  ┌──── cooling ────┐  cancel (any time) → cancelled
  │   until readyAt │
  └────────┬────────┘
           ▼
  ┌── confirmable ──┐  retype matches → confirmed → apply removal
  │ until expiresAt │  cancel → cancelled
  └────────┬────────┘
           ▼
        expired
```

| Target | Cooldown | Effect when confirmed |
|---|---|---|
| Personal block | 24h | Block removed; `personal` resets |
| Site from `social` / `short-video` (new exception) | 24h | Exception added; category resets |
| Whole `social` / `short-video` category | 24h | Category disabled |
| Whole `adult` / `gambling` category | 7 days | Category disabled |
| Site from `adult` / `gambling` (new exception) | 24h (D32) | Exception added; **no reset** (D32) |

- **Graduated category:** `readyAt = createdAt` (no cooldown). The retype is still required.
- **Confirm window:** 24h after `readyAt`.
- **Retype text:** the reason the user wrote for that block or category. If there was none, the fixed sentence: *"I am choosing to remove this wall, and I accept what comes with it."*
- **Retype matching:** trimmed, runs of whitespace collapsed, case-sensitive. Pasting into the field is blocked.
- One open request per target. Requesting again shows the existing one.
- The block stays fully active until confirmation.

### 7.3 Stages and resets (D2, D9, D10, D27)

- `stageFor(category, now)`: under 21 days → Forging; under 66 → Tempering; else Clear.
- **What resets a category:** confirming a removal that targets it or a site in it (see table above). Tamper resets every enabled category.
- **What never resets:** attempts.
- **Reset message** (shown the next time the user opens the popup or block page): calm, no numbers, never mentions what was lost; shows the reason and a redirect. Example: *"You're starting fresh. A slip doesn't undo what you've learned. Here's why you started: …"*

### 7.4 Graduation (D19)

- **Eligible when:** stage has run uninterrupted for 66 days (`social`, `short-video`, `personal`) or 180 days (`adult`, `gambling`), **and** fewer than 3 attempts in that category in the last 30 days.
- Checked daily by alarm and when the popup opens.
- On graduation: `graduatedAt = now`. Next popup open shows once: *"Social has graduated: you're trusted here now."* Then `graduationAnnounced = true`.
- The block is never lifted automatically. A reset removes graduation.

### 7.5 Tamper (D13, D14)

- `runtime.onExtensionLoaded` with `reason === 'enable'` → reset all enabled categories.
- On every service-worker start and popup open, check `chrome.extension.isAllowedIncognitoAccess()`:
  - on → off: reset all, set `incognitoWasAllowed = false`, red badge.
  - off: red badge stays; popup shows a button that opens `chrome://extensions/?id=<id>`.
  - off → on: clear badge.

- **Site access (1.0.1, D34):** on every worker start, popup open and `permissions.onAdded`/`onRemoved`, check `permissions.contains({ origins: ['<all_urls>'] })`.
  - full → limited: reset all, `siteAccessWasFull = false`, red badge, popup warning with a button to the extension's settings page.
  - limited → full: clear the warning (badge stays if incognito is still off). No reset.

### 7.5a Sites with a service worker (D35, 1.0.2)

A site's service worker can serve its pages from the browser's cache, out of sight of the blocking rules. So:
- **After "Hammer this site"** the tab reloads with `bypassCache` (like Ctrl+F5), after clearing the tab's exact origin.
- **When a site becomes blocked** (own block, right-click, hand-picked category turned on), its service worker and Cache Storage are removed for `https`/`http` × bare/`www`. On extension update, the same for everything already blocked. Adult and gambling lists are not cleared site by site.
- **Safety net:** on every `tabs.onUpdated` address change, `blockDecision` (own blocks → hand-picked → adult keyword, honouring exceptions) and then the list table (adult before gambling, honouring let-through exceptions) decide; a hit sends the tab to the same block page the rules use and clears that site's service worker. The block page logs the visit once.
- **List table:** IndexedDB, one store per list plus a meta store. It holds the bundled list, or the refreshed one when refresh is on and installed, or nothing when the category is off. Filled in chunks in its own queue; trusted only once complete.

### 7.6 Onboarding (D7, D13, D22)

1. **Welcome:** one sentence on how it works (easy to block, slow to unblock).
2. **Categories:** four large cards, none pre-selected. Selecting `social` or `short-video` shows its site list with checkboxes (LinkedIn unticked). Each selected category has an optional reason field.
3. **Redirects:** three defaults pre-filled, editable, at least one required:
   - *Take a 10-minute walk.*
   - *Drink a glass of water and do 20 push-ups.*
   - *Write down what you're feeling right now.*
4. **Incognito:** explains why, opens the settings page. **Can't finish** until access is on.
5. **Done.**

Choosing no category is allowed (personal blocks only).

### 7.7 Block page (D7)

- The emblem, the stage name for that category, and the reason (block reason → category reason → default *"You chose to keep this out."*).
- One redirect, chosen at random: a link opens in the same tab; an instruction shows as text with **Done** (closes the tab).
- **Go back** button.
- Logs one attempt for the category.
- Shows the reset message or graduation note if one is pending.
- No numbers anywhere.

### 7.8 Popup and settings (D24)

**Popup:** "Hammer this site", each enabled category with its stage, removal requests in progress (count + link), incognito warning if off, link to settings.

**Settings:**
- Categories: stage, enable (instant), request removal, site list with request-removal per site.
- Personal blocks: list, request removal.
- Removal requests: countdown, cancel, confirm field once ready.
- Redirects: add/edit/remove instantly (at least one must remain) (D33).
- List refresh: toggle (instant), last refreshed date.
- Incognito status.

## 8. Packaging

- WXT + TypeScript + Preact (D29). `minimum_chrome_version: "157"` (D17).
- License: GPLv3 (D20). `NOTICE` / credits page attributing OISD and HaGeZi.
- Icons (D30): 128 px = full emblem; 16/32/48 px = hammer head + gem, no rays.
- All UI strings in `_locales/en/messages.json` (D26).

## 9. Testing

- **Vitest, `core/` only, fake clock:** stage boundaries (day 20/21, 65/66); removal request transitions incl. expiry and graduated no-cooldown; retype matching; graduation eligibility (179 vs 180 days, 2 vs 3 attempts); tamper reset; attempt pruning; list parser formats; rule building (exceptions win, keyword regex matches hostname only).
- **Playwright with the unpacked extension:** onboarding completes; "Hammer this site" redirects to the block page; enabling `adult` blocks a listed domain; exception allows a site.

## 10. Risks

1. ~~Installing a ~493k-domain dynamic rule at runtime is untested~~ **Resolved in ticket 02:** one rule holds the whole OISD list, static (23 ms to enable) or dynamic (~0.7 s to install, ~0.8 s to replace). No fallback needed.
2. **`<all_urls>` and store review** (D33). Fine for personal use; needs a clear justification when publishing.
3. **False positives in the adult list** (D32). OISD is aggressive; legitimate sites will be caught. Exceptions are the release valve.
4. **Clock changes bypass cooldowns** (D28). Accepted.
