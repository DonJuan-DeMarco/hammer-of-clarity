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

/**
 * Lets every open removal request's cooldown "pass" by moving its stored times back.
 * Only stored data changes; the shipped code has no time hooks. A command still in flight
 * (e.g. the block page logging a visit) can save over the edit, so it's re-applied until it sticks.
 */
export async function finishCooldowns(worker: Worker): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const stuck = await worker.evaluate(async () => {
      const chrome = (globalThis as any).chrome;
      const read = async () => (await chrome.storage.local.get('state:v1'))['state:v1'];
      const state = await read();
      const now = Date.now();
      for (const request of state.removalRequests) {
        request.createdAt = now - 25 * 60 * 60 * 1000;
        request.readyAt = now - 60 * 1000;
        request.expiresAt = now + 23 * 60 * 60 * 1000;
      }
      await chrome.storage.local.set({ 'state:v1': state });
      await new Promise((resolve) => setTimeout(resolve, 300));
      const after = await read();
      return after.removalRequests.every((r: { readyAt: number }) => r.readyAt <= Date.now());
    });
    if (stuck) return;
  }
  throw new Error('finishCooldowns: the edit kept being overwritten');
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
