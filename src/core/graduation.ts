/**
 * Graduation (D19): earned trust. A category that has held long enough, with few
 * attempts lately, loses its removal cooldown. The block itself is never lifted,
 * and removing still means retyping the reason.
 */
import { DAY_MS } from './stages';
import type { CategoryId, CategoryState, State } from './types';

/** Uninterrupted days before a category can graduate. Higher stakes, longer wait. */
const DAYS_TO_GRADUATE: Record<CategoryId, number> = {
  social: 66,
  'short-video': 66,
  personal: 66,
  adult: 180,
  gambling: 180,
};

/** Attempts are kept for this long (D24), and graduation looks at the same window. */
export const ATTEMPT_WINDOW_MS = 30 * DAY_MS;
/** Graduation needs fewer than this many attempts in the window. */
const ATTEMPT_LIMIT = 3;

export function isEligible(state: State, id: CategoryId, now: number): boolean {
  const category = state.categories[id];
  if (!category.enabled || category.stageStartedAt === undefined || category.graduatedAt !== undefined) return false;
  if (now - category.stageStartedAt < DAYS_TO_GRADUATE[id] * DAY_MS) return false;
  const recent = state.attempts.filter((a) => a.category === id && a.at > now - ATTEMPT_WINDOW_MS).length;
  return recent < ATTEMPT_LIMIT;
}

export function isGraduated(state: State, id: CategoryId): boolean {
  return state.categories[id].graduatedAt !== undefined;
}

/** Same object back when nobody graduates. */
export function graduateEligible(state: State, now: number): State {
  const ids = (Object.keys(state.categories) as CategoryId[]).filter((id) => isEligible(state, id, now));
  if (ids.length === 0) return state;
  return mapCategories(state, ids, (c) => ({ ...c, graduatedAt: now, graduationAnnounced: false }));
}

/** Graduations the user hasn't been told about yet, in display order. */
export function pendingGraduationAnnouncements(state: State): CategoryId[] {
  return (Object.keys(state.categories) as CategoryId[]).filter((id) => {
    const c = state.categories[id];
    return c.graduatedAt !== undefined && !c.graduationAnnounced;
  });
}

export function acknowledgeGraduations(state: State): State {
  const ids = pendingGraduationAnnouncements(state);
  if (ids.length === 0) return state;
  return mapCategories(state, ids, (c) => ({ ...c, graduationAnnounced: true }));
}

function mapCategories(state: State, ids: CategoryId[], update: (c: CategoryState) => CategoryState): State {
  const categories = { ...state.categories };
  for (const id of ids) categories[id] = update(categories[id]);
  return { ...state, categories };
}
