/**
 * Sites with a service worker (#13–#16). Their pages can be served from the browser's own
 * cache, out of sight of Chrome's blocking rules.
 */
import { expect, openPopupFor, test } from './fixtures';
import { openUnderServiceWorker, startSwSite, type SwSite } from './sw-site';

let site: SwSite;
test.beforeEach(async () => {
  site = await startSwSite();
});
test.afterEach(async () => {
  await site.close();
});

test('the test site really is served by its service worker', async ({ context }) => {
  const page = await context.newPage();
  await openUnderServiceWorker(page, `${site.origin}/`);

  expect(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toBe(`${site.origin}/sw.js`);
  await expect(page.locator('#content')).toHaveText('served by the test site');
});

test('"Hammer this site" lands on the block page even when a service worker serves the site (#13)', async ({ context, serviceWorker }) => {
  const page = await context.newPage();
  await openUnderServiceWorker(page, `${site.origin}/`);

  const popup = await openPopupFor(context, serviceWorker, page);
  await expect(popup.getByTestId('domain')).toHaveText(site.domain);
  await popup.getByPlaceholder('Why? (optional)').fill('Not now');
  await popup.getByRole('button', { name: 'Hammer this site' }).click();

  await expect(page).toHaveURL(/^chrome-extension:\/\/[a-z]+\/block\.html\?b=/);
  await expect(page.getByTestId('reason')).toHaveText('Not now');
});
