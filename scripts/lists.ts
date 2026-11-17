/**
 * Build step: downloads the adult and gambling lists and turns each into a one-rule
 * static ruleset (the ticket 02 spike showed one rule holds the whole list).
 *
 * Downloads are cached in `.cache/lists/` (git-ignored). If a download fails, the cached
 * copy is used; with neither, the build fails rather than ship an empty wall.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseDomainList } from '../src/core/lists';
import { LIST_SOURCES } from '../src/core/refresh';
import { listRulesetRule, type ListCategoryId } from '../src/core/rules';

const CACHE_DIR = path.resolve('.cache/lists');

async function download(category: ListCategoryId): Promise<string> {
  const cached = path.join(CACHE_DIR, `${category}.txt`);
  const { url } = LIST_SOURCES[category];
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(cached, text);
    return text;
  } catch (error) {
    try {
      const text = await readFile(cached, 'utf8');
      console.warn(`[lists] ${category}: download failed (${String(error)}); using the cached copy.`);
      return text;
    } catch {
      throw new Error(`[lists] ${category}: download failed (${String(error)}) and there is no cached copy at ${cached}.`);
    }
  }
}

/** The ruleset file for one category, as JSON text. */
export async function buildListRuleset(category: ListCategoryId): Promise<{ json: string; domains: number }> {
  const domains = parseDomainList(await download(category));
  const { minimumDomains } = LIST_SOURCES[category];
  if (domains.length < minimumDomains) {
    throw new Error(`[lists] ${category}: only ${domains.length} domains (expected at least ${minimumDomains}); refusing to build.`);
  }
  return { json: JSON.stringify([listRulesetRule(category, domains)]), domains: domains.length };
}
