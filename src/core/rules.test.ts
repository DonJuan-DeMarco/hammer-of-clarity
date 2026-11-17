import { describe, expect, it } from 'vitest';
import { reduce } from './reducer';
import { buildRules } from './rules';
import { initialState } from './state';
import type { Block, State } from './types';

const block = (id: string, domain: string, pathPrefix?: string): Block => ({ id, domain, pathPrefix, createdAt: 0 });
const withBlocks = (...blocks: Block[]): State => ({ ...initialState(), blocks });

describe('buildRules: personal blocks', () => {
  it('turns a whole-domain block into a redirect to the block page', () => {
    expect(buildRules(withBlocks(block('b1', 'example.com')))).toEqual([
      {
        id: 1,
        priority: 3,
        action: { type: 'redirect', redirect: { extensionPath: '/block.html?b=b1' } },
        condition: { urlFilter: '||example.com^', resourceTypes: ['main_frame', 'sub_frame'] },
      },
    ]);
  });

  it('anchors a path block to the domain and path', () => {
    const [rule] = buildRules(withBlocks(block('b1', 'youtube.com', '/shorts')));

    expect(rule!.condition.urlFilter).toBe('||youtube.com/shorts');
  });

  it('gives every rule its own id, starting at 1', () => {
    expect(buildRules(withBlocks(block('a', 'a.com'), block('b', 'b.com'))).map((r) => r.id)).toEqual([1, 2]);
  });
});

describe('buildRules: hand-curated categories', () => {
  const enable = (state: State, category: 'social' | 'short-video', excluded?: string[]) =>
    reduce(state, { type: 'enableCategory', category, excluded }, 0).state;

  it('emits nothing for a category that is off', () => {
    expect(buildRules(initialState())).toEqual([]);
  });

  it('redirects every site of an enabled category to the block page for that category', () => {
    const rules = buildRules(enable(initialState(), 'short-video'));

    expect(rules.map((r) => r.condition.urlFilter)).toEqual([
      '||youtube.com/shorts',
      '||instagram.com/reel',
      '||facebook.com/reel',
      '||tiktok.com^',
    ]);
    expect(rules.every((r) => r.action.redirect.extensionPath === '/block.html?c=short-video')).toBe(true);
    expect(rules.every((r) => r.priority === 1)).toBe(true);
  });

  it('leaves out LinkedIn by default', () => {
    const filters = buildRules(enable(initialState(), 'social')).map((r) => r.condition.urlFilter);

    expect(filters).toContain('||reddit.com^');
    expect(filters).not.toContain('||linkedin.com^');
  });

  it('leaves out exactly the sites unticked at setup', () => {
    const filters = buildRules(enable(initialState(), 'social', ['reddit.com'])).map((r) => r.condition.urlFilter);

    expect(filters).not.toContain('||reddit.com^');
    expect(filters).toContain('||linkedin.com^');
  });

  it('ranks personal blocks above categories so their own reason shows', () => {
    const state = enable(withBlocks(block('b1', 'reddit.com')), 'social');
    const reddit = buildRules(state).filter((r) => r.condition.urlFilter === '||reddit.com^');

    expect(reddit.map((r) => r.priority).sort()).toEqual([1, 3]);
    expect(new Set(buildRules(state).map((r) => r.id)).size).toBe(buildRules(state).length);
  });
});
