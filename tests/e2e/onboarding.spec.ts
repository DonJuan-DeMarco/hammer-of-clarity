import type { BrowserContext, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { expect, openPopupFor, test } from './fixtures';

test.describe.configure({ timeout: 90_000 });

/** The tab the extension opens by itself on install. */
async function onboardingTab(context: BrowserContext): Promise<Page> {
  await expect.poll(() => context.pages().some((p) => p.url().endsWith('/onboarding.html')), { timeout: 10_000 }).toBe(true);
  const page = context.pages().find((p) => p.url().endsWith('/onboarding.html'))!;
  await page.waitForLoadState();
  return page;
}

/** No real site ever loads; blocked URLs still reach the block page first. */
async function stubTheWeb(context: BrowserContext) {
  await context.route(/^https?:\/\//, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>placeholder</title>' }),
  );
}

async function blockedAs(context: BrowserContext, url: string): Promise<string | null> {
  const page = await context.newPage();
  await page.goto(url).catch(() => {});
  return /block\.html\?c=([a-z-]+)/.exec(page.url())?.[1] ?? null;
}

test('setup opens on install and walks through categories, redirects and incognito', async ({ context, serviceWorker }) => {
  await stubTheWeb(context);
  const page = await onboardingTab(context);
  await expect(page.getByRole('heading', { name: 'Welcome to Hammer of Clarity' })).toBeVisible();
  await page.getByRole('button', { name: 'Set up my walls' }).click();

  // Nothing is chosen for you.
  for (const id of ['adult', 'gambling', 'social', 'short-video']) {
    await expect(page.getByTestId(`card-${id}`).locator('.card-toggle')).toHaveAttribute('aria-pressed', 'false');
  }
  await expect(page.getByRole('button', { name: 'Skip for now' })).toBeVisible();

  await page.getByTestId('card-adult').locator('.card-toggle').click();
  const social = page.getByTestId('card-social');
  await social.locator('.card-toggle').click();
  await expect(social.getByLabel('linkedin.com')).not.toBeChecked();
  await social.getByPlaceholder('Why are you blocking these? (optional)').fill('Scrolling eats my day');
  await page.getByRole('button', { name: 'Turn on and continue' }).click();

  await expect(page.getByTestId('step-redirects')).toBeVisible();
  await expect(page.getByTestId('redirect-item')).toHaveCount(3);
  await page.getByRole('button', { name: 'Continue' }).click();

  // Incognito can't be switched on from a test (see tamper.spec.ts), so the last step stays locked.
  await expect(page.getByTestId('step-incognito')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Finish setup' })).toBeDisabled();
  await expect(page.getByTestId('incognito-status').getByRole('button', { name: 'Open the setting' })).toBeVisible();

  // The walls chosen in step 2 are already up.
  const [rule] = JSON.parse(readFileSync('.output/chrome-mv3/rulesets/adult.json', 'utf8'));
  expect(await blockedAs(context, `https://${rule.condition.requestDomains.at(-1)}/`)).toBe('adult');
  expect(await blockedAs(context, 'https://www.facebook.com/')).toBe('social');
  expect(await blockedAs(context, 'https://www.linkedin.com/')).toBeNull();

  // Until setup is finished, the popup offers to finish it.
  const site = await context.newPage();
  await site.goto('https://example.org/');
  const popup = await openPopupFor(context, serviceWorker, site);
  await expect(popup.getByTestId('finish-setup')).toBeVisible();
});

test('choosing nothing is fine', async ({ context }) => {
  const page = await onboardingTab(context);
  await page.getByRole('button', { name: 'Set up my walls' }).click();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await expect(page.getByTestId('step-redirects')).toBeVisible();
});

test('screenshot: onboarding categories', async ({ context }) => {
  test.skip(!process.env.SCREENSHOT, 'set SCREENSHOT=<path> to capture the categories step for a design check');
  const page = await onboardingTab(context);
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.getByRole('button', { name: 'Set up my walls' }).click();
  await page.getByTestId('card-social').locator('.card-toggle').click();
  await page.screenshot({ path: process.env.SCREENSHOT!, fullPage: true });
});
