import { describe, expect, it } from 'vitest';
import { desiredListTables, hostSuffixes, listDecision } from './listTable';
import { reduce, type Command } from './reducer';
import { initialState } from './state';
import type { State } from './types';

let n = 0;
const ids = () => `id${++n}`;
const run = (state: State, command: Command) => reduce(state, command, 0, ids).state;
const on = (...categories: ('adult' | 'gambling')[]) =>
  categories.reduce((state, category) => run(state, { type: 'enableCategory', category }), initialState());

describe('hostSuffixes', () => {
  it('is the host and each parent domain, down to two labels', () => {
    expect(hostSuffixes('a.b.listed.example')).toEqual(['a.b.listed.example', 'b.listed.example', 'listed.example']);
    expect(hostSuffixes('listed.example')).toEqual(['listed.example']);
    expect(hostSuffixes('LISTED.example.')).toEqual(['listed.example']);
  });
});

describe('desiredListTables', () => {
  it('is empty for categories that are off', () => {
    expect(desiredListTables(initialState())).toEqual({ adult: null, gambling: null });
  });

  it('follows the list in use: bundled until a refresh installs one, bundled again when refresh is off', () => {
    const bundled = on('adult', 'gambling');
    expect(desiredListTables(bundled)).toEqual({ adult: 'bundled', gambling: 'bundled' });

    const refreshed = run(bundled, { type: 'listRefreshed', category: 'adult', domains: 500_000 });
    expect(desiredListTables(refreshed)).toEqual({ adult: 'refreshed', gambling: 'bundled' });

    const offline = run(refreshed, { type: 'setListRefresh', enabled: false });
    expect(desiredListTables(offline)).toEqual({ adult: 'bundled', gambling: 'bundled' });
  });
});

describe('listDecision', () => {
  const url = 'https://www.listed.example/page';

  it('blocks a host listed in a category that is on', () => {
    expect(listDecision(on('gambling'), url, ['gambling'])).toEqual({ kind: 'category', category: 'gambling' });
  });

  it('adult wins over gambling when both list it, like the rule priorities', () => {
    expect(listDecision(on('adult', 'gambling'), url, ['gambling', 'adult'])).toEqual({ kind: 'category', category: 'adult' });
  });

  it('ignores a list whose category is off', () => {
    expect(listDecision(on('gambling'), url, ['adult'])).toBeNull();
  });

  it('never redirects a site that was let through', () => {
    const state = on('adult');
    const letThrough: State = {
      ...state,
      categories: { ...state.categories, adult: { ...state.categories.adult, exceptions: [{ domain: 'listed.example', addedAt: 0 }] } },
    };

    expect(listDecision(letThrough, url, ['adult'])).toBeNull();
  });

  it('nothing for addresses that are not web pages', () => {
    expect(listDecision(on('adult'), 'chrome://extensions/', ['adult'])).toBeNull();
  });
});
