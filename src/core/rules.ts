/**
 * Turns State into declarativeNetRequest rules.
 * Pure: no chrome.* access, so it can be tested without a browser.
 *
 * The big adult and gambling domain lists are static rulesets built at build time
 * (see `listRulesetRule`); this file only switches them on and off and adds the
 * small rules around them.
 */
import { blockedEntries, CURATED_LISTS, type CuratedCategoryId } from './categories';
import type { CategoryId, State } from './types';

export type ListCategoryId = Extract<CategoryId, 'adult' | 'gambling'>;
export const LIST_CATEGORIES: ListCategoryId[] = ['adult', 'gambling'];

/**
 * Higher wins when several rules match; at equal priority `allow` beats `redirect`.
 * - An exception (a wrongly listed site, D32) is an `allow` just above its own list,
 *   so it never cancels a hand-picked category or one of your own blocks.
 * - Personal blocks are on top so the block page shows your own reason.
 */
export const PRIORITY = {
  gambling: 1,
  gamblingException: 2,
  adult: 3,
  adultException: 4,
  curated: 5,
  personal: 6,
} as const;

/** Adult only (D6): a keyword anywhere in the hostname, never the path or query. */
export const ADULT_KEYWORD_REGEX = '^https?://[^/]*(porn|xxx|hentai)';

const RESOURCE_TYPES: ('main_frame' | 'sub_frame')[] = ['main_frame', 'sub_frame'];

/** The subset of a chrome.declarativeNetRequest.Rule this extension emits. */
export interface DnrRule {
  id: number;
  priority: number;
  action: { type: 'redirect'; redirect: { extensionPath: string } } | { type: 'allow' };
  condition: {
    urlFilter?: string;
    regexFilter?: string;
    requestDomains?: string[];
    resourceTypes: ('main_frame' | 'sub_frame')[];
  };
}

type Site = { domain: string; pathPrefix?: string };

export function buildRules(state: State): DnrRule[] {
  const rules: Omit<DnrRule, 'id'>[] = [];

  for (const block of state.blocks) {
    rules.push(redirect(urlFilterRule(block), `b=${encodeURIComponent(block.id)}`, PRIORITY.personal));
  }

  for (const category of Object.keys(CURATED_LISTS) as CuratedCategoryId[]) {
    const categoryState = state.categories[category];
    if (!categoryState.enabled) continue;
    for (const entry of blockedEntries(category, categoryState)) {
      rules.push(redirect(urlFilterRule(entry), `c=${category}`, PRIORITY.curated));
    }
  }

  if (state.categories.adult.enabled) {
    rules.push(redirect({ regexFilter: ADULT_KEYWORD_REGEX, resourceTypes: RESOURCE_TYPES }, 'c=adult', PRIORITY.adult));
  }

  for (const category of LIST_CATEGORIES) {
    const categoryState = state.categories[category];
    if (!categoryState.enabled) continue;
    for (const exception of categoryState.exceptions) {
      rules.push({ priority: PRIORITY[`${category}Exception`], action: { type: 'allow' }, condition: urlFilterRule(exception) });
    }
  }

  return rules.map((rule, index) => ({ id: index + 1, ...rule }));
}

/** The static rulesets (one per list category) that should be on. */
export function enabledRulesets(state: State): ListCategoryId[] {
  return LIST_CATEGORIES.filter((category) => state.categories[category].enabled);
}

/** The single rule inside a list category's static ruleset: every domain, one redirect. */
export function listRulesetRule(category: ListCategoryId, domains: string[]): DnrRule {
  return {
    id: 1,
    priority: PRIORITY[category],
    action: { type: 'redirect', redirect: { extensionPath: `/block.html?c=${category}` } },
    condition: { requestDomains: domains, resourceTypes: RESOURCE_TYPES },
  };
}

function urlFilterRule(site: Site): DnrRule['condition'] {
  // `||` matches the domain and its subdomains; `^` stops `a.com` matching `a.community`.
  return {
    urlFilter: site.pathPrefix ? `||${site.domain}${site.pathPrefix}` : `||${site.domain}^`,
    resourceTypes: RESOURCE_TYPES,
  };
}

function redirect(condition: DnrRule['condition'], query: string, priority: number): Omit<DnrRule, 'id'> {
  return { priority, action: { type: 'redirect', redirect: { extensionPath: `/block.html?${query}` } }, condition };
}
