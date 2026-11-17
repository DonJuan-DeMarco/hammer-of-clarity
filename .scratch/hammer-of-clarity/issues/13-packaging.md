# 13 — Packaging: icons, license, store readiness

**Blocked by:** 01
**Spec:** §6.4, §8 · **Decisions:** D3, D20, D30, D33

## What to build

- **Icons (D30):**
  - 128 px: the full emblem (`src/assets/emblem.svg`).
  - 16 / 32 / 48 px: hammer head + blue gem only, no rays or sparkles, tuned to read at 16 px.
  - Compare against the user's second icon idea once it's provided.
- **License:** `LICENSE` (GPLv3). `NOTICE` and an in-extension credits page attributing OISD and HaGeZi with their licenses and source URLs.
- **Manifest check:** permissions are exactly what's used (finding from ticket 01 decides `<all_urls>`); `minimum_chrome_version: "157"`.
- **Store prep (draft only, not submitted):** privacy statement ("no data leaves your device except downloading public block lists"), permission justifications, short description.
- `pnpm build` produces a zip ready to load or upload.

## Acceptance

- [x] Toolbar icon is legible at 16 px on light and dark toolbars.
- [x] Credits page reachable from settings.
- [x] Built zip loads unpacked with no manifest warnings.

## Out of scope

Actually publishing; uninstall page.

## Result (done)

- **Icons:** `assets/icons/toolbar.svg` (hammer head with gold bands and the blue gem, a short handle, dark outlines; no rays) renders to 16/32/48 px; the 128 px icon is the emblem cropped square. `pnpm icons` (`scripts/render-icons.mjs`, uses Playwright's Chromium) writes `public/icon/*.png`, which WXT adds to the manifest; `--preview <file>` saves a sheet on light and dark toolbar colours. Checked by eye at 1x on both: reads as a hammer with a gem.
- **Licence:** `LICENSE` is the GPLv3 text (from the SPDX license list; gnu.org timed out). `NOTICE` credits OISD and HaGeZi (both GPLv3) and Preact (MIT). Both ship in the package as `LICENSE.txt` / `NOTICE.txt`. The copyright line reads "the Hammer of Clarity authors"; change it to your name if you prefer.
- **Credits page:** `credits.html`, linked from the bottom of settings.
- **Permissions:** `activeTab` dropped; host access to all sites already lets the popup read the current tab's address. Final set: `declarativeNetRequest`, `storage`, `contextMenus`, `alarms`, host `<all_urls>`. Each is justified in the store draft. `minimum_chrome_version: 157`.
- **Package:** `pnpm zip` → `.output/hammer-of-clarity-0.1.0-chrome.zip`, 3.1 MB (11.8 MB unpacked, mostly the two lists). Loaded in Chromium 159: no warnings or errors on `chrome://extensions`.
- **Store draft:** `docs/store/listing.md`: short and long description, single purpose, privacy statement, data disclosures, permission justifications, and the assets still to make (screenshots, promo tile, a hosted privacy page).
- Tests: 119 unit, 29 e2e (new: credits reachable from settings; manifest permissions, icons and licence files in the build).
- **Still open:** comparing with the user's second icon idea (never received); store screenshots; a hosted privacy policy page.
