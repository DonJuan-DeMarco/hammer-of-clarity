# Chrome Web Store listing

Ready to paste into the Chrome Web Store developer dashboard for version **1.0.1**. 1.0.1 is 1.0.0 plus the site-access tamper check (D34).

- **Package to upload:** `.output/hammer-of-clarity-1.0.1-chrome.zip` (run `pnpm zip`)
- **Privacy policy URL:** https://donjuan-demarco.github.io/hammer-of-clarity/privacy.html
- **Homepage URL:** https://donjuan-demarco.github.io/hammer-of-clarity/
- **Support URL:** https://github.com/DonJuan-DeMarco/hammer-of-clarity/issues
- **Images:** `docs/store/screenshots/` (four 1280×800 screenshots, one 440×280 promo tile). Regenerate with `pnpm build`, then `STORE_SHOTS=docs/store/screenshots pnpm exec playwright test store-screenshots`.

## Name

Hammer of Clarity

## Short description (≤ 132 characters)

Block distracting and harmful sites in one click. Unblocking takes a day and your own words, so the urge can pass.

## Category

Productivity / Workflow & planning

## Single purpose

Blocks websites the user chooses, and makes unblocking them deliberately slow.

## Detailed description

Hammer of Clarity helps you keep out the sites that pull you away, whether that's a feed you scroll without meaning to or a habit you're breaking.

- **One click to block.** Block the site you're on from the toolbar, or right-click any link. Block a whole site or just one part of it, like YouTube Shorts.
- **Whole categories.** Social media, short-form video, gambling and adult content, the last two from large, community-maintained lists that stay up to date.
- **Slow to unblock, on purpose.** Removing a wall means asking, waiting a day (a week for a whole adult or gambling category), then typing your own reason again, word for word. The wall stays up while you wait, and you can change your mind at any time.
- **A better next step.** When you hit a wall you see why you built it and one thing to do instead.
- **Progress without numbers.** Each wall moves from Forging to Tempering to Clear. There's no streak count to bargain with, and a slip starts you fresh without shame.
- **Earned trust.** Walls that have held for a long time, with few attempts, lose their waiting period. They're never lifted for you.
- **Private by design.** Everything runs on your device. No account, no server, no tracking.

Free software under the GNU GPL v3. Block lists by OISD and HaGeZi.

## Privacy practices

**Privacy statement (for the listing and a privacy policy page):**

> Hammer of Clarity runs entirely on your device. It does not collect, store remotely, sell or share any personal data. Your blocked sites, reasons, settings and progress are saved only in your browser's local extension storage and are deleted if you remove the extension.
>
> The only network requests the extension makes are weekly downloads of two public block lists (from oisd.nl and raw.githubusercontent.com) when "Keep the adult and gambling lists up to date" is on. These requests send nothing about you or your browsing. You can turn them off in settings.

**Data usage disclosures:** collects none of the listed data types. Website content and browsing activity are matched locally to decide whether to block a page, and never leave the device.

## Permission justifications

| Permission | Why it's needed |
|---|---|
| `declarativeNetRequest` | To block sites and show the extension's block page instead, using Chrome's built-in blocking rules. |
| Host access to all sites (`<all_urls>`) | Chrome only lets a blocking rule send a page to the extension's own block page on sites the extension has access to (tested: without it the rule never fires). The user can block any site, so this covers all of them. It also lets the toolbar button read the current page's address to block it, and covers the weekly list downloads. No page content is read or changed. |
| `storage` | Saves blocked sites, reasons, settings and progress locally. |
| `contextMenus` | Adds "Block this site" when right-clicking a link. |
| `alarms` | Runs the weekly list update, the daily progress check and the hourly clean-up of expired removal requests. |
| `browsingData` (from 1.0.2) | When the user blocks a site, removes that site's service worker and cached pages, and nothing else: no cookies, logins or history. Otherwise a site's service worker can keep serving its pages from the browser's cache, where Chrome's blocking rules never see them, so the block wouldn't work. Checked: adding it shows users no extra permission warning. |

**Paste-ready justification for `browsingData`:**

> Used only to remove the service worker and cached pages of sites the user has chosen to block. Without this, a site's service worker can serve its pages from the browser's cache, bypassing Chrome's blocking rules, so the block would not take effect. Cookies, logins and browsing history are never touched.

No remote code: the downloaded lists are plain text, parsed into blocking rules by the extension's own code.

## Screenshots, in upload order

1. `1-block-page.png`: the block page, with your reason, the stage and one thing to do instead.
2. `2-popup.png`: "Block any site in one click" (popup with three walls at three stages).
3. `3-setup.png`: "Choose what to keep out" (first-run setup).
4. `4-settings.png`: "Unblocking takes a day and your own words" (a removal request being confirmed).

The popup screenshot hides the "Finish setup" and incognito prompts, showing the popup as it looks once setup is complete.

## Submitting (you)

1. Register at https://chrome.google.com/webstore/devconsole (one-time USD 5 fee) and verify your contact email.
2. **New item** → upload the zip.
3. **Store listing:** paste the descriptions above, choose the category, upload the screenshots and the promo tile.
4. **Privacy:** paste the single purpose, the permission justifications and the privacy policy URL; tick "does not collect" for every data type; certify the three disclosures.
5. **Distribution:** public, all regions (or as you like).
6. **Submit for review.** Host access to all sites usually means an in-depth review, so expect days rather than hours.
