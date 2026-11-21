/**
 * The on-device lookup table for the adult and gambling lists (#16), in IndexedDB: one object
 * store per list, keyed by domain, plus a meta store recording which list each table holds.
 * Far too large for the background script's memory; a lookup is a few key reads.
 */
import { browser } from 'wxt/browser';
import type { TableSource } from '../core/listTable';
import { LIST_CATEGORIES, type ListCategoryId } from '../core/rules';

const DB_NAME = 'hammer-lists';
const META = 'meta';
const CHUNK = 25_000;

export interface TableMeta {
  source: TableSource;
  domains: number;
  filledAt: number;
  fillMs: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      for (const store of [...LIST_CATEGORIES, META]) request.result.createObjectStore(store);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function read<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function tableMeta(): Promise<Partial<Record<ListCategoryId, TableMeta>>> {
  const db = await openDb();
  const store = db.transaction(META, 'readonly').objectStore(META);
  const entries = await Promise.all(LIST_CATEGORIES.map(async (c) => [c, await read(store.get(c))] as const));
  return Object.fromEntries(entries.filter(([, meta]) => meta)) as Partial<Record<ListCategoryId, TableMeta>>;
}

/** Empties a category's table. Its meta goes first, so a half-cleared table is never trusted. */
export async function clearTable(category: ListCategoryId): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([META, category], 'readwrite');
  tx.objectStore(META).delete(category);
  tx.objectStore(category).clear();
  await done(tx);
}

/**
 * Replaces a category's table with `domains`, in chunks so other work (and clicks) can run in
 * between. The meta is written last: if the worker stops part-way, the table counts as missing
 * and is filled again.
 */
export async function replaceTable(category: ListCategoryId, domains: string[], source: TableSource): Promise<TableMeta> {
  const started = performance.now();
  await clearTable(category);
  const db = await openDb();
  for (let i = 0; i < domains.length; i += CHUNK) {
    const tx = db.transaction(category, 'readwrite');
    const store = tx.objectStore(category);
    for (const domain of domains.slice(i, i + CHUNK)) store.put(1, domain);
    await done(tx);
    // A cheap extension call between chunks keeps the background script awake during a long fill.
    await browser.runtime.getPlatformInfo();
  }
  const meta: TableMeta = { source, domains: domains.length, filledAt: Date.now(), fillMs: Math.round(performance.now() - started) };
  const tx = db.transaction(META, 'readwrite');
  tx.objectStore(META).put(meta, category);
  await done(tx);
  return meta;
}

/** Which lists contain any of `hosts` (a host and its parent domains). One read-only transaction. */
export async function listedIn(hosts: string[], categories: ListCategoryId[]): Promise<ListCategoryId[]> {
  if (categories.length === 0 || hosts.length === 0) return [];
  const db = await openDb();
  const tx = db.transaction(categories, 'readonly');
  const found = await Promise.all(
    categories.map(async (category) => {
      const store = tx.objectStore(category);
      const hits = await Promise.all(hosts.map((host) => read(store.count(host))));
      return hits.some((count) => count > 0) ? category : null;
    }),
  );
  return found.filter((c): c is ListCategoryId => c !== null);
}

/** The domains in a bundled ruleset, read from the extension package. */
export async function bundledDomains(category: ListCategoryId): Promise<string[]> {
  const response = await fetch(browser.runtime.getURL(`/rulesets/${category}.json` as never));
  const [rule] = (await response.json()) as [{ condition: { requestDomains: string[] } }];
  return rule.condition.requestDomains;
}
