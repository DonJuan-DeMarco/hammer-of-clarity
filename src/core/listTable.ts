/**
 * The on-device lookup table for the adult and gambling lists (#16). The safety net (#15) asks it
 * whether a tab's host, or any parent domain, is listed. The table itself lives in IndexedDB; this
 * file holds the pure decisions around it.
 */
import type { BlockDecision } from './navigation';
import { LIST_CATEGORIES, type ListCategoryId } from './rules';
import type { State } from './types';

/** Which list a category's table should hold, or null when it should be empty. */
export type TableSource = 'bundled' | 'refreshed';

/** The host and each parent domain down to two labels, matching how list entries cover subdomains. */
export function hostSuffixes(host: string): string[] {
  const labels = host.toLowerCase().replace(/\.$/, '').split('.');
  const suffixes: string[] = [];
  for (let i = 0; i <= labels.length - 2; i++) suffixes.push(labels.slice(i).join('.'));
  return suffixes;
}

/** The table follows the list actually blocking: the downloaded one if installed and refresh is on. */
export function desiredListTables(state: State): Record<ListCategoryId, TableSource | null> {
  const desired = {} as Record<ListCategoryId, TableSource | null>;
  for (const category of LIST_CATEGORIES) {
    desired[category] = !state.categories[category].enabled
      ? null
      : state.lists.refreshEnabled && state.lists.installed?.[category]
        ? 'refreshed'
        : 'bundled';
  }
  return desired;
}

/**
 * Given which lists contain the address's host (or a parent), whether to block it: adult before
 * gambling (rule priority order), only for categories that are on, never for a site let through.
 */
export function listDecision(state: State, address: string, listedIn: ListCategoryId[]): BlockDecision | null {
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const host = url.hostname;
  for (const category of LIST_CATEGORIES) {
    const categoryState = state.categories[category];
    if (!listedIn.includes(category) || !categoryState.enabled) continue;
    const letThrough = categoryState.exceptions.some((e) => host === e.domain || host.endsWith(`.${e.domain}`));
    if (!letThrough) return { kind: 'category', category };
  }
  return null;
}
