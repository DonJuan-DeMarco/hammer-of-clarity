import { describe, expect, it } from 'vitest';
import { reduce, type Command } from './reducer';
import { HOUR_MS, liveRequests, requestStatus } from './removal';
import { DAY_MS } from './stages';
import { initialState } from './state';
import type { RemovalTarget, State } from './types';

const T0 = 1_700_000_000_000;
const FIXED = 'I am choosing to remove this wall, and I accept what comes with it.';
let n = 0;
const ids = () => `id${++n}`;

function run(state: State, command: Command, now = T0) {
  return reduce(state, command, now, ids);
}

/** A state with one personal block (reason "Evenings are mine") and social turned on. */
function setup(): { state: State; blockId: string } {
  let { state, result } = run(initialState(), { type: 'addBlock', domain: 'reddit.com', reason: 'Evenings are mine' });
  state = run(state, { type: 'addBlock', domain: 'news.example' }).state;
  state = run(state, { type: 'enableCategory', category: 'social', reason: 'Scrolling eats my day' }).state;
  return { state, blockId: (result as { blockId: string }).blockId };
}

function request(state: State, target: RemovalTarget, now = T0) {
  const out = run(state, { type: 'requestRemoval', target, fallbackConfirmText: FIXED }, now);
  return { state: out.state, result: out.result, id: (out.result as { requestId?: string }).requestId! };
}

describe('requestRemoval', () => {
  it('starts a 24-hour cooldown for a personal block, asking for its own reason', () => {
    const { state: s, blockId } = setup();
    const { state, id } = request(s, { kind: 'block', blockId });

    expect(state.removalRequests).toEqual([
      {
        id,
        target: { kind: 'block', blockId },
        createdAt: T0,
        readyAt: T0 + DAY_MS,
        expiresAt: T0 + 2 * DAY_MS,
        confirmText: 'Evenings are mine',
      },
    ]);
  });

  it('uses the fixed sentence when there is no reason', () => {
    const { state: s } = setup();
    const noReason = s.blocks.find((b) => b.domain === 'news.example')!;
    const { state } = request(s, { kind: 'block', blockId: noReason.id });

    expect(state.removalRequests[0]!.confirmText).toBe(FIXED);
  });

  it('waits 24 hours for social and short-video, 7 days for adult and gambling', () => {
    const { state: s } = setup();
    const social = request(s, { kind: 'category', category: 'social' }).state.removalRequests[0]!;
    const adultOn: State = {
      ...s,
      categories: { ...s.categories, adult: { ...s.categories.adult, enabled: true, stageStartedAt: T0 } },
    };
    const adult = request(adultOn, { kind: 'category', category: 'adult' }).state.removalRequests[0]!;

    expect(social.readyAt - social.createdAt).toBe(DAY_MS);
    expect(social.confirmText).toBe('Scrolling eats my day');
    expect(adult.readyAt - adult.createdAt).toBe(7 * DAY_MS);
  });

  it('a site inside a category waits 24 hours and asks for the category reason', () => {
    const { state: s } = setup();
    const { state } = request(s, { kind: 'exception', category: 'social', domain: 'x.com' });

    expect(state.removalRequests[0]).toMatchObject({ readyAt: T0 + DAY_MS, confirmText: 'Scrolling eats my day' });
  });

  it('asking twice for the same thing gives back the first request', () => {
    const { state: s, blockId } = setup();
    const first = request(s, { kind: 'block', blockId });
    const second = request(first.state, { kind: 'block', blockId }, T0 + HOUR_MS);

    expect(second.id).toBe(first.id);
    expect(second.state).toBe(first.state);
  });

  it('refuses targets that are not blocked', () => {
    const { state } = setup();

    expect(request(state, { kind: 'block', blockId: 'nope' }).result).toEqual({ ok: false, reason: 'notFound' });
    expect(request(state, { kind: 'category', category: 'gambling' }).result).toEqual({ ok: false, reason: 'notFound' });
    expect(request(state, { kind: 'exception', category: 'social', domain: 'linkedin.com' }).result).toEqual({
      ok: false,
      reason: 'notFound',
    });
    expect(request(state, { kind: 'exception', category: 'social', domain: 'example.org' }).result).toEqual({
      ok: false,
      reason: 'notFound',
    });
  });
});

describe('status over time', () => {
  it('cools, then can be confirmed for 24 hours, then expires and disappears', () => {
    const { state: s, blockId } = setup();
    const { state } = request(s, { kind: 'block', blockId });
    const req = state.removalRequests[0]!;

    expect(requestStatus(req, T0 + DAY_MS - 1)).toBe('cooling');
    expect(requestStatus(req, T0 + DAY_MS)).toBe('confirmable');
    expect(requestStatus(req, T0 + 2 * DAY_MS - 1)).toBe('confirmable');
    expect(requestStatus(req, T0 + 2 * DAY_MS)).toBe('expired');
    expect(liveRequests(state, T0 + 2 * DAY_MS)).toEqual([]);
  });

  it('expired requests are dropped by the next command', () => {
    const { state: s, blockId } = setup();
    const { state } = request(s, { kind: 'block', blockId });
    const later = run(state, { type: 'expireRemovals' }, T0 + 3 * DAY_MS).state;

    expect(later.removalRequests).toEqual([]);
  });
});

