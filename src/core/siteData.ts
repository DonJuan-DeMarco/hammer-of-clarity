/**
 * Which sites' saved data (service worker and cached pages) to clear, so their pages can't be
 * served from the browser's own cache, out of sight of the blocking rules (#14).
 *
 * Only your own blocks and the hand-picked categories: the adult and gambling lists are far
 * too large to clear site by site, so they rely on the safety net (#15, #16).
 */
import { blockedEntries, CURATED_LISTS, type CuratedCategoryId } from './categories';
import type { State } from './types';

const IP_ADDRESS = /^\d{1,3}(\.\d{1,3}){3}$/;

/** The origins a domain is usually served from. Clearing works per origin, so list each one. */
export function originsFor(domain: string): string[] {
  const hosts = domain.startsWith('www.') || IP_ADDRESS.test(domain) ? [domain] : [domain, `www.${domain}`];
  return ['https', 'http'].flatMap((scheme) => hosts.map((host) => `${scheme}://${host}`));
}

/** Every site currently blocked by your own blocks or a hand-picked category, once each. */
export function blockedSiteDomains(state: State): string[] {
  const domains = new Set(state.blocks.map((block) => block.domain));
  for (const category of Object.keys(CURATED_LISTS) as CuratedCategoryId[]) {
    if (!state.categories[category].enabled) continue;
    for (const entry of blockedEntries(category, state.categories[category])) domains.add(entry.domain);
  }
  return [...domains];
}

/** Sites a change started blocking. */
export function newlyBlockedDomains(before: State, after: State): string[] {
  const already = new Set(blockedSiteDomains(before));
  return blockedSiteDomains(after).filter((domain) => !already.has(domain));
}
