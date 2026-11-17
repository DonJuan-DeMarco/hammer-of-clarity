/** Redirects: something to do instead, offered on the block page (D7). */
import type { Redirect } from './types';

export type RedirectInput = { kind: Redirect['kind']; text: string; url?: string };

/** One redirect at random, so the block page doesn't go stale. */
export function pickRedirect(redirects: Redirect[], random: () => number = Math.random): Redirect | null {
  if (redirects.length === 0) return null;
  return redirects[Math.min(redirects.length - 1, Math.floor(random() * redirects.length))]!;
}

/** Trimmed and checked, or null. Links must be http(s) so a redirect can't run script. */
export function cleanRedirect(input: RedirectInput): Omit<Redirect, 'id'> | null {
  const text = input.text.trim();
  if (!text) return null;
  if (input.kind === 'instruction') return { kind: 'instruction', text };
  const url = input.url?.trim();
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  } catch {
    return null;
  }
  return { kind: 'link', text, url };
}
