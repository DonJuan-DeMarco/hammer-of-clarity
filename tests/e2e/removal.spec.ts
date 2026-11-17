import type { BrowserContext, Page, Worker } from '@playwright/test';
import { expect, extensionIdOf, finishCooldowns, openPopupFor, test } from './fixtures';

async function openSettings(context: BrowserContext, worker: Worker): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionIdOf(worker)}/options.html`);
  return page;
}

async function visit(context: BrowserContext, url: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(url).catch(() => {});
  return page;
}

async function stubSocial(context: BrowserContext) {
  await context.route(/^https:\/\/([a-z0-9-]+\.)*(x|facebook)\.com\//, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>stub</title>' }),
  );
}

test('removing your own block: wait, retype the reason (no pasting), and it is gone', async ({ context, serviceWorker }) => {
  const site = await context.newPage();
  await site.goto('https://example.com/');
  const popup = await openPopupFor(context, serviceWorker, site);
  await popup.getByPlaceholder('Why? (optional)').fill('Mornings matter');
  await popup.getByRole('button', { name: 'Hammer this site' }).click();
  await expect(site).toHaveURL(/block\.html/);

  const settings = await openSettings(context, serviceWorker);
  await settings.getByTestId('personal-blocks').getByRole('button', { name: 'Request removal' }).click();
  const request = settings.getByTestId('removal-request');
  await expect(request).toContainText('example.com');
  await expect(request).toContainText('Ready from');
  await expect(settings.getByTestId('personal-blocks')).toContainText('Removal requested');

  // While it cools, the wall stands, and the popup mentions the request without a number.
  await expect(await visit(context, 'https://example.com/')).toHaveURL(/block\.html/);
  const popupAgain = await openPopupFor(context, serviceWorker, site);
  await expect(popupAgain.getByTestId('removal-waiting')).toBeVisible();

  await finishCooldowns(serviceWorker);
  await settings.reload();
  await expect(request.getByTestId('confirm-text')).toHaveText('Mornings matter');
  const input = request.getByRole('textbox');

  const pasteRefused = await input.evaluate((el) => {
    const event = new ClipboardEvent('paste', { cancelable: true, bubbles: true, clipboardData: new DataTransfer() });
    event.clipboardData!.setData('text/plain', 'Mornings matter');
    el.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(pasteRefused).toBe(true);

  await input.pressSequentially('mornings matter');
  await request.getByRole('button', { name: 'Remove the wall' }).click();
  await expect(settings.getByRole('alert')).toHaveText('That is not the same text. Take your time.');

  await input.fill('');
  await input.pressSequentially('Mornings matter');
  await request.getByRole('button', { name: 'Remove the wall' }).click();
  await expect(settings.getByTestId('removal-requests')).toHaveCount(0);
  await expect(settings.getByTestId('personal-blocks')).toHaveCount(0);

  await expect(await visit(context, 'https://example.com/')).toHaveURL('https://example.com/');
});

test('a request can be cancelled, and the wall never came down', async ({ context, serviceWorker }) => {
  await stubSocial(context);
  const settings = await openSettings(context, serviceWorker);
  const card = settings.getByTestId('category-social');
  await card.getByRole('button', { name: 'Block this category' }).click();
  await card.getByRole('button', { name: 'Turn on' }).click();

  await card.getByRole('button', { name: 'Ask to turn off' }).click();
  await settings.getByTestId('removal-request').getByRole('button', { name: 'Cancel request' }).click();
  await expect(settings.getByTestId('removal-requests')).toHaveCount(0);
  await expect(card.getByRole('button', { name: 'Ask to turn off' })).toBeVisible();

  await expect(await visit(context, 'https://www.facebook.com/')).toHaveURL(/block\.html\?c=social/);
});

test('taking one site out of social leaves the rest blocked', async ({ context, serviceWorker }) => {
  await stubSocial(context);
  const settings = await openSettings(context, serviceWorker);
  const card = settings.getByTestId('category-social');
  await card.getByRole('button', { name: 'Block this category' }).click();
  await card.getByPlaceholder('Why are you blocking these? (optional)').fill('Scrolling eats my day');
  await card.getByRole('button', { name: 'Turn on' }).click();

  await card.getByText('Sites').click();
  await card.getByTestId('site-x.com').getByRole('button', { name: 'Request removal' }).click();
  await expect(settings.getByTestId('removal-request')).toContainText('x.com in Social media');

  await finishCooldowns(serviceWorker);
  await settings.reload();
  const request = settings.getByTestId('removal-request');
  await request.getByRole('textbox').pressSequentially('Scrolling eats my day');
  await request.getByRole('button', { name: 'Remove the wall' }).click();
  await expect(settings.getByTestId('removal-requests')).toHaveCount(0);

  await expect(await visit(context, 'https://x.com/')).toHaveURL('https://x.com/');
  await expect(await visit(context, 'https://www.facebook.com/')).toHaveURL(/block\.html\?c=social/);
});
