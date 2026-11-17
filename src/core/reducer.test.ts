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

describe('enableCategory', () => {
  it('turns the category on with its reason and starts its stage', () => {
    const { state, result } = reduce(initialState(), { type: 'enableCategory', category: 'social', reason: ' Doomscrolling ' }, NOW, ids);

    expect(result).toEqual({ ok: true });
    expect(state.categories.social).toMatchObject({ enabled: true, reason: 'Doomscrolling', stageStartedAt: NOW });
  });

  it('records LinkedIn as an exception by default', () => {
    const { state } = reduce(initialState(), { type: 'enableCategory', category: 'social' }, NOW, ids);

    expect(state.categories.social.exceptions).toEqual([{ domain: 'linkedin.com', addedAt: NOW }]);
  });

  it('records exactly the unticked sites, keeping their paths, and ignores unknown ones', () => {
    const { state } = reduce(
      initialState(),
      { type: 'enableCategory', category: 'short-video', excluded: ['instagram.com/reel', 'nope.com'] },
      NOW,
      ids,
    );

    expect(state.categories['short-video'].exceptions).toEqual([
      { domain: 'instagram.com', pathPrefix: '/reel', addedAt: NOW },
    ]);
  });

  it('does nothing when the category is already on', () => {
    const on = reduce(initialState(), { type: 'enableCategory', category: 'social' }, NOW, ids).state;
    const again = reduce(on, { type: 'enableCategory', category: 'social', excluded: [] }, NOW + 1, ids);

    expect(again.result).toEqual({ ok: false, reason: 'alreadyEnabled' });
    expect(again.state).toBe(on);
  });

  it('turns adult and gambling on with a reason and no exceptions, ignoring any unticked sites', () => {
    const { state, result } = reduce(
      initialState(),
      { type: 'enableCategory', category: 'adult', reason: 'For my relationship', excluded: ['anything.example'] },
      NOW,
      ids,
    );

    expect(result).toEqual({ ok: true });
    expect(state.categories.adult).toMatchObject({ enabled: true, reason: 'For my relationship', stageStartedAt: NOW, exceptions: [] });
  });

  it('refuses turning on personal directly: it follows your own blocks', () => {
    const { result } = reduce(initialState(), { type: 'enableCategory', category: 'personal' }, NOW, ids);

    expect(result).toEqual({ ok: false, reason: 'notAvailable' });
  });
});

describe('redirects', () => {
  const seeded = () =>
    reduce(
      initialState(),
      { type: 'seedRedirects', redirects: [{ kind: 'instruction', text: 'Walk' }, { kind: 'instruction', text: 'Water' }] },
      NOW,
      ids,
    ).state;

  it('seeds defaults once, only into an empty list', () => {
    const once = seeded();
    const twice = reduce(once, { type: 'seedRedirects', redirects: [{ kind: 'instruction', text: 'Other' }] }, NOW, ids);

    expect(once.redirects.map((x) => x.text)).toEqual(['Walk', 'Water']);
    expect(twice.state).toBe(once);
  });

  it('adds an instruction and a link, trimming text', () => {
    let state = reduce(seeded(), { type: 'addRedirect', kind: 'instruction', text: '  Call a friend ' }, NOW, ids).state;
    state = reduce(state, { type: 'addRedirect', kind: 'link', text: 'My book', url: 'https://example.com/book' }, NOW, ids).state;

    expect(state.redirects.slice(2)).toEqual([
      { id: expect.any(String), kind: 'instruction', text: 'Call a friend' },
      { id: expect.any(String), kind: 'link', text: 'My book', url: 'https://example.com/book' },
    ]);
  });

  it('refuses empty text and links without a web address', () => {
    expect(reduce(seeded(), { type: 'addRedirect', kind: 'instruction', text: '  ' }, NOW, ids).result).toEqual({
      ok: false,
      reason: 'invalidRedirect',
    });
    expect(reduce(seeded(), { type: 'addRedirect', kind: 'link', text: 'x', url: 'javascript:alert(1)' }, NOW, ids).result).toEqual({
      ok: false,
      reason: 'invalidRedirect',
    });
  });

  it('edits a redirect in place', () => {
    const state = seeded();
    const id = state.redirects[0]!.id;
    const edited = reduce(state, { type: 'updateRedirect', id, kind: 'link', text: 'Run', url: 'https://example.com/run' }, NOW, ids).state;

    expect(edited.redirects[0]).toEqual({ id, kind: 'link', text: 'Run', url: 'https://example.com/run' });
  });

  it('removes a redirect but never the last one', () => {
    const state = seeded();
    const [first, second] = state.redirects;
    const one = reduce(state, { type: 'removeRedirect', id: first!.id }, NOW, ids).state;
    const none = reduce(one, { type: 'removeRedirect', id: second!.id }, NOW, ids);

    expect(one.redirects).toHaveLength(1);
    expect(none.result).toEqual({ ok: false, reason: 'lastRedirect' });
    expect(none.state).toBe(one);
  });
});

describe('recordAttempt', () => {
  const DAY = 24 * 60 * 60 * 1000;

  it('logs the attempt and drops ones older than 30 days', () => {
    const old = { ...initialState(), attempts: [{ category: 'social' as const, at: NOW - 31 * DAY }, { category: 'social' as const, at: NOW - 29 * DAY }] };
    const { state, result } = reduce(old, { type: 'recordAttempt', category: 'adult' }, NOW, ids);

    expect(result).toEqual({ ok: true });
    expect(state.attempts).toEqual([
      { category: 'social', at: NOW - 29 * DAY },
      { category: 'adult', at: NOW },
    ]);
  });

  it('never changes a stage', () => {
    const on = reduce(initialState(), { type: 'enableCategory', category: 'social' }, NOW, ids).state;
    const after = reduce(on, { type: 'recordAttempt', category: 'social' }, NOW + DAY, ids).state;

    expect(after.categories).toBe(on.categories);
  });
});
