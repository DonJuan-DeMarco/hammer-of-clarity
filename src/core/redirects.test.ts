import { describe, expect, it } from 'vitest';
import { pickRedirect } from './redirects';
import type { Redirect } from './types';

const r = (id: string): Redirect => ({ id, kind: 'instruction', text: id });

describe('pickRedirect', () => {
  it('can land on every redirect, and only on those', () => {
    const redirects = [r('a'), r('b'), r('c')];
    const picks = [0, 0.34, 0.67, 0.9999].map((x) => pickRedirect(redirects, () => x)?.id);

    expect(new Set(picks)).toEqual(new Set(['a', 'b', 'c']));
  });

  it('gives nothing when there are no redirects', () => {
    expect(pickRedirect([], () => 0.5)).toBeNull();
  });
});
