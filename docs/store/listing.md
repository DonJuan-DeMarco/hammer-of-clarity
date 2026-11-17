# Chrome Web Store listing (draft, not submitted)

Everything below is a draft for when the extension is published (D3). Nothing here has been submitted.

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

No remote code: the downloaded lists are plain text, parsed into blocking rules by the extension's own code.

## Assets still needed

- Screenshots (1280×800): block page, setup categories step, settings with a removal request, popup.
- Small promo tile (440×280).
- A hosted privacy policy URL with the statement above (a static page is enough).
