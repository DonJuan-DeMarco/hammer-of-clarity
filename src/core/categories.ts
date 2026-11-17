/** Hand-curated category lists (SPEC §6.3, D21). Adult and gambling come from downloaded lists (ticket 05). */
import type { CategoryId, CategoryState, Exception } from './types';

export interface SiteEntry {
  domain: string;
  pathPrefix?: string;
  /** Unticked at setup unless the user ticks it, e.g. LinkedIn, usually needed for work. */
  defaultExcluded?: boolean;
}

export type CuratedCategoryId = 'social' | 'short-video';

export const CURATED_LISTS: Record<CuratedCategoryId, SiteEntry[]> = {
  social: [
    { domain: 'facebook.com' },
    { domain: 'instagram.com' },
    { domain: 'x.com' },
    { domain: 'twitter.com' },
    { domain: 'reddit.com' },
    { domain: 'tiktok.com' },
    { domain: 'snapchat.com' },
    { domain: 'threads.net' },
    { domain: 'pinterest.com' },
    { domain: 'tumblr.com' },
    { domain: 'linkedin.com', defaultExcluded: true },
  ],
  'short-video': [
    { domain: 'youtube.com', pathPrefix: '/shorts' },
    // `/reel` covers both single reels (/reel/<id>) and the feed (/reels/).
    { domain: 'instagram.com', pathPrefix: '/reel' },
    { domain: 'facebook.com', pathPrefix: '/reel' },
    { domain: 'tiktok.com' },
  ],
};

export function isCurated(category: CategoryId): category is CuratedCategoryId {
  return category in CURATED_LISTS;
}

/** How a site is named in commands and checklists: `domain` or `domain/path`. */
export function entryKey(entry: { domain: string; pathPrefix?: string }): string {
  return entry.domain + (entry.pathPrefix ?? '');
}

/** The sites a curated category actually blocks: its list minus its exceptions. */
export function blockedEntries(category: CuratedCategoryId, state: CategoryState): SiteEntry[] {
  const excluded = new Set(state.exceptions.map(entryKey));
  return CURATED_LISTS[category].filter((entry) => !excluded.has(entryKey(entry)));
}

/** Turns the keys unticked at setup into exceptions. Unknown keys are ignored. */
export function exceptionsFor(category: CuratedCategoryId, excludedKeys: string[] | undefined, now: number): Exception[] {
  const list = CURATED_LISTS[category];
  const excluded = excludedKeys
    ? list.filter((entry) => excludedKeys.includes(entryKey(entry)))
    : list.filter((entry) => entry.defaultExcluded);
  return excluded.map((entry) => ({
    domain: entry.domain,
    ...(entry.pathPrefix && { pathPrefix: entry.pathPrefix }),
    addedAt: now,
  }));
}
