import { describe, expect, it } from 'vitest';
import { normalizeDomain, targetFromUrl } from './domain';

describe('normalizeDomain', () => {
  it('lowercases and strips www.', () => {
    expect(normalizeDomain('WWW.Reddit.com')).toBe('reddit.com');
  });

  it('converts international names to punycode', () => {
    expect(normalizeDomain('bücher.de')).toBe('xn--bcher-kva.de');
  });

  it('rejects things that are not domains', () => {
    expect(normalizeDomain('')).toBeNull();
    expect(normalizeDomain('localhost')).toBeNull();
    expect(normalizeDomain('not a domain')).toBeNull();
  });
});

describe('targetFromUrl', () => {
  it('gives the domain and the path of a web page', () => {
    expect(targetFromUrl('https://www.youtube.com/shorts/abc?x=1')).toEqual({
      domain: 'youtube.com',
      path: '/shorts/abc',
    });
  });

  it('gives no path for the site root', () => {
    expect(targetFromUrl('https://reddit.com/')).toEqual({ domain: 'reddit.com', path: undefined });
  });

  it('refuses pages that are not on the web', () => {
    expect(targetFromUrl('chrome://extensions/')).toBeNull();
    expect(targetFromUrl('chrome-extension://abc/block.html')).toBeNull();
    expect(targetFromUrl('file:///C:/x.html')).toBeNull();
  });
});
