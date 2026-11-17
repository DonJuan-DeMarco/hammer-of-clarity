// Spike (ticket 02). Only real navigation is to a harmless synthetic domain;
// real list domains are checked with testMatchOutcome, which loads nothing.
import { expect, test } from './fixtures';

const LAST_REAL = 'https://zzzzzc.cn/';
const SUBDOMAIN = 'https://www.zzzzzc.cn/some/path';
const NOT_LISTED = 'https://example.org/';
const SYNTHETIC = 'https://spike-test.example/';

for (const mode of ['static', 'dynamic-1', 'dynamic-10'] as const) {
  test(`${mode}: ~493k domains block`, async ({ context, serviceWorker }) => {
    const result = await serviceWorker.evaluate(async (m) => {
      const g = globalThis as any;
      if (m === 'static') return g.spikeEnableStatic();
      return g.spikeInstallDynamic(m === 'dynamic-1' ? 1 : 10);
    }, mode);
    console.log(mode, JSON.stringify(result));

    const match = (url: string) => serviceWorker.evaluate((u) => (globalThis as any).spikeMatches(u), url);
    expect(await match(LAST_REAL)).not.toEqual([]);
    expect(await match(SUBDOMAIN)).not.toEqual([]);
    expect(await match(NOT_LISTED)).toEqual([]);

    const page = await context.newPage();
    const t0 = Date.now();
    await page.goto(SYNTHETIC).catch(() => {}); // redirect may surface as an aborted navigation
    await expect(page).toHaveURL(/block\.html\?c=adult$/);
    console.log(mode, 'navigation-to-block-page ms', Date.now() - t0);

    const memory = await serviceWorker.evaluate(() => (performance as any).memory?.usedJSHeapSize ?? null);
    console.log(mode, 'sw heap bytes', memory);
  });
}

test('replace + static rule count', async ({ serviceWorker }) => {
  const out = await serviceWorker.evaluate(async () => {
    const g = globalThis as any;
    const before = await chrome.declarativeNetRequest.getAvailableStaticRuleCount();
    await g.spikeEnableStatic();
    const after = await chrome.declarativeNetRequest.getAvailableStaticRuleCount();
    await g.spikeInstallDynamic(1);
    // Refresh scenario: swap the big dynamic rule for a new one in a single call.
    const text = await (await fetch(chrome.runtime.getURL('/spike/adult.txt'))).text();
    const t0 = performance.now();
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [1000],
      addRules: [{
        id: 1000, priority: 1,
        action: { type: 'redirect', redirect: { extensionPath: '/block.html?c=adult' } },
        condition: { requestDomains: text.split('\n'), resourceTypes: ['main_frame'] },
      }],
    } as any);
    const replaceMs = Math.round(performance.now() - t0);
    return { availableStaticBefore: before, availableStaticAfter: after, replaceMs };
  });
  console.log('replace/count', JSON.stringify(out));
});
