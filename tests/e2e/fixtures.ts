import { test as base, chromium, type BrowserContext, type Worker } from '@playwright/test';
import path from 'node:path';

const extensionPath = path.resolve('.output/chrome-mv3');

/** Chromium with the built extension loaded. Run `pnpm build` first (`pnpm test:e2e` does). */
export const test = base.extend<{ context: BrowserContext; serviceWorker: Worker }>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    await use(context);
    await context.close();
  },
  serviceWorker: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    await use(worker);
  },
});

export const expect = test.expect;
