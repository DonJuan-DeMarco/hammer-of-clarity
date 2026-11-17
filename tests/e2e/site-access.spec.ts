import type { BrowserContext, Worker } from '@playwright/test';
import { expect, extensionIdOf, openPopupFor, test } from './fixtures';

/** Sets the extension's "Site access" on chrome://extensions, the way a user would. */
async function setSiteAccess(context: BrowserContext, worker: Worker, value: 'ON_CLICK' | 'ON_ALL_SITES') {
  const page = await context.newPage();
  await page.goto(`chrome://extensions/?id=${extensionIdOf(worker)}`);
  await page.locator('extensions-detail-view #hostAccess').selectOption(value);
  await page.close();
}

const personal = (worker: Worker) =>
  worker.evaluate(async () => {
    const { 'state:v1': state } = await (globalThis as any).chrome.storage.local.get('state:v1');
    return { ...state.categories.personal, siteAccessWasFull: state.siteAccessWasFull };
  });

async function landsOnBlockPage(context: BrowserContext): Promise<boolean> {
  const page = await context.newPage();
  await page.goto('https://example.com/').catch(() => {});
  return page.url().includes('/block.html');
}

test('limiting site access is tamper: walls reset, the popup says how to fix it, restoring brings blocking back', async ({ context, serviceWorker }) => {
  await context.route('https://example.org/**', (route) => route.fulfill({ contentType: 'text/html', body: '<title>x</title>' }));
  const site = await context.newPage();
  await site.goto('https://example.com/');
  await (await openPopupFor(context, serviceWorker, site)).getByRole('button', { name: 'Hammer this site' }).click();
  await expect(site).toHaveURL(/block\.html/);
  await expect.poll(async () => (await personal(serviceWorker)).siteAccessWasFull).toBe(true);
  const before = await personal(serviceWorker);

  // "On click": Chrome stops the redirect, which is the side door this closes.
  await setSiteAccess(context, serviceWorker, 'ON_CLICK');
  await expect.poll(async () => (await personal(serviceWorker)).resetNoticePending).toBe(true);
  const reset = await personal(serviceWorker);
  expect(reset.siteAccessWasFull).toBe(false);
  expect(reset.stageStartedAt).toBeGreaterThan(before.stageStartedAt);
  expect(await landsOnBlockPage(context)).toBe(false);
  expect(await serviceWorker.evaluate(() => (globalThis as any).chrome.action.getBadgeText({}))).toBe('!');

  const elsewhere = await context.newPage();
  await elsewhere.goto('https://example.org/');
  const popup = await openPopupFor(context, serviceWorker, elsewhere);
  await expect(popup.getByTestId('site-access-warning')).toContainText('Your walls are down');
  await expect(popup.getByRole('button', { name: 'Fix site access' })).toBeVisible();
  await expect(popup.getByTestId('reset-notice')).toBeVisible();

  // Back to "On all sites": blocking returns, the warning goes, and there's no second reset.
  await setSiteAccess(context, serviceWorker, 'ON_ALL_SITES');
  await expect.poll(async () => (await personal(serviceWorker)).siteAccessWasFull).toBe(true);
  expect((await personal(serviceWorker)).stageStartedAt).toBe(reset.stageStartedAt);
  await expect.poll(() => landsOnBlockPage(context)).toBe(true);
  const popupAgain = await openPopupFor(context, serviceWorker, elsewhere);
  await expect(popupAgain.getByRole('button', { name: 'Settings' })).toBeVisible();
  await expect(popupAgain.getByTestId('site-access-warning')).toHaveCount(0);
});
