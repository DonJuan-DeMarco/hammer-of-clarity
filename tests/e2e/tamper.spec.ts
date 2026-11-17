import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { BrowserContext, Worker } from '@playwright/test';
import { expect, extensionIdOf, launchWithExtension, openPopupFor, serviceWorkerOf, test } from './fixtures';

interface StoredCategory {
  enabled: boolean;
  stageStartedAt?: number;
  resetNoticePending?: boolean;
}

/** The extension's service worker, waiting for a fresh one if the extension was just reloaded. */
async function currentWorker(context: BrowserContext, extensionId: string): Promise<Worker> {
  await expect
    .poll(() => context.serviceWorkers().filter((w) => w.url().includes(extensionId)).length, { timeout: 10_000 })
    .toBeGreaterThan(0);
  const workers = context.serviceWorkers().filter((w) => w.url().includes(extensionId));
  return workers[workers.length - 1]!;
}

async function personal(context: BrowserContext, extensionId: string): Promise<StoredCategory> {
  const worker = await currentWorker(context, extensionId);
  return worker.evaluate(async () => {
    const { 'state:v1': state } = await (globalThis as any).chrome.storage.local.get('state:v1');
    return state.categories.personal;
  });
}

async function blockExampleCom(context: BrowserContext, worker: Worker) {
  const site = await context.newPage();
  await site.goto('https://example.com/');
  await (await openPopupFor(context, worker, site)).getByRole('button', { name: 'Hammer this site' }).click();
  await expect(site).toHaveURL(/block\.html/);
}

/** Flips a toggle on Chrome's own extensions page, the way a user would. */
async function flip(context: BrowserContext, extensionId: string, toggle: 'enable' | 'incognito') {
  const page = await context.newPage();
  await page.goto(`chrome://extensions/?id=${extensionId}`);
  const selector = toggle === 'enable' ? 'extensions-detail-view #enableToggle' : 'extensions-detail-view #allow-incognito cr-toggle';
  await page.locator(selector).click();
  await page.close();
}

test('switching the extension off and on again resets every wall, and says so once', async ({ context, serviceWorker }) => {
  const id = extensionIdOf(serviceWorker);
  await blockExampleCom(context, serviceWorker);
  const before = await personal(context, id);
  expect(before.resetNoticePending).toBeUndefined();

  await flip(context, id, 'enable'); // off
  await flip(context, id, 'enable'); // on again

  await expect.poll(async () => (await personal(context, id)).resetNoticePending, { timeout: 10_000 }).toBe(true);
  const after = await personal(context, id);
  expect(after.stageStartedAt!).toBeGreaterThan(before.stageStartedAt!);

  // The next place the user lands, here the block page, says it gently, once.
  const page = await context.newPage();
  await page.goto('https://example.com/').catch(() => {});
  await expect(page).toHaveURL(/block\.html/);
  await expect(page.getByTestId('reset-notice')).toContainText('You are starting fresh.');
  await expect(page.getByTestId('reset-notice')).not.toContainText(/\d/);

  await expect.poll(async () => (await personal(context, id)).resetNoticePending).toBeUndefined();
  const popup = await openPopupFor(context, await currentWorker(context, id), page);
  await expect(popup.getByRole('button', { name: 'Settings' })).toBeVisible();
  await expect(popup.getByTestId('reset-notice')).toHaveCount(0);
});

test('the popup shows the reset message when it is the first place you look', async ({ context, serviceWorker }) => {
  const id = extensionIdOf(serviceWorker);
  await context.route('https://example.org/**', (route) => route.fulfill({ contentType: 'text/html', body: '<title>x</title>' }));
  await blockExampleCom(context, serviceWorker);

  await flip(context, id, 'enable');
  await flip(context, id, 'enable');
  await expect.poll(async () => (await personal(context, id)).resetNoticePending, { timeout: 10_000 }).toBe(true);

  const elsewhere = await context.newPage();
  await elsewhere.goto('https://example.org/');
  const popup = await openPopupFor(context, await currentWorker(context, id), elsewhere);
  await expect(popup.getByTestId('reset-notice')).toContainText('You are starting fresh.');
  await expect(popup.getByTestId('reset-notice')).toContainText('A slip does not undo what you have learned.');
});

/*
 * Incognito on → off can't be driven here: with a command-line-loaded extension, Chromium
 * unloads it when the incognito switch is flipped and doesn't bring it back. The transitions
 * are covered by unit tests (src/core/tamper.test.ts); check the real flow by hand.
 */
test('incognito access off from the start is a warning, not a reset', async ({ context, serviceWorker }) => {
  const id = extensionIdOf(serviceWorker);
  await blockExampleCom(context, serviceWorker);

  const site = await context.newPage();
  await site.goto('https://example.com/').catch(() => {});
  const popup = await openPopupFor(context, serviceWorker, site);
  await expect(popup.getByTestId('incognito-warning')).toBeVisible();
  await expect(popup.getByRole('button', { name: 'Open the setting' })).toBeVisible();
  expect((await personal(context, id)).resetNoticePending).toBeUndefined();
});

test('a browser restart is not tamper', async () => {
  const userDataDir = mkdtempSync(path.join(tmpdir(), 'hoc-e2e-'));
  try {
    let context = await launchWithExtension(userDataDir);
    const worker = await serviceWorkerOf(context);
    const id = extensionIdOf(worker);
    await blockExampleCom(context, worker);
    const before = await personal(context, id);
    await context.close();

    context = await launchWithExtension(userDataDir);
    await serviceWorkerOf(context);
    // Give the worker time to run its start-up checks.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const after = await personal(context, id);
    expect(after.stageStartedAt).toBe(before.stageStartedAt);
    expect(after.resetNoticePending).toBeUndefined();
    await context.close();
  } finally {
    rmSync(userDataDir, { recursive: true, force: true });
  }
});
