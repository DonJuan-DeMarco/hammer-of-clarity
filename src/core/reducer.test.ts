import { describe, expect, it } from 'vitest';
import { reduce } from './reducer';
import { initialState } from './state';

const NOW = 1_700_000_000_000;
let n = 0;
const ids = () => `id${++n}`;

describe('addBlock', () => {
  it('adds a normalized personal block with its reason', () => {
    const { state, result } = reduce(initialState(), { type: 'addBlock', domain: 'WWW.Reddit.com', reason: ' Wastes my evenings ' }, NOW, ids);

    expect(result).toEqual({ ok: true, blockId: expect.any(String) });
    expect(state.blocks).toEqual([
      { id: expect.any(String), domain: 'reddit.com', reason: 'Wastes my evenings', createdAt: NOW },
    ]);
  });

  it('keeps a path prefix and drops an empty reason', () => {
    const { state } = reduce(initialState(), { type: 'addBlock', domain: 'youtube.com', pathPrefix: '/shorts', reason: '   ' }, NOW, ids);

    expect(state.blocks[0]).toEqual({ id: expect.any(String), domain: 'youtube.com', pathPrefix: '/shorts', createdAt: NOW });
  });

  it('starts the personal stage with the first block only', () => {
    const first = reduce(initialState(), { type: 'addBlock', domain: 'a.com' }, NOW, ids).state;
    const second = reduce(first, { type: 'addBlock', domain: 'b.com' }, NOW + 1000, ids).state;

    expect(first.categories.personal).toMatchObject({ enabled: true, stageStartedAt: NOW });
    expect(second.categories.personal.stageStartedAt).toBe(NOW);
  });

  it('refuses an exact duplicate', () => {
    const once = reduce(initialState(), { type: 'addBlock', domain: 'reddit.com' }, NOW, ids).state;
    const twice = reduce(once, { type: 'addBlock', domain: 'www.reddit.com' }, NOW, ids);

    expect(twice.result).toEqual({ ok: false, reason: 'alreadyBlocked' });
    expect(twice.state).toBe(once);
  });

  it('refuses a path that a whole-domain block already covers', () => {
    const domain = reduce(initialState(), { type: 'addBlock', domain: 'youtube.com' }, NOW, ids).state;
    const path = reduce(domain, { type: 'addBlock', domain: 'youtube.com', pathPrefix: '/shorts' }, NOW, ids);

    expect(path.result).toEqual({ ok: false, reason: 'alreadyBlocked' });
  });

  it('allows a whole-domain block next to an existing path block', () => {
    const path = reduce(initialState(), { type: 'addBlock', domain: 'youtube.com', pathPrefix: '/shorts' }, NOW, ids).state;
    const domain = reduce(path, { type: 'addBlock', domain: 'youtube.com' }, NOW, ids);

    expect(domain.result.ok).toBe(true);
    expect(domain.state.blocks).toHaveLength(2);
  });

  it('refuses an invalid domain', () => {
    const { result } = reduce(initialState(), { type: 'addBlock', domain: 'not a domain' }, NOW, ids);

    expect(result).toEqual({ ok: false, reason: 'invalidDomain' });
  });
});
