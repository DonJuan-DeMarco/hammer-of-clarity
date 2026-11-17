/** Downloads a list's plain text. Nothing fetched is ever run: it's parsed as domains (D16). */
import { LIST_SOURCES } from '../core/refresh';
import type { ListCategoryId } from '../core/rules';

export async function downloadList(category: ListCategoryId): Promise<string> {
  const response = await fetch(LIST_SOURCES[category].url, { signal: AbortSignal.timeout(60_000), cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}
