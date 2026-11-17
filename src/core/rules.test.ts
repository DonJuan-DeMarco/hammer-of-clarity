import { describe, expect, it } from 'vitest';
import { reduce } from './reducer';
import { ADULT_KEYWORD_REGEX, buildRules, enabledRulesets, PRIORITY } from './rules';
import { initialState } from './state';
import type { Block, CategoryId, State } from './types';

const block = (id: string, domain: string, pathPrefix?: string): Block => ({ id, domain, pathPrefix, createdAt: 0 });
const withBlocks = (...blocks: Block[]): State => ({ ...initialState(), blocks });
const enable = (state: State, category: CategoryId, excluded?: string[]) =>
  reduce(state, { type: 'enableCategory', category, excluded }, 0).state;
const filters = (state: State) => buildRules(state).map((r) => r.condition.urlFilter ?? r.condition.regexFilter);

describe('buildRules: personal blocks', () => {
  it('turns a whole-domain block into a redirect to the block page', () => {
    expect(buildRules(withBlocks(block('b1', 'example.com')))).toEqual([
      {
        id: 1,
        priority: PRIORITY.personal,
        action: { type: 'redirect', redirect: { extensionPath: '/block.html?b=b1' } },
        condition: { urlFilter: '||example.com^', resourceTypes: ['main_frame', 'sub_frame'] },
      },
    ]);
  });

  it('anchors a path block to the domain and path', () => {
    expect(filters(withBlocks(block('b1', 'youtube.com', '/shorts')))).toEqual(['||youtube.com/shorts']);
  });

  it('gives every rule its own id, starting at 1', () => {
    expect(buildRules(withBlocks(block('a', 'a.com'), block('b', 'b.com'))).map((r) => r.id)).toEqual([1, 2]);
  });
});

describe('buildRules: hand-curated categories', () => {
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
    expect(rules.every((r) => r.action.type === 'redirect' && r.action.redirect.extensionPath === '/block.html?c=short-video')).toBe(true);
    expect(rules.every((r) => r.priority === PRIORITY.curated)).toBe(true);
  });

  it('leaves out LinkedIn by default, and exactly the sites unticked at setup', () => {
    expect(filters(enable(initialState(), 'social'))).not.toContain('||linkedin.com^');
    const unticked = filters(enable(initialState(), 'social', ['reddit.com']));
    expect(unticked).not.toContain('||reddit.com^');
    expect(unticked).toContain('||linkedin.com^');
  });

  it('ranks personal blocks above categories so their own reason shows', () => {
    const state = enable(withBlocks(block('b1', 'reddit.com')), 'social');
    const reddit = buildRules(state).filter((r) => r.condition.urlFilter === '||reddit.com^');

    expect(reddit.map((r) => r.priority).sort()).toEqual([PRIORITY.curated, PRIORITY.personal]);
  });
});

describe('buildRules: adult and gambling', () => {
  it('adds the hostname keyword rule only while adult is on (the domain lists are static rulesets)', () => {
    expect(filters(initialState())).toEqual([]);
    const rules = buildRules(enable(initialState(), 'adult'));

    expect(rules).toEqual([
      {
        id: 1,
        priority: PRIORITY.adult,
        action: { type: 'redirect', redirect: { extensionPath: '/block.html?c=adult' } },
        condition: { regexFilter: ADULT_KEYWORD_REGEX, resourceTypes: ['main_frame', 'sub_frame'] },
      },
    ]);
    expect(buildRules(enable(initialState(), 'gambling'))).toEqual([]);
  });

  it('the keyword rule looks at the hostname only', () => {
    const re = new RegExp(ADULT_KEYWORD_REGEX);
    expect(re.test('https://freeporn.example/')).toBe(true);
    expect(re.test('http://www.xxx-videos.example/a')).toBe(true);
    expect(re.test('https://hentai.example')).toBe(true);
    expect(re.test('https://www.google.com/search?q=porn+addiction+help')).toBe(false);
    expect(re.test('https://example.com/xxx')).toBe(false);
  });

  it('turns an exception into an allow rule just above its own list', () => {
    const on = enable(initialState(), 'adult');
    const withException: State = {
      ...on,
      categories: { ...on.categories, adult: { ...on.categories.adult, exceptions: [{ domain: 'wrongly-listed.example', addedAt: 0 }] } },
    };
    const allow = buildRules(withException).find((r) => r.action.type === 'allow');

    expect(allow).toEqual({
      id: 2,
      priority: PRIORITY.adultException,
      action: { type: 'allow' },
      condition: { urlFilter: '||wrongly-listed.example^', resourceTypes: ['main_frame', 'sub_frame'] },
    });
  });

  it('exceptions never outrank your own blocks or the hand-picked categories', () => {
    expect(PRIORITY.adultException).toBeLessThan(PRIORITY.curated);
    expect(PRIORITY.gamblingException).toBeLessThan(PRIORITY.curated);
    expect(PRIORITY.curated).toBeLessThan(PRIORITY.personal);
    expect(PRIORITY.adult).toBeGreaterThan(PRIORITY.gambling);
  });
});

describe('enabledRulesets', () => {
  it('follows the adult and gambling categories', () => {
    expect(enabledRulesets(initialState())).toEqual([]);
    expect(enabledRulesets(enable(enable(initialState(), 'gambling'), 'adult'))).toEqual(['adult', 'gambling']);
  });
});
