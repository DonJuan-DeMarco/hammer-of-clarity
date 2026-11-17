import { describe, expect, it } from 'vitest';
import { reduce, type Command } from './reducer';
import { DAY_MS } from './stages';
import { initialState } from './state';
import type { State } from './types';

const T0 = 1_700_000_000_000;
const LATER = T0 + 40 * DAY_MS;
let n = 0;
const ids = () => `id${++n}`;
const run = (state: State, command: Command, now = LATER) => reduce(state, command, now, ids);

/** Social on since T0 and graduated, personal on since T0, gambling off. */
function lived(): State {
  let state = run(initialState(), { type: 'enableCategory', category: 'social' }, T0).state;
  state = run(state, { type: 'addBlock', domain: 'reddit.com' }, T0).state;
  return {
    ...state,
    categories: { ...state.categories, social: { ...state.categories.social, graduatedAt: T0 + 30 * DAY_MS, graduationAnnounced: true } },
  };
}

describe('tamper', () => {
  it('sends every enabled category back to the start, gently flagged, and only those', () => {
    const before = lived();
    const { state } = run(before, { type: 'tamper' });

    for (const id of ['social', 'personal'] as const) {
      expect(state.categories[id]).toMatchObject({ enabled: true, stageStartedAt: LATER, resetNoticePending: true, graduationAnnounced: false });
      expect(state.categories[id].graduatedAt).toBeUndefined();
    }
    expect(state.categories.gambling).toBe(before.categories.gambling);
  });

  it('keeps everything else: blocks, exceptions, reasons, redirects', () => {
    const before = lived();
    const { state } = run(before, { type: 'tamper' });

    expect(state.blocks).toBe(before.blocks);
    expect(state.categories.social.exceptions).toBe(before.categories.social.exceptions);
  });
});

describe('incognito access', () => {
  const cases: [string, boolean, boolean, 'reset' | 'same' | 'remember'][] = [
    ['first seen on', false, true, 'remember'],
    ['switched off', true, false, 'reset'],
    ['still on', true, true, 'same'],
    ['still off (never allowed yet)', false, false, 'same'],
  ];

  it.each(cases)('%s', (_name, was, allowed, outcome) => {
    const before = { ...lived(), incognitoWasAllowed: was };
    const { state } = run(before, { type: 'incognitoStatus', allowed });

    if (outcome === 'same') expect(state).toBe(before);
    if (outcome === 'remember') {
      expect(state.incognitoWasAllowed).toBe(true);
      expect(state.categories).toBe(before.categories);
    }
    if (outcome === 'reset') {
      expect(state.incognitoWasAllowed).toBe(false);
      expect(state.categories.social.stageStartedAt).toBe(LATER);
      expect(state.categories.social.resetNoticePending).toBe(true);
    }
  });

  it('turning it back on later does not reset again', () => {
    const off = run({ ...lived(), incognitoWasAllowed: true }, { type: 'incognitoStatus', allowed: false }).state;
    const on = run(off, { type: 'incognitoStatus', allowed: true }, LATER + DAY_MS).state;

    expect(on.categories).toBe(off.categories);
    expect(on.incognitoWasAllowed).toBe(true);
  });
});

describe('acknowledgeResets', () => {
  it('clears the notice so it shows once', () => {
    const reset = run(lived(), { type: 'tamper' }).state;
    const seen = run(reset, { type: 'acknowledgeResets' }).state;

    expect(Object.values(seen.categories).some((c) => c.resetNoticePending)).toBe(false);
    expect(run(seen, { type: 'acknowledgeResets' }).state).toBe(seen);
  });
});

describe('single-category resets', () => {
  it('a confirmed removal that resets a category flags the notice for that category only', () => {
    let state = lived();
    const blockId = state.blocks[0]!.id;
    state = run(state, { type: 'addBlock', domain: 'news.example' }, T0).state;
    const asked = run(state, { type: 'requestRemoval', target: { kind: 'block', blockId }, fallbackConfirmText: 'I choose this.' }, T0);
    const done = run(asked.state, { type: 'confirmRemoval', id: (asked.result as { requestId: string }).requestId, text: 'I choose this.' }, T0 + DAY_MS + 1).state;

    expect(done.categories.personal.resetNoticePending).toBe(true);
    expect(done.categories.social.resetNoticePending).toBeUndefined();
  });
});
