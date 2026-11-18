/**
 * Tamper (D1, D13, D14): the extension can't stop being switched off, only notice afterwards.
 * Every wall was down at once, so every wall goes back to the start, gently (D10).
 */
import { resetCategory } from './removal';
import type { CategoryId, CategoryState, State } from './types';

export function resetAll(state: State, now: number): State {
  const categories = Object.fromEntries(
    Object.entries(state.categories).map(([id, category]) => [id, category.enabled ? resetCategory(category, now) : category]),
  ) as Record<CategoryId, CategoryState>;
  return { ...state, categories };
}

/**
 * Incognito access is the easiest way around every wall. Only switching it *off* after it was
 * on counts as tamper; not having turned it on yet just means setup isn't finished.
 */
export function applyIncognitoStatus(state: State, allowed: boolean, now: number): State {
  if (allowed === state.incognitoWasAllowed) return state;
  if (allowed) return { ...state, incognitoWasAllowed: true };
  return { ...resetAll(state, now), incognitoWasAllowed: false };
}

/**
 * Site access (1.0.1): Chrome lets the user limit an extension to "On click" or "On specific
 * sites". Blocking then silently stops, so limiting it after it was full counts as tamper,
 * exactly like switching incognito access off.
 */
export function applySiteAccessStatus(state: State, full: boolean, now: number): State {
  if (full) return state.siteAccessWasFull === true ? state : { ...state, siteAccessWasFull: true };
  if (state.siteAccessWasFull === true) return { ...resetAll(state, now), siteAccessWasFull: false };
  return state.siteAccessWasFull === false ? state : { ...state, siteAccessWasFull: false };
}

export type ProtectionGap = 'incognito' | 'siteAccess';

/** Side doors currently open, for the toolbar badge and the popup's warnings. */
export function protectionGaps(state: State): ProtectionGap[] {
  const gaps: ProtectionGap[] = [];
  if (!state.incognitoWasAllowed) gaps.push('incognito');
  if (state.siteAccessWasFull === false) gaps.push('siteAccess');
  return gaps;
}

export function acknowledgeResets(state: State): State {
  if (!Object.values(state.categories).some((c) => c.resetNoticePending)) return state;
  const categories = Object.fromEntries(
    Object.entries(state.categories).map(([id, { resetNoticePending: _seen, ...category }]) => [id, category]),
  ) as Record<CategoryId, CategoryState>;
  return { ...state, categories };
}

/** Categories whose reset hasn't been acknowledged yet, in display order. */
export function pendingResets(state: State): CategoryId[] {
  return (Object.keys(state.categories) as CategoryId[]).filter((id) => state.categories[id].resetNoticePending);
}
