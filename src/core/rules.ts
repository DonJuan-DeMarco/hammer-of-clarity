/**
 * Turns State into declarativeNetRequest rules.
 * Pure: no chrome.* access, so it can be tested without a browser.
 */
import { blockedEntries, CURATED_LISTS, type CuratedCategoryId } from './categories';
import type { State } from './types';

/** The subset of a chrome.declarativeNetRequest.Rule this extension emits. */
export interface RedirectRule {
  id: number;
  priority: number;
  action: { type: 'redirect'; redirect: { extensionPath: string } };
  condition: { urlFilter: string; resourceTypes: ('main_frame' | 'sub_frame')[] };
}

/**
 * Higher wins when several rules match. Personal blocks outrank categories so the
 * block page shows the user's own reason for that site.
 */
const PRIORITY = { category: 1, personal: 3 } as const;

export function buildRules(state: State): RedirectRule[] {
  const rules: Omit<RedirectRule, 'id'>[] = [];

  for (const block of state.blocks) {
    rules.push(redirect(block, `b=${encodeURIComponent(block.id)}`, PRIORITY.personal));
  }

  for (const category of Object.keys(CURATED_LISTS) as CuratedCategoryId[]) {
    const categoryState = state.categories[category];
    if (!categoryState.enabled) continue;
    for (const entry of blockedEntries(category, categoryState)) {
      rules.push(redirect(entry, `c=${category}`, PRIORITY.category));
    }
  }

  return rules.map((rule, index) => ({ id: index + 1, ...rule }));
}

function redirect(
  site: { domain: string; pathPrefix?: string },
  query: string,
  priority: number,
): Omit<RedirectRule, 'id'> {
  return {
    priority,
    action: { type: 'redirect', redirect: { extensionPath: `/block.html?${query}` } },
    condition: {
      // `||` matches the domain and its subdomains; `^` stops `a.com` matching `a.community`.
      urlFilter: site.pathPrefix ? `||${site.domain}${site.pathPrefix}` : `||${site.domain}^`,
      resourceTypes: ['main_frame', 'sub_frame'],
    },
  };
}
