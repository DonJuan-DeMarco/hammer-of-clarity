import { browser, type Browser } from 'wxt/browser';
import { LIST_CATEGORIES, type DnrRule, type ListCategoryId } from '../core/rules';

/** Replaces every dynamic rule with the given set. */
export async function replaceDynamicRules(rules: DnrRule[]): Promise<void> {
  const existing = await browser.declarativeNetRequest.getDynamicRules();
  await browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((rule) => rule.id),
    addRules: rules as Browser.declarativeNetRequest.Rule[],
  });
}

/** Switches the bundled adult and gambling rulesets on or off to match. */
export async function setEnabledRulesets(enabled: ListCategoryId[]): Promise<void> {
  await browser.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: enabled,
    disableRulesetIds: LIST_CATEGORIES.filter((id) => !enabled.includes(id)),
  });
}
