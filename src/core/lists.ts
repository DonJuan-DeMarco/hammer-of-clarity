/**
 * Parsing downloaded block lists (OISD, HaGeZi) into plain domains for DNR `requestDomains`,
 * which also matches every subdomain. Used at build time and, in ticket 06, for refreshes.
 */

const HOSTS_LINE = /^(?:0\.0\.0\.0|127\.0\.0\.1|::1?)\s+(\S+)/;
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * A domain exactly as a list names it: lowercase, punycode, no trailing dot. Unlike
 * `normalizeDomain`, `www.` is kept: a list that names `www.x` hasn't asked to block all of `x`.
 */
export function listDomain(raw: string): string | null {
  let host = raw.trim().toLowerCase().replace(/\.$/, '');
  if (!host.includes('.')) return null;
  if (/[^\x00-\x7f]/.test(host)) {
    try {
      host = new URL(`http://${host}`).hostname;
    } catch {
      return null;
    }
  }
  const labels = host.split('.');
  if (labels.every((l) => /^\d+$/.test(l))) return null; // an IP address
  return labels.every((l) => LABEL.test(l)) ? host : null;
}

/** Every domain in a list, in order, without duplicates. Unknown lines are skipped. */
export function parseDomainList(text: string): string[] {
  const seen = new Set<string>();
  for (const rawLine of text.split('\n')) {
    let line = rawLine.replace(/\r$/, '').replace(/\s#.*$/, '').trim();
    if (!line || line.startsWith('#') || line.startsWith('!')) continue;

    const hosts = HOSTS_LINE.exec(line);
    if (hosts) line = hosts[1]!;
    else if (line.startsWith('||')) line = line.slice(2).split(/[\^$/]/)[0]!;
    else if (line.startsWith('*.')) line = line.slice(2);
    else if (/\s/.test(line)) continue;

    const domain = listDomain(line);
    if (domain) seen.add(domain);
  }
  return [...seen];
}