describe('confirmRemoval', () => {
  function ready(target: RemovalTarget, state = setup().state) {
    const { state: s, id } = request(state, target);
    return { state: s, id, at: T0 + DAY_MS + HOUR_MS };
  }

  it('refuses before the cooldown ends, after the window closes, or with the wrong text', () => {
    const { state: base, blockId } = setup();
    const { state, id, at } = ready({ kind: 'block', blockId }, base);

    expect(run(state, { type: 'confirmRemoval', id, text: 'Evenings are mine' }, T0 + DAY_MS - 1).result).toEqual({
      ok: false,
      reason: 'notReady',
    });
    expect(run(state, { type: 'confirmRemoval', id, text: 'evenings are mine' }, at).result).toEqual({
      ok: false,
      reason: 'wrongText',
    });
    expect(run(state, { type: 'confirmRemoval', id, text: 'Evenings are mine' }, T0 + 2 * DAY_MS).result).toEqual({
      ok: false,
      reason: 'notFound',
    });
  });

  it('accepts the text with extra spaces around and between words', () => {
    const { state: base, blockId } = setup();
    const { state, id, at } = ready({ kind: 'block', blockId }, base);

    expect(run(state, { type: 'confirmRemoval', id, text: '  Evenings   are mine ' }, at).result).toEqual({ ok: true });
  });

  it('removing a personal block deletes it and restarts the personal stage', () => {
    const { state: base, blockId } = setup();
    const { state, id, at } = ready({ kind: 'block', blockId }, base);
    const after = run(state, { type: 'confirmRemoval', id, text: 'Evenings are mine' }, at).state;

    expect(after.blocks.map((b) => b.domain)).toEqual(['news.example']);
    expect(after.categories.personal).toMatchObject({ enabled: true, stageStartedAt: at });
    expect(after.removalRequests).toEqual([]);
  });

  it('removing the last personal block turns personal off', () => {
    const { state: base, blockId } = setup();
    const state = { ...base, blocks: base.blocks.filter((b) => b.id === blockId) };
    const { state: s, id, at } = ready({ kind: 'block', blockId }, state);
    const after = run(s, { type: 'confirmRemoval', id, text: 'Evenings are mine' }, at).state;

    expect(after.categories.personal.enabled).toBe(false);
    expect(after.categories.personal.stageStartedAt).toBeUndefined();
  });

  it('taking a site out of social adds an exception and restarts social', () => {
    const { state, id, at } = ready({ kind: 'exception', category: 'social', domain: 'x.com' });
    const after = run(state, { type: 'confirmRemoval', id, text: 'Scrolling eats my day' }, at).state;

    expect(after.categories.social.exceptions).toContainEqual({ domain: 'x.com', addedAt: at });
    expect(after.categories.social.stageStartedAt).toBe(at);
  });

  it('taking a wrongly listed site out of adult adds an exception without a reset (D32)', () => {
    const base = setup().state;
    const adultOn: State = {
      ...base,
      categories: { ...base.categories, adult: { ...base.categories.adult, enabled: true, stageStartedAt: T0 - 50 * DAY_MS } },
    };
    const { state, id, at } = ready({ kind: 'exception', category: 'adult', domain: 'wrongly-listed.example' }, adultOn);
    const after = run(state, { type: 'confirmRemoval', id, text: FIXED }, at).state;

    expect(after.categories.adult.exceptions).toEqual([{ domain: 'wrongly-listed.example', addedAt: at }]);
    expect(after.categories.adult.stageStartedAt).toBe(T0 - 50 * DAY_MS);
  });

  it('turning a whole category off clears it completely', () => {
    const { state, id, at } = ready({ kind: 'category', category: 'social' });
    const after = run(state, { type: 'confirmRemoval', id, text: 'Scrolling eats my day' }, at).state;

    expect(after.categories.social).toEqual({ enabled: false, exceptions: [], graduationAnnounced: false });
  });

  it('a request for something already gone is dropped instead of applied', () => {
    const { state: base, blockId } = setup();
    const { state, id, at } = ready({ kind: 'block', blockId }, base);
    const gone: State = { ...state, blocks: state.blocks.filter((b) => b.id !== blockId) };

    expect(run(gone, { type: 'confirmRemoval', id, text: 'Evenings are mine' }, at).result).toEqual({
      ok: false,
      reason: 'notFound',
    });
  });
});

describe('cancelRemoval', () => {
  it('cancels while cooling or while confirmable, and the block stays', () => {
    const { state: s, blockId } = setup();
    const { state, id } = request(s, { kind: 'block', blockId });

    for (const at of [T0 + HOUR_MS, T0 + DAY_MS + HOUR_MS]) {
      const after = run(state, { type: 'cancelRemoval', id }, at).state;
      expect(after.removalRequests).toEqual([]);
      expect(after.blocks).toBe(state.blocks);
    }
  });
});
