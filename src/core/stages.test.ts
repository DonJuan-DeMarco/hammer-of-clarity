import { describe, expect, it } from 'vitest';
import { DAY_MS, stageFor } from './stages';
import type { CategoryState } from './types';

const START = 1_700_000_000_000;
const category = (overrides: Partial<CategoryState> = {}): CategoryState => ({
  enabled: true,
  stageStartedAt: START,
  exceptions: [],
  graduationAnnounced: false,
  ...overrides,
});
const onDay = (day: number, extraMs = 0) => START + day * DAY_MS + extraMs;

describe('stageFor', () => {
  it('is Forging from day 0 through the end of day 20', () => {
    expect(stageFor(category(), onDay(0))).toBe('forging');
    expect(stageFor(category(), onDay(20, DAY_MS - 1))).toBe('forging');
  });

  it('is Tempering from day 21 through the end of day 65', () => {
    expect(stageFor(category(), onDay(21))).toBe('tempering');
    expect(stageFor(category(), onDay(65, DAY_MS - 1))).toBe('tempering');
  });

  it('is Clear from day 66 on', () => {
    expect(stageFor(category(), onDay(66))).toBe('clear');
    expect(stageFor(category(), onDay(400))).toBe('clear');
  });

  it('has no stage while the category is off or has never started', () => {
    expect(stageFor(category({ enabled: false }), onDay(30))).toBeNull();
    expect(stageFor(category({ stageStartedAt: undefined }), onDay(30))).toBeNull();
  });

  it('treats a clock set before the start as day 0', () => {
    expect(stageFor(category(), START - DAY_MS)).toBe('forging');
  });
});
