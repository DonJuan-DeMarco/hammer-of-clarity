import { describe, expect, it } from 'vitest';
import { buildRules } from './rules';

describe('buildRules', () => {
  it('turns one blocked domain into a redirect to the block page', () => {
    const rules = buildRules([{ id: 'test', domain: 'example.com' }]);

    expect(rules).toEqual([
      {
        id: 1,
        priority: 1,
        action: { type: 'redirect', redirect: { extensionPath: '/block.html?b=test' } },
        condition: { urlFilter: '||example.com/', resourceTypes: ['main_frame', 'sub_frame'] },
      },
    ]);
  });

  it('gives each block its own rule id, starting at 1', () => {
    const rules = buildRules([
      { id: 'a', domain: 'a.com' },
      { id: 'b', domain: 'b.com' },
    ]);

    expect(rules.map((r) => r.id)).toEqual([1, 2]);
  });
});
