/**
 * Chrome Web Store images. Not a test: runs only with STORE_SHOTS=<dir>, e.g.
 *   pnpm build && STORE_SHOTS=docs/store/screenshots pnpm exec playwright test store-screenshots
 * Real sites are never loaded (every page is a placeholder). Writes four 1280×800 screenshots
 * and the 440×280 promo tile.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { BrowserContext, Page, Worker } from '@playwright/test';
import { expect, extensionIdOf, openPopupFor, test } from './fixtures';

const OUT = process.env.STORE_SHOTS;
const DAY = 24 * 60 * 60 * 1000;

test.describe.configure({ timeout: 120_000 });

async function send(page: Page, command: object) {
  return page.evaluate((c) => (globalThis as any).chrome.runtime.sendMessage({ type: 'command', command: c }), command);
}

/** Moves a category's start back so it shows a later stage. Stored data only. */
async function age(worker: Worker, ages: Record<string, number>) {
  await worker.evaluate(
    async ({ ages, day }) => {
      const chrome = (globalThis as any).chrome;
      const { 'state:v1': state } = await chrome.storage.local.get('state:v1');
      for (const [id, days] of Object.entries(ages)) state.categories[id].stageStartedAt = Date.now() - (days as number) * day;
      await chrome.storage.local.set({ 'state:v1': state });
    },
    { ages, day: DAY },
  );
}

/** Screens shown as a user who finished setup sees them: setup-only prompts are hidden. */
async function asSetUp(page: Page) {
  await page.addStyleTag({ content: '[data-testid="finish-setup"], [data-testid="incognito-warning"] { display: none !important; }' });
}

/** Places a screenshot in a 1280×800 frame with a caption. */
async function frame(context: BrowserContext, shot: Buffer, caption: string, file: string, maxWidth = 1100) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.setContent(`<!doctype html><body style="margin:0;width:1280px;height:800px;overflow:hidden;
    background:linear-gradient(160deg,#fbf3dc,#f3e3b8);font-family:'Segoe UI',system-ui,sans-serif;
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px">
    <div style="font-size:40px;font-weight:600;color:#2b2a27;letter-spacing:-0.01em">${caption}</div>
    <img src="data:image/png;base64,${shot.toString('base64')}" style="max-width:${maxWidth}px;max-height:620px;
      border-radius:16px;box-shadow:0 18px 50px rgba(80,60,10,.25);background:#fff"></body>`);
  await page.screenshot({ path: path.join(OUT!, file) });
  await page.close();
}

test('store screenshots', async ({ context, serviceWorker }) => {
  test.skip(!OUT, 'set STORE_SHOTS=<dir> to write the store images');
  mkdirSync(OUT!, { recursive: true });
  await context.route(/^https?:\/\//, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>placeholder</title><body style="background:#fff">' }),
  );
  const id = extensionIdOf(serviceWorker);
  const settings = await context.newPage();
  await settings.goto(`chrome-extension://${id}/options.html`);

  // 3. Setup: picking what to keep out.
  const onboarding = await context.newPage();
  await onboarding.setViewportSize({ width: 1100, height: 700 });
  await onboarding.goto(`chrome-extension://${id}/onboarding.html`);
  await onboarding.getByRole('button', { name: 'Set up my walls' }).click();
  await onboarding.getByTestId('card-adult').locator('.card-toggle').click();
  await frame(context, await onboarding.screenshot(), 'Choose what to keep out', '3-setup.png');

  // A lived-in state: two categories on at different stages, a personal block with a reason.
  await send(settings, { type: 'enableCategory', category: 'social', reason: 'Scrolling eats my evenings' });
  await send(settings, { type: 'enableCategory', category: 'short-video' });
  await send(settings, { type: 'addBlock', domain: 'news.example', reason: 'Mornings are for deep work.' });
  await age(serviceWorker, { social: 70, 'short-video': 30, personal: 5 });

  // 1. The block page.
  const blocked = await context.newPage();
  await blocked.setViewportSize({ width: 1280, height: 800 });
  await blocked.goto('https://news.example/').catch(() => {});
  await expect(blocked.getByTestId('reason')).toBeVisible();
  await blocked.screenshot({ path: path.join(OUT!, '1-block-page.png') });

  // 2. The popup on a page you could block.
  const site = await context.newPage();
  await site.goto('https://www.example-forum.com/threads/latest');
  // The first open shows the one-time "Social media has graduated" note; the screenshot is the usual view after it.
  const first = await openPopupFor(context, serviceWorker, site);
  await expect(first.getByTestId('graduation-notice')).toBeVisible();
  await expect
    .poll(() =>
      serviceWorker.evaluate(async () => {
        const { 'state:v1': state } = await (globalThis as any).chrome.storage.local.get('state:v1');
        return state.categories.social.graduationAnnounced;
      }),
    )
    .toBe(true);
  await first.close();
  const popup = await openPopupFor(context, serviceWorker, site);
  await popup.setViewportSize({ width: 352, height: 600 });
  await expect(popup.getByTestId('wall-social')).toBeVisible();
  await asSetUp(popup);
  await popup.getByPlaceholder('Why? (optional)').fill('It turns five minutes into an hour');
  await frame(context, await popup.locator('body').screenshot(), 'Block any site in one click', '2-popup.png', 420);

  // 4. Settings with a removal request waiting to be confirmed.
  await send(settings, {
    type: 'requestRemoval',
    target: { kind: 'exception', category: 'social', domain: 'x.com' },
    fallbackConfirmText: 'I am choosing to remove this wall, and I accept what comes with it.',
  });
  await serviceWorker.evaluate(async () => {
    const chrome = (globalThis as any).chrome;
    const { 'state:v1': state } = await chrome.storage.local.get('state:v1');
    for (const r of state.removalRequests) {
      r.readyAt = Date.now() - 60_000;
      r.expiresAt = Date.now() + 20 * 60 * 60 * 1000;
    }
    await chrome.storage.local.set({ 'state:v1': state });
  });
  await settings.setViewportSize({ width: 1000, height: 760 });
  await settings.reload();
  await settings.getByTestId('removal-request').getByRole('textbox').pressSequentially('Scrolling eats my');
  await frame(context, await settings.screenshot(), 'Unblocking takes a day and your own words', '4-settings.png');

  // 5. Promo tile, 440×280.
  const emblem = readFileSync('src/assets/emblem.svg', 'utf8').replace(/viewBox="[^"]*"/, 'viewBox="190 20 300 300"').replace('width="100%"', '');
  const tile = await context.newPage();
  await tile.setViewportSize({ width: 440, height: 280 });
  await tile.setContent(`<!doctype html><body style="margin:0;width:440px;height:280px;overflow:hidden;
    background:linear-gradient(160deg,#fbf3dc,#f0dca8);font-family:'Segoe UI',system-ui,sans-serif;
    display:flex;align-items:center;gap:10px;padding:0 24px;box-sizing:border-box">
    <div style="width:170px;height:170px;flex:none">${emblem.replace('<svg', '<svg style="width:170px;height:170px"')}</div>
    <div><div style="font-size:30px;font-weight:700;color:#2b2a27;line-height:1.1">Hammer of Clarity</div>
    <div style="font-size:17px;color:#5d574c;margin-top:10px;line-height:1.35">Easy to block.<br>Slow to unblock.<br>On purpose.</div></div></body>`);
  await tile.screenshot({ path: path.join(OUT!, 'promo-tile-440x280.png') });
});
