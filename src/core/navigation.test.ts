import { describe, expect, it } from 'vitest';
import { blockDecision, blockPagePath } from './navigation';
import { reduce, type Command } from './reducer';
import { initialState } from './state';
import type { State } from './types';

let n = 0;
const ids = () => `id${++n}`;
const run = (state: State, command: Command) => reduce(state, command, 0, ids).state;

describe('blockDecision', () => {
  it('blocks your own sites, including subdomains, on http and https', () => {
    const state = run(initialState(), { type: 'addBlock', domain: 'news.example' });
    const blockId = state.blocks[0]!.id;

    for (const url of ['https://news.example/', 'http://news.example/a?b=c', 'https://m.news.example/x']) {
      expect(blockDecision(state, url), url).toEqual({ kind: 'personal', blockId });
    }
    expect(blockDecision(state, 'https://news.example.org/')).toBeNull();
    expect(blockDecision(state, 'https://othernews.example/')).toBeNull();
  });

  it('blocks only the path of a path block', () => {
    const state = run(initialState(), { type: 'addBlock', domain: 'youtube.com', pathPrefix: '/shorts' });

    expect(blockDecision(state, 'https://www.youtube.com/shorts/abc')).not.toBeNull();
    expect(blockDecision(state, 'https://www.youtube.com/watch?v=1')).toBeNull();
  });

  it('blocks the sites of hand-picked categories, but not unticked ones', () => {
    const state = run(initialState(), { type: 'enableCategory', category: 'social', excluded: ['reddit.com', 'linkedin.com'] });

    expect(blockDecision(state, 'https://x.com/home')).toEqual({ kind: 'category', category: 'social' });
    expect(blockDecision(state, 'https://www.reddit.com/')).toBeNull();
    expect(blockDecision(state, 'https://www.linkedin.com/')).toBeNull();
  });

  it('your own block wins over a category, so your own reason shows', () => {
    let state = run(initialState(), { type: 'enableCategory', category: 'social' });
    state = run(state, { type: 'addBlock', domain: 'x.com' });

    expect(blockDecision(state, 'https://x.com/')).toMatchObject({ kind: 'personal' });
  });

  it('catches adult keywords in the hostname while adult is on, except sites let through', () => {
    const off = initialState();
    const on = run(off, { type: 'enableCategory', category: 'adult' });
    const letThrough: State = {
      ...on,
      categories: { ...on.categories, adult: { ...on.categories.adult, exceptions: [{ domain: 'pornhistory.example', addedAt: 0 }] } },
    };

    expect(blockDecision(off, 'https://freeporn.example/')).toBeNull();
    expect(blockDecision(on, 'https://freeporn.example/')).toEqual({ kind: 'category', category: 'adult' });
    expect(blockDecision(on, 'https://www.google.com/search?q=porn+addiction+help')).toBeNull();
    expect(blockDecision(letThrough, 'https://pornhistory.example/')).toBeNull();
  });

  it('ignores anything that is not a web page', () => {
    const state = run(initialState(), { type: 'addBlock', domain: 'news.example' });

    expect(blockDecision(state, 'chrome://extensions/')).toBeNull();
    expect(blockDecision(state, 'chrome-extension://abc/block.html?b=x')).toBeNull();
    expect(blockDecision(state, 'not a url')).toBeNull();
  });
});

describe('blockPagePath', () => {
  it('matches what the blocking rules redirect to', () => {
    expect(blockPagePath({ kind: 'personal', blockId: 'a b' })).toBe('/block.html?b=a%20b');
    expect(blockPagePath({ kind: 'category', category: 'short-video' })).toBe('/block.html?c=short-video');
  });
});
