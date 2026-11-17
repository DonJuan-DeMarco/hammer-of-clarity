import { browser, type Browser } from 'wxt/browser';
import type { RedirectRule } from '../core/rules';

/** Replaces every dynamic rule with the given set. */
export async function replaceDynamicRules(rules: RedirectRule[]): Promise<void> {
  const existing = await browser.declarativeNetRequest.getDynamicRules();
  await browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((rule) => rule.id),
    addRules: rules as Browser.declarativeNetRequest.Rule[],
  });
}
