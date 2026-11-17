import type { BrowserContext, Page, Worker } from '@playwright/test';
import { expect, extensionIdOf, test } from './fixtures';

const CATEGORY_BLOCK_PAGE = (category: string) => new RegExp(`^chrome-extension://[a-z]+/block\\.html\\?c=${category}$`);

/** Real social and video sites are never loaded: anything that isn't blocked gets a stub page. */
async function stubSites(context: BrowserContext) {
  await context.route(/^https:\/\/([a-z0-9-]+\.)*(youtube|instagram|facebook|tiktok|reddit|linkedin)\.com\//, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>stub</title><p>stub site</p>' }),
  );
}

async function openSettings(context: BrowserContext, worker: Worker): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionIdOf(worker)}/options.html`);
  return page;
}

async function visit(context: BrowserContext, url: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(url).catch(() => {}); // a redirect to the block page can surface as an aborted navigation
  return page;
}

test('turning on short-form video blocks Shorts and Reels but not the rest of YouTube', async ({ context, serviceWorker }) => {
  await stubSites(context);
  const settings = await openSettings(context, serviceWorker);
  const card = settings.getByTestId('category-short-video');
  await card.getByRole('button', { name: 'Block this category' }).click();
  await card.getByPlaceholder('Why are you blocking these? (optional)').fill('Shorts steal my evenings');
  await card.getByRole('button', { name: 'Turn on' }).click();
  await expect(card.getByTestId('stage')).toHaveText(/Forging/);

  const shorts = await visit(context, 'https://www.youtube.com/shorts/abc123');
  await expect(shorts).toHaveURL(CATEGORY_BLOCK_PAGE('short-video'));
  await expect(shorts.getByTestId('reason')).toHaveText('Shorts steal my evenings');
  await expect(shorts.getByTestId('stage')).toHaveText(/Forging/);

  const reels = await visit(context, 'https://www.instagram.com/reels/xyz/');
  await expect(reels).toHaveURL(CATEGORY_BLOCK_PAGE('short-video'));

  const watch = await visit(context, 'https://www.youtube.com/watch?v=abc');
  await expect(watch).toHaveURL('https://www.youtube.com/watch?v=abc');
});

test('sites unticked at setup stay reachable, and LinkedIn starts unticked', async ({ context, serviceWorker }) => {
  await stubSites(context);
  const settings = await openSettings(context, serviceWorker);
  const card = settings.getByTestId('category-social');
  await card.getByRole('button', { name: 'Block this category' }).click();
  await expect(card.getByLabel('linkedin.com')).not.toBeChecked();
  await card.getByLabel('reddit.com').uncheck();
  await card.getByRole('button', { name: 'Turn on' }).click();
  await expect(card.getByTestId('stage')).toBeVisible();

  const facebook = await visit(context, 'https://www.facebook.com/');
  await expect(facebook).toHaveURL(CATEGORY_BLOCK_PAGE('social'));
  await expect(facebook.getByTestId('reason')).toHaveText('You chose to keep this out.');

  const reddit = await visit(context, 'https://www.reddit.com/');
  await expect(reddit).toHaveURL('https://www.reddit.com/');

  const linkedin = await visit(context, 'https://www.linkedin.com/');
  await expect(linkedin).toHaveURL('https://www.linkedin.com/');
});

test('adult and gambling are shown but not available yet', async ({ context, serviceWorker }) => {
  const settings = await openSettings(context, serviceWorker);

  await expect(settings.getByTestId('category-adult')).toContainText('Coming soon');
  await expect(settings.getByTestId('category-gambling')).toContainText('Coming soon');
});
