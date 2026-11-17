import type { Worker } from '@playwright/test';
import { expect, extensionIdOf, openPopupFor, test } from './fixtures';

/** Lets 70 days "pass" for every enabled category by moving its stored start back. No hooks in shipped code. */
async function age(worker: Worker, days: number) {
  await worker.evaluate(async (d) => {
    const chrome = (globalThis as any).chrome;
    const { 'state:v1': state } = await chrome.storage.local.get('state:v1');
    for (const category of Object.values(state.categories) as { enabled: boolean; stageStartedAt?: number }[]) {
      if (category.enabled) category.stageStartedAt = Date.now() - d * 24 * 60 * 60 * 1000;
    }
    await chrome.storage.local.set({ 'state:v1': state });
  }, days);
}

test('after 66 quiet days social graduates: told once, and removing skips the wait but not the retype', async ({ context, serviceWorker }) => {
  await context.route(/^https:\/\/([a-z0-9-]+\.)*(x|facebook)\.com\//, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>stub</title>' }),
  );
  const settings = await context.newPage();
  await settings.goto(`chrome-extension://${extensionIdOf(serviceWorker)}/options.html`);
  const card = settings.getByTestId('category-social');
  await card.getByRole('button', { name: 'Block this category' }).click();
  await card.getByPlaceholder('Why are you blocking these? (optional)').fill('Scrolling eats my day');
  await card.getByRole('button', { name: 'Turn on' }).click();
  await expect(card.getByTestId('stage')).toBeVisible();

  await age(serviceWorker, 70);
  const site = await context.newPage();
  await site.goto('https://example.com/');
  const popup = await openPopupFor(context, serviceWorker, site);
  await expect(popup.getByTestId('graduation-notice')).toContainText('Social media has graduated: you are trusted here now.');
  await expect(popup.getByTestId('wall-social').getByTestId('stage')).toHaveText(/Clear/);

  const again = await openPopupFor(context, serviceWorker, site);
  await expect(again.getByRole('button', { name: 'Settings' })).toBeVisible();
  await expect(again.getByTestId('graduation-notice')).toHaveCount(0);

  // No cooldown: the request is ready to confirm straight away, but still needs the reason typed.
  await settings.reload();
  await card.getByText('Sites').click();
  await card.getByTestId('site-x.com').getByRole('button', { name: 'Request removal' }).click();
  const request = settings.getByTestId('removal-request');
  await expect(request.getByTestId('confirm-text')).toHaveText('Scrolling eats my day');
  await request.getByRole('textbox').pressSequentially('Scrolling eats my day');
  await request.getByRole('button', { name: 'Remove the wall' }).click();
  await expect(settings.getByTestId('removal-requests')).toHaveCount(0);

  const x = await context.newPage();
  await x.goto('https://x.com/').catch(() => {});
  await expect(x).toHaveURL('https://x.com/');
});
