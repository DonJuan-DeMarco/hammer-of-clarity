/**
 * Named progress (D2, D27). The UI only ever gets a stage name from here, never a
 * number of days: a visible count becomes something to bargain with.
 */
import type { CategoryState } from './types';

export type Stage = 'forging' | 'tempering' | 'clear';

export const STAGES: readonly Stage[] = ['forging', 'tempering', 'clear'];

export const DAY_MS = 24 * 60 * 60 * 1000;

/** First day of each stage after Forging. Day 21 is a milestone, not a scientific claim (D27). */
const TEMPERING_FROM_DAY = 21;
const CLEAR_FROM_DAY = 66;

export function stageFor(category: CategoryState, now: number): Stage | null {
  if (!category.enabled || category.stageStartedAt === undefined) return null;
  const day = Math.max(0, Math.floor((now - category.stageStartedAt) / DAY_MS));
  if (day >= CLEAR_FROM_DAY) return 'clear';
  if (day >= TEMPERING_FROM_DAY) return 'tempering';
  return 'forging';
}
