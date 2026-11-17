import { describe, expect, it } from 'vitest';
import { acceptRefreshedList, LIST_SOURCES, listRulePlan } from './refresh';
import { reduce, type Command } from './reducer';
import { initialState } from './state';
import type { State } from './types';

const NOW = 1_700_000_000_000;
let n = 0;
const ids = () => `id${++n}`;
const run = (state: State, command: Command, now = NOW) => reduce(state, command, now, ids);
const on = (...categories: ('adult' | 'gambling')[]) =>
  categories.reduce((state, category) => run(state, { type: 'enableCategory', category }).state, initialState());

describe('acceptRefreshedList', () => {
  it('refuses a list under the floor for its category', () => {
    expect(acceptRefreshedList('adult', LIST_SOURCES.adult.minimumDomains - 1, undefined)).toBe(false);
    expect(acceptRefreshedList('adult', LIST_SOURCES.adult.minimumDomains, undefined)).toBe(true);
  });

  it('refuses a list less than half the size of the one installed (a truncated download)', () => {
    expect(acceptRefreshedList('gambling', 49_999, 100_000)).toBe(false);
    expect(acceptRefreshedList('gambling', 50_000, 100_000)).toBe(true);
  });
});

describe('listRulePlan', () => {
  it('uses the bundled lists until a refresh has installed one', () => {
    expect(listRulePlan(on('adult', 'gambling'))).toEqual({ staticOn: ['adult', 'gambling'], dynamicKeep: [] });
  });

  it('swaps a category to its downloaded list once installed', () => {
    const state = run(on('adult', 'gambling'), { type: 'listRefreshed', category: 'adult', domains: 500_000 }).state;
    expect(listRulePlan(state)).toEqual({ staticOn: ['gambling'], dynamicKeep: ['adult'] });
  });

  it('uses only the bundled lists when refresh is off', () => {
    let state = run(on('adult', 'gambling'), { type: 'listRefreshed', category: 'adult', domains: 500_000 }).state;
    state = run(state, { type: 'setListRefresh', enabled: false }).state;
    expect(listRulePlan(state)).toEqual({ staticOn: ['adult', 'gambling'], dynamicKeep: [] });
  });

  it('nothing at all for categories that are off', () => {
    expect(listRulePlan(initialState())).toEqual({ staticOn: [], dynamicKeep: [] });
  });
});

describe('list refresh commands', () => {
  it('records an installed list and when', () => {
    const { state } = run(on('adult'), { type: 'listRefreshed', category: 'adult', domains: 500_000 });
    expect(state.lists).toEqual({ refreshEnabled: true, lastRefreshedAt: NOW, installed: { adult: { domains: 500_000, at: NOW } } });
  });

  it('ignores a refresh for a category that is off, or while refresh is off', () => {
    const off = initialState();
    expect(run(off, { type: 'listRefreshed', category: 'adult', domains: 500_000 }).state).toBe(off);
    const refreshOff = run(on('adult'), { type: 'setListRefresh', enabled: false }).state;
    expect(run(refreshOff, { type: 'listRefreshed', category: 'adult', domains: 500_000 }).state).toBe(refreshOff);
  });

  it('turning refresh off forgets installed lists; turning it on is instant too', () => {
    const installed = run(on('adult'), { type: 'listRefreshed', category: 'adult', domains: 500_000 }).state;
    const off = run(installed, { type: 'setListRefresh', enabled: false }).state;
    expect(off.lists).toEqual({ refreshEnabled: false, lastRefreshedAt: NOW });
    expect(run(off, { type: 'setListRefresh', enabled: true }).state.lists.refreshEnabled).toBe(true);
  });

  it('turning a category off forgets its installed list, so turning it on again starts from the bundled one', () => {
    const installed = run(on('adult'), { type: 'listRefreshed', category: 'adult', domains: 500_000 }).state;
    const asked = run(installed, { type: 'requestRemoval', target: { kind: 'category', category: 'adult' }, fallbackConfirmText: 'I choose.' });
    const id = (asked.result as { requestId: string }).requestId;
    const later = NOW + 7 * 24 * 60 * 60 * 1000 + 1;
    const off = run(asked.state, { type: 'confirmRemoval', id, text: 'I choose.' }, later).state;

    expect(off.lists.installed?.adult).toBeUndefined();
    expect(listRulePlan(run(off, { type: 'enableCategory', category: 'adult' }, later).state)).toEqual({
      staticOn: ['adult'],
      dynamicKeep: [],
    });
  });
});
