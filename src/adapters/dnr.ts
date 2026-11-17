import { browser, type Browser } from 'wxt/browser';
import { LIST_RULE_IDS } from '../core/refresh';
import { LIST_CATEGORIES, type DnrRule, type ListCategoryId } from '../core/rules';

/**
 * Ids `buildRules` may use. Chrome allows at most 5,000 redirect rules per extension anyway,
 * so this covers every possible state. Listing them avoids reading the dynamic rules back,
 * which would copy a ~10 MB downloaded list on every change.
 */
const STATE_RULE_IDS = Array.from({ length: 10_000 }, (_, i) => i + 1);

export interface ListPlan {
  staticOn: ListCategoryId[];
  dynamicKeep: ListCategoryId[];
}

/**
 * Makes the browser's rules match: the rules built from state are replaced, each list
 * category uses the list the plan says (bundled static ruleset or downloaded dynamic rule),
 * and downloaded rules not in the plan are removed. One dynamic update, so no gap.
 */
export async function applyRules(stateRules: DnrRule[], plan: ListPlan): Promise<void> {
  const enabled = await browser.declarativeNetRequest.getEnabledRulesets();
  const sameRulesets = enabled.length === plan.staticOn.length && plan.staticOn.every((id) => enabled.includes(id));
  if (!sameRulesets) {
    await browser.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: plan.staticOn,
      disableRulesetIds: LIST_CATEGORIES.filter((id) => !plan.staticOn.includes(id)),
    });
  }
  const dropLists = LIST_CATEGORIES.filter((id) => !plan.dynamicKeep.includes(id)).map((id) => LIST_RULE_IDS[id]);
  await browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [...STATE_RULE_IDS, ...dropLists],
    addRules: stateRules as Browser.declarativeNetRequest.Rule[],
  });
}

/** Installs (or replaces) a category's downloaded list in one call, so there's no gap in blocking. */
export async function installListRule(category: ListCategoryId, rule: DnrRule): Promise<void> {
  const id = LIST_RULE_IDS[category];
  await browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [id],
    addRules: [{ ...rule, id } as Browser.declarativeNetRequest.Rule],
  });
}
