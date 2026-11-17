import { describe, expect, it } from 'vitest';
import { isEligible, pendingGraduationAnnouncements } from './graduation';
import { reduce, type Command } from './reducer';
import { DAY_MS } from './stages';
import { initialState } from './state';
import type { Attempt, CategoryId, State } from './types';

const T0 = 1_700_000_000_000;
let n = 0;
const ids = () => `id${++n}`;
const run = (state: State, command: Command, now: number) => reduce(state, command, now, ids);

/** Social, adult and personal all switched on at T0. */
function started(attempts: Attempt[] = []): State {
  let state = run(initialState(), { type: 'enableCategory', category: 'social' }, T0).state;
  state = run(state, { type: 'addBlock', domain: 'reddit.com', reason: 'Evenings are mine' }, T0).state;
  return {
    ...state,
    attempts,
    categories: { ...state.categories, adult: { ...state.categories.adult, enabled: true, stageStartedAt: T0 } },
  };
}

const day = (d: number) => T0 + d * DAY_MS;
const attemptsOn = (category: CategoryId, ...days: number[]): Attempt[] => days.map((d) => ({ category, at: day(d) }));

describe('isEligible', () => {
  it('social, short-video and personal after 66 uninterrupted days', () => {
    const state = started();
    expect(isEligible(state, 'social', day(66) - 1)).toBe(false);
    expect(isEligible(state, 'social', day(66))).toBe(true);
    expect(isEligible(state, 'personal', day(66))).toBe(true);
  });

  it('adult and gambling only after 180 days', () => {
    const state = started();
    expect(isEligible(state, 'adult', day(180) - 1)).toBe(false);
    expect(isEligible(state, 'adult', day(180))).toBe(true);
  });

  it('needs fewer than 3 attempts in that category over the last 30 days', () => {
    expect(isEligible(started(attemptsOn('social', 50, 60)), 'social', day(70))).toBe(true);
    expect(isEligible(started(attemptsOn('social', 50, 60, 69)), 'social', day(70))).toBe(false);
  });

  it('ignores attempts older than 30 days and attempts in other categories', () => {
    expect(isEligible(started(attemptsOn('social', 10, 20, 30)), 'social', day(70))).toBe(true);
    expect(isEligible(started(attemptsOn('adult', 60, 65, 69)), 'social', day(70))).toBe(true);
  });

  it('never for a category that is off or already graduated', () => {
    expect(isEligible(started(), 'gambling', day(400))).toBe(false);
    const graduated = run(started(), { type: 'checkGraduation' }, day(70)).state;
    expect(isEligible(graduated, 'social', day(80))).toBe(false);
  });
});

describe('checkGraduation', () => {
  it('graduates every eligible category and nothing else', () => {
    const { state } = run(started(), { type: 'checkGraduation' }, day(70));

    expect(state.categories.social.graduatedAt).toBe(day(70));
    expect(state.categories.personal.graduatedAt).toBe(day(70));
    expect(state.categories.adult.graduatedAt).toBeUndefined();
  });

  it('changes nothing when nothing is eligible', () => {
    const before = started();
    expect(run(before, { type: 'checkGraduation' }, day(10)).state).toBe(before);
  });

  it('is announced once', () => {
    const graduated = run(started(), { type: 'checkGraduation' }, day(70)).state;
    expect(pendingGraduationAnnouncements(graduated)).toEqual(['social', 'personal']);

    const seen = run(graduated, { type: 'acknowledgeGraduations' }, day(70)).state;
    expect(pendingGraduationAnnouncements(seen)).toEqual([]);
    expect(seen.categories.social.graduatedAt).toBe(day(70));
  });

  it('is lost with a reset', () => {
    const graduated = run(started(), { type: 'checkGraduation' }, day(70)).state;
    const reset = run(graduated, { type: 'tamper' }, day(71)).state;

    expect(reset.categories.social.graduatedAt).toBeUndefined();
    expect(pendingGraduationAnnouncements(reset)).toEqual([]);
  });
});

describe('removal in a graduated category', () => {
  const FIXED = 'I accept what comes with it.';

  it('has no cooldown, but still needs the retype', () => {
    const graduated = run(started(), { type: 'checkGraduation' }, day(70)).state;
    const asked = run(graduated, { type: 'requestRemoval', target: { kind: 'exception', category: 'social', domain: 'x.com' }, fallbackConfirmText: FIXED }, day(71));
    const request = asked.state.removalRequests[0]!;

    expect(request.readyAt).toBe(day(71));
    expect(run(asked.state, { type: 'confirmRemoval', id: request.id, text: 'wrong' }, day(71)).result).toEqual({ ok: false, reason: 'wrongText' });
    expect(run(asked.state, { type: 'confirmRemoval', id: request.id, text: FIXED }, day(71)).result).toEqual({ ok: true });
  });

  it('applies to personal blocks when personal has graduated', () => {
    const graduated = run(started(), { type: 'checkGraduation' }, day(70)).state;
    const blockId = graduated.blocks[0]!.id;
    const asked = run(graduated, { type: 'requestRemoval', target: { kind: 'block', blockId }, fallbackConfirmText: FIXED }, day(71));

    expect(asked.state.removalRequests[0]!.readyAt).toBe(day(71));
  });

  it('a category that has not graduated keeps its cooldown', () => {
    const graduated = run(started(), { type: 'checkGraduation' }, day(70)).state;
    const asked = run(graduated, { type: 'requestRemoval', target: { kind: 'category', category: 'adult' }, fallbackConfirmText: FIXED }, day(71));

    expect(asked.state.removalRequests[0]!.readyAt).toBe(day(78));
  });
});
