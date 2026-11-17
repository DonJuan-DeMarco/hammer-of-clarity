/** Domain and URL handling. Uses only the standard URL class, so it runs anywhere. */

/** Lowercase, punycode, no leading `www.`. Null when it isn't a usable domain. */
export function normalizeDomain(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  let host: string;
  try {
    host = new URL(`https://${trimmed}`).hostname;
  } catch {
    return null;
  }
  host = host.replace(/^www\./, '').replace(/\.$/, '');
  return host.includes('.') ? host : null;
}

export interface UrlTarget {
  domain: string;
  /** The page's path, or undefined at the site root. */
  path: string | undefined;
}

/** What "Hammer this site" would block for a given page. Null for non-web pages. */
export function targetFromUrl(url: string): UrlTarget | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  const domain = normalizeDomain(parsed.hostname);
  if (!domain) return null;
  const path = parsed.pathname === '/' ? undefined : parsed.pathname.replace(/\/$/, '');
  return { domain, path };
}
