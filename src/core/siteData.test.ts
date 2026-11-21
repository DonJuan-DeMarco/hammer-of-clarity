import { describe, expect, it } from 'vitest';
import { reduce, type Command } from './reducer';
import { blockedSiteDomains, newlyBlockedDomains, originsFor } from './siteData';
import { initialState } from './state';
import type { State } from './types';

let n = 0;
const ids = () => `id${++n}`;
const run = (state: State, command: Command) => reduce(state, command, 0, ids).state;

describe('originsFor', () => {
  it('covers http and https, bare and www', () => {
    expect(originsFor('reddit.com')).toEqual(['https://reddit.com', 'https://www.reddit.com', 'http://reddit.com', 'http://www.reddit.com']);
  });

  it('adds no www for a domain that already starts with it, or for an IP address', () => {
    expect(originsFor('www.only.example')).toEqual(['https://www.only.example', 'http://www.only.example']);
    expect(originsFor('127.0.0.1')).toEqual(['https://127.0.0.1', 'http://127.0.0.1']);
  });
});

describe('blockedSiteDomains', () => {
  it('lists your own blocks and the sites of hand-picked categories that are on, once each', () => {
    let state = run(initialState(), { type: 'addBlock', domain: 'news.example' });
    state = run(state, { type: 'addBlock', domain: 'youtube.com', pathPrefix: '/shorts' });
    state = run(state, { type: 'enableCategory', category: 'short-video' });

    expect(blockedSiteDomains(state)).toEqual(['news.example', 'youtube.com', 'instagram.com', 'facebook.com', 'tiktok.com']);
  });

  it('leaves out unticked sites and categories that are off', () => {
    const state = run(initialState(), { type: 'enableCategory', category: 'social', excluded: ['reddit.com', 'linkedin.com'] });

    expect(blockedSiteDomains(state)).not.toContain('reddit.com');
    expect(blockedSiteDomains(state)).not.toContain('linkedin.com');
    expect(blockedSiteDomains(state)).toContain('x.com');
    expect(blockedSiteDomains(initialState())).toEqual([]);
  });

  it('leaves out the adult and gambling lists (far too many sites; the safety net covers them)', () => {
    const state = run(initialState(), { type: 'enableCategory', category: 'adult' });

    expect(blockedSiteDomains(state)).toEqual([]);
  });
});

describe('newlyBlockedDomains', () => {
  it('is what a change started blocking, nothing already blocked before', () => {
    const before = run(initialState(), { type: 'addBlock', domain: 'news.example' });
    const after = run(run(before, { type: 'addBlock', domain: 'forum.example' }), { type: 'enableCategory', category: 'short-video' });

    expect(newlyBlockedDomains(before, after)).toEqual(['forum.example', 'youtube.com', 'instagram.com', 'facebook.com', 'tiktok.com']);
    expect(newlyBlockedDomains(after, after)).toEqual([]);
  });
});
