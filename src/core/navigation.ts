/**
 * The safety net's question (#15): should this address be on the block page? The answer mirrors
 * the blocking rules for your own blocks, the hand-picked categories and the adult keyword rule,
 * for pages that reached the tab without the rules seeing them (a service worker, the back/forward
 * cache). The adult and gambling lists come in #16.
 */
import { blockedEntries, CURATED_LISTS, type CuratedCategoryId } from './categories';
import { ADULT_KEYWORD_REGEX } from './rules';
import type { CategoryId, State } from './types';

export type BlockDecision = { kind: 'personal'; blockId: string } | { kind: 'category'; category: CategoryId };

const ADULT_KEYWORD = new RegExp(ADULT_KEYWORD_REGEX);

/** `domain` itself or any subdomain of it, like the rules' `||domain`. */
function onDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

function covers(site: { domain: string; pathPrefix?: string }, url: URL): boolean {
  return onDomain(url.hostname, site.domain) && (!site.pathPrefix || url.pathname.startsWith(site.pathPrefix));
}

/** Null when the address is not a web page, or nothing blocks it. Same order as rule priorities. */
export function blockDecision(state: State, address: string): BlockDecision | null {
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  const block = state.blocks.find((b) => covers(b, url));
  if (block) return { kind: 'personal', blockId: block.id };

  for (const category of Object.keys(CURATED_LISTS) as CuratedCategoryId[]) {
    const categoryState = state.categories[category];
    if (categoryState.enabled && blockedEntries(category, categoryState).some((entry) => covers(entry, url))) {
      return { kind: 'category', category };
    }
  }

  const adult = state.categories.adult;
  if (adult.enabled && ADULT_KEYWORD.test(`${url.protocol}//${url.host}/`) && !adult.exceptions.some((e) => covers(e, url))) {
    return { kind: 'category', category: 'adult' };
  }

  return null;
}

/** The block page for a decision; the same address the blocking rules redirect to. */
export function blockPagePath(decision: BlockDecision): string {
  return decision.kind === 'personal'
    ? `/block.html?b=${encodeURIComponent(decision.blockId)}`
    : `/block.html?c=${decision.category}`;
}
