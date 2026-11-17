/**
 * Keeping the adult and gambling lists fresh (D16). The bundled snapshot ships in the
 * extension as a static ruleset; a weekly download, when on, replaces it with a dynamic
 * rule. Only plain domain text is ever fetched; rules are built here.
 */
import { LIST_CATEGORIES, type ListCategoryId } from './rules';
import type { State } from './types';

/** Sources (D20), shared by the build and the weekly refresh. Both GPLv3. */
export const LIST_SOURCES: Record<ListCategoryId, { url: string; minimumDomains: number }> = {
  adult: { url: 'https://nsfw.oisd.nl/domainswild2', minimumDomains: 100_000 },
  gambling: {
    url: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/wildcard/gambling.medium-onlydomains.txt',
    minimumDomains: 20_000,
  },
};

/** Ids for the downloaded lists' dynamic rules, far above the ids `buildRules` hands out. */
export const LIST_RULE_IDS: Record<ListCategoryId, number> = { adult: 1_000_001, gambling: 1_000_002 };

/**
 * A truncated or broken download must never replace a good list: refuse anything under the
 * category's floor, or less than half of what's installed now.
 */
export function acceptRefreshedList(category: ListCategoryId, domains: number, installedDomains: number | undefined): boolean {
  if (domains < LIST_SOURCES[category].minimumDomains) return false;
  return installedDomains === undefined || domains >= installedDomains / 2;
}

/**
 * Which list each enabled category uses: its downloaded dynamic rule if one is installed and
 * refresh is on, otherwise the bundled static ruleset. Anything not listed is removed.
 */
export function listRulePlan(state: State): { staticOn: ListCategoryId[]; dynamicKeep: ListCategoryId[] } {
  const enabled = LIST_CATEGORIES.filter((c) => state.categories[c].enabled);
  const dynamicKeep = state.lists.refreshEnabled ? enabled.filter((c) => state.lists.installed?.[c]) : [];
  return { staticOn: enabled.filter((c) => !dynamicKeep.includes(c)), dynamicKeep };
}

export function recordRefreshedList(state: State, category: ListCategoryId, domains: number, now: number): State {
  if (!state.lists.refreshEnabled || !state.categories[category].enabled) return state;
  return {
    ...state,
    lists: {
      ...state.lists,
      lastRefreshedAt: now,
      installed: { ...state.lists.installed, [category]: { domains, at: now } },
    },
  };
}

/** Instant both ways (D33): it changes how fresh a wall is, not whether it stands. */
export function setListRefresh(state: State, enabled: boolean): State {
  if (state.lists.refreshEnabled === enabled) return state;
  const { installed: _forget, ...rest } = state.lists;
  return { ...state, lists: { ...rest, refreshEnabled: enabled } };
}

/** When a list category turns off, its downloaded rule goes with it. */
export function forgetInstalledList(state: State, category: ListCategoryId): State {
  if (!state.lists.installed?.[category]) return state;
  const { [category]: _gone, ...installed } = state.lists.installed;
  return { ...state, lists: { ...state.lists, installed } };
}
