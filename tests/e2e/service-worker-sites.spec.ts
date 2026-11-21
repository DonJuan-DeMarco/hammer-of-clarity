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

test('once blocked, the site stays blocked on later visits; other sites keep their service workers (#14)', async ({ context, serviceWorker }) => {
  const other = await startSwSite('localhost');
  try {
    const page = await context.newPage();
    await openUnderServiceWorker(page, `${site.origin}/`);
    const untouched = await context.newPage();
    await openUnderServiceWorker(untouched, `${other.origin}/`);

    const popup = await openPopupFor(context, serviceWorker, page);
    await popup.getByRole('button', { name: 'Hammer this site' }).click();
    await expect(page).toHaveURL(/block\.html/);

    // The same page, another cached page, and a page the service worker never cached.
    for (const path of ['/', '/other', '/never-cached']) {
      const visit = await context.newPage();
      await visit.goto(`${site.origin}${path}`).catch(() => {});
      await expect(visit, path).toHaveURL(/block\.html\?b=/);
    }

    // The other site's service worker still serves its page from cache: the server never sees the request.
    other.served.length = 0;
    const again = await context.newPage();
    await again.goto(`${other.origin}/`);
    expect(await again.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
    expect(other.served).not.toContain('/');
  } finally {
    await other.close();
  }
});

/**
 * Blocks the site with a plain command, as the right-click menu would. The background then clears
 * the site's usual origins, which don't include the test site's port, so its service worker stays
 * installed: the hard case for the safety net (#15).
 */
async function blockKeepingServiceWorker(context: import('@playwright/test').BrowserContext, worker: import('@playwright/test').Worker, domain: string) {
  const extensionPage = await context.newPage();
  await extensionPage.goto(`chrome-extension://${new URL(worker.url()).host}/options.html`);
  const result = await extensionPage.evaluate(
    (d) => (globalThis as any).chrome.runtime.sendMessage({ type: 'command', command: { type: 'addBlock', domain: d, reason: 'Caught anyway' } }),
    domain,
  );
  expect(result.ok).toBe(true);
  await extensionPage.close();
}

const attemptsLogged = (worker: import('@playwright/test').Worker) =>
  worker.evaluate(async () => {
    const { 'state:v1': state } = await (globalThis as any).chrome.storage.local.get('state:v1');
    return state.attempts.length as number;
  });

test('the safety net catches a page served by a service worker the rules never saw (#15)', async ({ context, serviceWorker }) => {
  const first = await context.newPage();
  await openUnderServiceWorker(first, `${site.origin}/`);
  await blockKeepingServiceWorker(context, serviceWorker, site.domain);

  const visit = await context.newPage();
  await visit.goto(`${site.origin}/other`).catch(() => {});
  await expect(visit).toHaveURL(/block\.html\?b=/);
  await expect(visit.getByTestId('reason')).toHaveText('Caught anyway');
  // Counted once, like any other visit to the block page.
  await expect.poll(() => attemptsLogged(serviceWorker)).toBe(1);
});

test('the safety net catches the back button returning to a page cached before the block (#15)', async ({ context, serviceWorker }) => {
  const page = await context.newPage();
  await openUnderServiceWorker(page, `${site.origin}/`);
  await page.goto(`${site.origin}/other`);
  await blockKeepingServiceWorker(context, serviceWorker, site.domain);

  await page.goBack().catch(() => {});
  await expect(page).toHaveURL(/block\.html\?b=/);
});
