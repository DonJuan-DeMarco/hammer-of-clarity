import { describe, expect, it } from 'vitest';
import { buildRules } from './rules';

const block = (id: string, domain: string, pathPrefix?: string) => ({ id, domain, pathPrefix, createdAt: 0 });

describe('buildRules', () => {
  it('turns a whole-domain block into a redirect to the block page', () => {
    expect(buildRules([block('b1', 'example.com')])).toEqual([
      {
        id: 1,
        priority: 1,
        action: { type: 'redirect', redirect: { extensionPath: '/block.html?b=b1' } },
        condition: { urlFilter: '||example.com^', resourceTypes: ['main_frame', 'sub_frame'] },
      },
    ]);
  });

  it('anchors a path block to the domain and path', () => {
    const [rule] = buildRules([block('b1', 'youtube.com', '/shorts')]);

    expect(rule!.condition.urlFilter).toBe('||youtube.com/shorts');
  });

  it('gives each block its own rule id, starting at 1', () => {
    expect(buildRules([block('a', 'a.com'), block('b', 'b.com')]).map((r) => r.id)).toEqual([1, 2]);
  });
});
