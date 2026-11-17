import { readFileSync } from 'node:fs';
import type { BrowserContext, Page, Worker } from '@playwright/test';
import { expect, extensionIdOf, test } from './fixtures';

test.describe.configure({ timeout: 90_000 });

const OISD = 'https://nsfw.oisd.nl/domainswild2';
const ONLY_IN_DOWNLOAD = 'refreshed-only.example';

/** A fake download: big enough to pass the 100k floor, made of harmless .example names. */
const FAKE_ADULT_LIST = [
  '# fake list served by the test',
  ...Array.from({ length: 100_000 }, (_, i) => `d${i}.fake-list.example`),
  ONLY_IN_DOWNLOAD,
].join('\n');

/** Pages get a placeholder; no real site ever loads (see adult-gambling.spec.ts). */
async function stubTheWeb(context: BrowserContext, oisd: 'fake' | 'offline') {
  await context.route(/^https?:\/\//, (route) => {
    if (route.request().url() === OISD) {
      return oisd === 'fake' ? route.fulfill({ contentType: 'text/plain', body: FAKE_ADULT_LIST }) : route.abort('internetdisconnected');
    }
    return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>placeholder</title>' });
  });
}

function bundledAdultDomain(): string {
  const [rule] = JSON.parse(readFileSync('.output/chrome-mv3/rulesets/adult.json', 'utf8'));
  return rule.condition.requestDomains.at(-1);
}

async function turnOnAdult(context: BrowserContext, worker: Worker): Promise<Page> {
  const settings = await context.newPage();
  await settings.goto(`chrome-extension://${extensionIdOf(worker)}/options.html`);
  const card = settings.getByTestId('category-adult');
  await card.getByRole('button', { name: 'Block this category' }).click();
  await card.getByRole('button', { name: 'Turn on' }).click();
  await expect(card.getByTestId('stage')).toBeVisible();
  return settings;
}

/** Fires the weekly alarm now (replacing the periodic one is fine inside a test). */
async function runWeeklyRefresh(worker: Worker) {
  await worker.evaluate(() => (globalThis as any).chrome.alarms.create('refresh-lists', { when: Date.now() + 50 }));
}

const lists = (worker: Worker) =>
  worker.evaluate(async () => {
    const chrome = (globalThis as any).chrome;
    const { 'state:v1': state } = await chrome.storage.local.get('state:v1');
    return { meta: state.lists, staticOn: await chrome.declarativeNetRequest.getEnabledRulesets() };
  });

async function blocked(context: BrowserContext, domain: string): Promise<boolean> {
  const page = await context.newPage();
  await page.goto(`https://${domain}/`).catch(() => {});
  return page.url().includes('/block.html?c=adult');
}

test('the weekly refresh swaps the bundled list for the downloaded one', async ({ context, serviceWorker }) => {
  await stubTheWeb(context, 'fake');
  const settings = await turnOnAdult(context, serviceWorker);
  expect(await blocked(context, ONLY_IN_DOWNLOAD)).toBe(false);

  await runWeeklyRefresh(serviceWorker);
  await expect.poll(async () => (await lists(serviceWorker)).meta.installed?.adult?.domains, { timeout: 30_000 }).toBe(100_001);
  expect((await lists(serviceWorker)).staticOn).toEqual([]);

  expect(await blocked(context, ONLY_IN_DOWNLOAD)).toBe(true);
  expect(await blocked(context, bundledAdultDomain())).toBe(false); // the downloaded list replaced the bundled one
  await expect(settings.getByTestId('lists-status')).toContainText('Last updated');

  // Turning refresh off goes straight back to the bundled list.
  await settings.getByLabel('Keep the adult and gambling lists up to date').uncheck();
  await expect.poll(async () => (await lists(serviceWorker)).staticOn).toEqual(['adult']);
  // The bundled list goes on first and the downloaded rule comes off just after (no gap), so wait for both.
  await expect.poll(() => blocked(context, ONLY_IN_DOWNLOAD)).toBe(false);
  expect(await blocked(context, bundledAdultDomain())).toBe(true);
  await expect(settings.getByTestId('lists-status')).toHaveText('Using the lists that came with the extension.');
});

test('a failed download changes nothing and blocking keeps working', async ({ context, serviceWorker }) => {
  await stubTheWeb(context, 'offline');
  await turnOnAdult(context, serviceWorker);

  await runWeeklyRefresh(serviceWorker);
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const after = await lists(serviceWorker);
  expect(after.meta.installed).toBeUndefined();
  expect(after.staticOn).toEqual(['adult']);
  expect(await blocked(context, bundledAdultDomain())).toBe(true);
});
