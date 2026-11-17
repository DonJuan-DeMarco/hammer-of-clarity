import { test as base, chromium, type BrowserContext, type Page, type Worker } from '@playwright/test';
import path from 'node:path';

const extensionPath = path.resolve('.output/chrome-mv3');

/** Chromium with the built extension loaded. Run `pnpm build` first (`pnpm test:e2e` does). */
export function launchWithExtension(userDataDir = ''): Promise<BrowserContext> {
  return chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
}

export async function serviceWorkerOf(context: BrowserContext): Promise<Worker> {
  return context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
}

export function extensionIdOf(worker: Worker): string {
  return new URL(worker.url()).host;
}

/** Opens the popup page aimed at `target` (a real toolbar popup can't be opened from Playwright). */
export async function openPopupFor(context: BrowserContext, worker: Worker, target: Page): Promise<Page> {
  const targetUrl = target.url();
  const tabId = await worker.evaluate(async (url) => {
    const tabs = await (globalThis as any).chrome.tabs.query({});
    return tabs.find((t: { url?: string }) => t.url === url)?.id as number;
  }, targetUrl);
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionIdOf(worker)}/popup.html?tabId=${tabId}`);
  return popup;
}

export const test = base.extend<{ context: BrowserContext; serviceWorker: Worker }>({
  context: async ({}, use) => {
    const context = await launchWithExtension();
    await use(context);
    await context.close();
  },
  serviceWorker: async ({ context }, use) => {
    await use(await serviceWorkerOf(context));
  },
});

export const expect = test.expect;
