/**
 * Removal requests (D11): the slow path for anything that weakens a wall.
 * The wall stays fully up while a request cools down; then the user has 24 hours
 * to retype their reason, or the request quietly expires.
 */
import { CURATED_LISTS, entryKey, isCurated } from './categories';
import { normalizeDomain } from './domain';
import { DAY_MS } from './stages';
import type { CategoryId, CategoryState, RemovalRequest, RemovalTarget, State } from './types';

export const HOUR_MS = 60 * 60 * 1000;
const SHORT_COOLDOWN_MS = DAY_MS;
const LONG_COOLDOWN_MS = 7 * DAY_MS; // whole adult or gambling category (D11)
const CONFIRM_WINDOW_MS = DAY_MS;

/** Categories where one slip costs the most: longer cooldown, and a wrong-list exception never resets (D32). */
const HIGH_STAKES: CategoryId[] = ['adult', 'gambling'];

export type RequestStatus = 'cooling' | 'confirmable' | 'expired';

export function requestStatus(request: RemovalRequest, now: number): RequestStatus {
  if (now < request.readyAt) return 'cooling';
  if (now < request.expiresAt) return 'confirmable';
  return 'expired';
}

export function liveRequests(state: State, now: number): RemovalRequest[] {
  return state.removalRequests.filter((r) => requestStatus(r, now) !== 'expired');
}

/** Same object back when nothing expired, so the reducer can tell "no change". */
export function dropExpired(state: State, now: number): State {
  const live = liveRequests(state, now);
  return live.length === state.removalRequests.length ? state : { ...state, removalRequests: live };
}

/** Retyping is checked word for word, forgiving only spacing. */
export function normalizeConfirmText(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

export function sameTarget(a: RemovalTarget, b: RemovalTarget): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

function canonical(target: RemovalTarget) {
  switch (target.kind) {
    case 'block':
      return ['block', target.blockId];
    case 'category':
      return ['category', target.category];
    case 'exception':
      return ['exception', target.category, target.domain, target.pathPrefix ?? ''];
  }
}

/**
 * The target as it would be stored, if it names something that is currently blocked;
 * otherwise null. Exception domains are normalized here.
 */
export function resolveTarget(state: State, target: RemovalTarget): RemovalTarget | null {
  switch (target.kind) {
    case 'block':
      return state.blocks.some((b) => b.id === target.blockId) ? target : null;
    case 'category':
      return target.category !== 'personal' && state.categories[target.category].enabled ? target : null;
    case 'exception': {
      const category = state.categories[target.category];
      if (target.category === 'personal' || !category.enabled) return null;
      const domain = normalizeDomain(target.domain);
      if (!domain) return null;
      const site = { domain, ...(target.pathPrefix && { pathPrefix: target.pathPrefix }) };
      const key = entryKey(site);
      if (category.exceptions.some((e) => entryKey(e) === key)) return null;
      if (isCurated(target.category) && !CURATED_LISTS[target.category].some((e) => entryKey(e) === key)) return null;
      return { kind: 'exception', category: target.category, ...site };
    }
  }
}

export function cooldownFor(target: RemovalTarget): number {
  return target.kind === 'category' && HIGH_STAKES.includes(target.category) ? LONG_COOLDOWN_MS : SHORT_COOLDOWN_MS;
}

/** The words to retype: the user's own reason for this wall, else the fixed sentence (D23). */
export function confirmTextFor(state: State, target: RemovalTarget, fallback: string): string {
  const reason =
    target.kind === 'block'
      ? state.blocks.find((b) => b.id === target.blockId)?.reason
      : state.categories[target.category].reason;
  return normalizeConfirmText(reason ?? fallback);
}

export function newRequest(id: string, target: RemovalTarget, now: number, confirmText: string, cooldown: number): RemovalRequest {
  const readyAt = now + cooldown;
  return { id, target, createdAt: now, readyAt, expiresAt: readyAt + CONFIRM_WINDOW_MS, confirmText };
}

/** Back to the start of Forging, gently (D10). Graduation is lost with it. */
export function resetCategory(category: CategoryState, now: number): CategoryState {
  const { graduatedAt: _graduated, ...rest } = category;
  return { ...rest, stageStartedAt: now, graduationAnnounced: false, resetNoticePending: true };
}

const offCategory = (): CategoryState => ({ enabled: false, exceptions: [], graduationAnnounced: false });

/** What confirming a request does (SPEC §7.2 table). The target must already be resolved. */
export function applyRemoval(state: State, target: RemovalTarget, now: number): State {
  switch (target.kind) {
    case 'block': {
      const blocks = state.blocks.filter((b) => b.id !== target.blockId);
      const personal = blocks.length > 0 ? resetCategory(state.categories.personal, now) : offCategory();
      return { ...state, blocks, categories: { ...state.categories, personal } };
    }
    case 'category':
      return { ...state, categories: { ...state.categories, [target.category]: offCategory() } };
    case 'exception': {
      const current = state.categories[target.category];
      const exception = { domain: target.domain, ...(target.pathPrefix && { pathPrefix: target.pathPrefix }), addedAt: now };
      const withException = { ...current, exceptions: [...current.exceptions, exception] };
      // A wrongly listed adult or gambling site is the list's mistake, not a slip (D32).
      const next = HIGH_STAKES.includes(target.category) ? withException : resetCategory(withException, now);
      return { ...state, categories: { ...state.categories, [target.category]: next } };
    }
  }
}
