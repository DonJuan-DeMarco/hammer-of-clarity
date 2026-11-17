import { browser } from 'wxt/browser';
import { buildRules } from '../core/rules';
import { replaceDynamicRules } from '../adapters/dnr';

// Tracer bullet (ticket 01): one hard-coded block. Ticket 03 replaces this with real state.
const TRACER_BLOCKS = [{ id: 'test', domain: 'example.com' }];

// --- Spike (ticket 02): hooks Playwright calls via serviceWorker.evaluate. Not for main. ---
const ADULT_RULE_ID = 1000;

async function spikeEnableStatic() {
  const t0 = performance.now();
  await browser.declarativeNetRequest.updateEnabledRulesets({ enableRulesetIds: ['adult'] });
  return { ms: Math.round(performance.now() - t0) };
}

async function spikeInstallDynamic(chunks = 1) {
  const t0 = performance.now();
  const text = await (await fetch(browser.runtime.getURL('/spike/adult.txt' as never))).text();
  const domains = text.split('\n');
  const tFetched = performance.now();
  const size = Math.ceil(domains.length / chunks);
  const addRules = Array.from({ length: chunks }, (_, i) => ({
    id: ADULT_RULE_ID + i,
    priority: 1,
    action: { type: 'redirect' as const, redirect: { extensionPath: '/block.html?c=adult' } },
    condition: {
      requestDomains: domains.slice(i * size, (i + 1) * size),
      resourceTypes: ['main_frame' as const, 'sub_frame' as const],
    },
  }));
  const tBuilt = performance.now();
  await browser.declarativeNetRequest.updateDynamicRules({ addRules });
  const tInstalled = performance.now();
  return {
    domains: domains.length,
    chunks,
    fetchMs: Math.round(tFetched - t0),
    buildMs: Math.round(tBuilt - tFetched),
    installMs: Math.round(tInstalled - tBuilt),
  };
}

async function spikeMatches(url: string) {
  const outcome = await browser.declarativeNetRequest.testMatchOutcome({
    url,
    type: 'main_frame',
    tabId: -1,
  } as never);
  return outcome.matchedRules.map((r) => ({ ruleId: r.ruleId, rulesetId: r.rulesetId }));
}
// --- end spike ---

export default defineBackground(() => {
  Object.assign(globalThis, { spikeEnableStatic, spikeInstallDynamic, spikeMatches });

  browser.runtime.onInstalled.addListener(() => {
    void replaceDynamicRules(buildRules(TRACER_BLOCKS));
  });
});
