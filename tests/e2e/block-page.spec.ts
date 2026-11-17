import type { BrowserContext, Page, Worker } from '@playwright/test';
import { expect, extensionIdOf, openPopupFor, test } from './fixtures';

const DEFAULTS = [
  'Take a 10-minute walk.',
  'Drink a glass of water and do 20 push-ups.',
  'Write down what you are feeling right now.',
];

async function blockExampleCom(context: BrowserContext, worker: Worker, reason = ''): Promise<Page> {
  const site = await context.newPage();
  await site.goto('https://example.com/');
  const popup = await openPopupFor(context, worker, site);
  if (reason) await popup.getByPlaceholder('Why? (optional)').fill(reason);
  await popup.getByRole('button', { name: 'Hammer this site' }).click();
  await expect(site).toHaveURL(/block\.html\?b=/);
  return site;
}

async function openSettings(context: BrowserContext, worker: Worker): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionIdOf(worker)}/options.html`);
  return page;
}

test('three default redirects are there from the start', async ({ context, serviceWorker }) => {
  const settings = await openSettings(context, serviceWorker);

  await expect(settings.getByTestId('redirect-item')).toHaveText(DEFAULTS.map((d) => new RegExp(d.replace('.', '\\.'))));
});

test('the block page offers one redirect, and Done closes the tab', async ({ context, serviceWorker }) => {
  const site = await blockExampleCom(context, serviceWorker, 'Not before work');

  await expect(site.getByRole('heading', { name: 'This one stays out.' })).toBeVisible();
  await expect(site.getByTestId('reason')).toHaveText('Not before work');
  const offered = await site.getByTestId('redirect').locator('p').textContent();
  expect(DEFAULTS).toContain(offered);

  const closed = site.waitForEvent('close');
  await site.getByRole('button', { name: 'Done' }).click();
  await closed;
});

test('redirects can be edited, never all removed, and a link opens in the same tab', async ({ context, serviceWorker }) => {
  await context.route('https://example.org/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>book</title><p>my book</p>' }),
  );
  const settings = await openSettings(context, serviceWorker);
  const items = settings.getByTestId('redirect-item');

  // Add a link, then remove every instruction.
  const add = settings.getByTestId('redirects').locator('form').last();
  await add.locator('select').selectOption('link');
  await add.getByPlaceholder('For example: Call a friend').fill('Read my book');
  await add.getByPlaceholder('https://').fill('https://example.org/book');
  await add.getByRole('button', { name: 'Add' }).click();
  await expect(items).toHaveCount(4);
  for (let i = 0; i < 3; i++) await items.first().getByRole('button', { name: 'Remove' }).click();
  await expect(items).toHaveCount(1);
  await expect(items).toHaveText(/Read my book/);

  // The last one stays.
  await items.first().getByRole('button', { name: 'Remove' }).click();
  await expect(settings.getByRole('alert')).toHaveText('Keep at least one.');
  await expect(items).toHaveCount(1);

  // Edit it in place.
  await items.first().getByRole('button', { name: 'Edit' }).click();
  await settings.getByTestId('redirects').locator('li input[type="text"]').fill('Read my book instead');
  await settings.getByRole('button', { name: 'Save' }).click();
  await expect(items).toHaveText(/Read my book instead/);

  const site = await blockExampleCom(context, serviceWorker);
  await site.getByRole('link', { name: 'Read my book instead' }).click();
  await expect(site).toHaveURL('https://example.org/book');
});

test('each visit to the block page is logged for later, and shown nowhere', async ({ context, serviceWorker }) => {
  const site = await blockExampleCom(context, serviceWorker);

  await expect
    .poll(() =>
      serviceWorker.evaluate(async () => {
        const stored = await (globalThis as any).chrome.storage.local.get('state:v1');
        return stored['state:v1'].attempts.map((a: { category: string }) => a.category);
      }),
    )
    .toEqual(['personal']);
  // No count anywhere on the page. The redirect itself may contain numbers ("10-minute walk"), so skip it.
  const textWithoutRedirect = await site.evaluate(() => {
    const copy = document.body.cloneNode(true) as HTMLElement;
    copy.querySelector('[data-testid="redirect"]')?.remove();
    return copy.textContent ?? '';
  });
  expect(textWithoutRedirect).not.toMatch(/\d/);
});

test('screenshot: block page', async ({ context, serviceWorker }) => {
  test.skip(!process.env.SCREENSHOT, 'set SCREENSHOT=1 to capture the block page for a design check');
  const site = await blockExampleCom(context, serviceWorker, 'Mornings are for deep work.');
  await site.setViewportSize({ width: 1100, height: 760 });
  await site.screenshot({ path: process.env.SCREENSHOT!, fullPage: true });
});
