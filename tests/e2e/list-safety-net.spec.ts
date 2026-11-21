/**
 * #16: the safety net for the adult and gambling lists, via the on-device lookup table.
 *
 * Needs a normal-looking domain on a list, served by a service worker. Chromium is told to resolve
 * listed.example (and sub.listed.example) to the local test server, and to treat those plain-http
 * origins as secure so service workers run there. A fake refreshed adult list containing
 * listed.example is served to the extension; no real adult site is ever involved.
 */
import type { BrowserContext, Page, Worker } from '@playwright/test';
import { expect, finishCooldowns, launchWithExtension, serviceWorkerOf, test } from './fixtures';
import { openUnderServiceWorker, startSwSite, type SwSite } from './sw-site';

test.describe.configure({ timeout: 180_000 });

const OISD = 'https://nsfw.oisd.nl/domainswild2';
const FAKE_ADULT_LIST = ['# fake list', ...Array.from({ length: 100_000 }, (_, i) => `d${i}.fake-list.example`), 'listed.example'].join('\n');

interface Meta {
  source: string;
  domains: number;
  fillMs: number;
}

/** Reads the safety net's table bookkeeping straight from the extension's IndexedDB. */
const tableMeta = (worker: Worker) =>
  worker.evaluate(
    () =>
      new Promise<Record<string, Meta | undefined>>((resolve, reject) => {
        const open = indexedDB.open('hammer-lists');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction('meta', 'readonly');
          const adult = tx.objectStore('meta').get('adult');
          const gambling = tx.objectStore('meta').get('gambling');
          tx.oncomplete = () => resolve({ adult: adult.result, gambling: gambling.result });
        };
      }),
  );

async function command(context: BrowserContext, worker: Worker, cmd: object) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${new URL(worker.url()).host}/options.html`);
  const result = await page.evaluate((c) => (globalThis as any).chrome.runtime.sendMessage({ type: 'command', command: c }), cmd);
  await page.close();
  return result;
}

/** Whether a domain is in the adult table right now. */
const tableHas = (worker: Worker, domain: string) =>
  worker.evaluate(
    (d) =>
      new Promise<boolean>((resolve) => {
        const open = indexedDB.open('hammer-lists');
        open.onsuccess = () => {
          const count = open.result.transaction('adult', 'readonly').objectStore('adult').count(d);
          count.onsuccess = () => resolve(count.result > 0);
        };
      }),
    domain,
  );

async function landsOn(context: BrowserContext, url: string): Promise<string> {
  const page = await context.newPage();
  await page.goto(url).catch(() => {});
  await page.waitForTimeout(400);
  return page.url();
}

test('listed sites served by a service worker are caught via the on-device table, which follows the list in use', async () => {
  const site: SwSite = await startSwSite('listed.example');
  const sub: SwSite = await startSwSite('sub.listed.example');
  const context = await launchWithExtension('', [
    '--host-resolver-rules=MAP listed.example 127.0.0.1, MAP sub.listed.example 127.0.0.1',
    `--unsafely-treat-insecure-origin-as-secure=${site.origin},${sub.origin}`,
  ]);
  try {
    const worker = await serviceWorkerOf(context);
    await context.route(OISD, (route) => route.fulfill({ contentType: 'text/plain', body: FAKE_ADULT_LIST }));

    // Both sites install their service workers while nothing blocks them.
    const page: Page = await context.newPage();
    await openUnderServiceWorker(page, `${site.origin}/`);
    const subPage = await context.newPage();
    await openUnderServiceWorker(subPage, `${sub.origin}/`);

    // Adult on: the table fills from the bundled list, which doesn't contain listed.example.
    expect((await command(context, worker, { type: 'enableCategory', category: 'adult' })).ok).toBe(true);
    // The fill runs in the background; a click made meanwhile must still be answered quickly.
    const clickAt = Date.now();
    expect((await command(context, worker, { type: 'addBlock', domain: 'during-fill.example' })).ok).toBe(true);
    const clickMs = Date.now() - clickAt;
    console.log(`[measure] a command sent during the table fill took ${clickMs} ms (including opening a page)`);
    expect(clickMs).toBeLessThan(3000);
    expect((await tableMeta(worker)).adult).toBeUndefined(); // the fill was indeed still running
    await expect.poll(async () => (await tableMeta(worker)).adult?.source, { timeout: 90_000 }).toBe('bundled');
    const bundled = (await tableMeta(worker)).adult!;
    console.log(`[measure] bundled adult table: ${bundled.domains} domains filled in ${bundled.fillMs} ms`);
    expect(await landsOn(context, `${site.origin}/other`)).toBe(`${site.origin}/other`);

    // The weekly refresh installs a list containing listed.example; the table follows.
    await worker.evaluate(() => (globalThis as any).chrome.alarms.create('refresh-lists', { when: Date.now() + 50 }));
    await expect.poll(async () => (await tableMeta(worker)).adult?.source, { timeout: 90_000 }).toBe('refreshed');
    const refreshed = (await tableMeta(worker)).adult!;
    console.log(`[measure] refreshed adult table: ${refreshed.domains} domains filled in ${refreshed.fillMs} ms`);
    expect(refreshed.domains).toBe(100_001);

    // Pages the service workers serve from cache never reach the rules; the safety net catches them.
    expect(await landsOn(context, `${site.origin}/other`)).toMatch(/block\.html\?c=adult$/);
    expect(await landsOn(context, `${sub.origin}/other`)).toMatch(/block\.html\?c=adult$/); // a parent domain is listed

    // How long a lookup takes: a host and its parent domains, many times over.
    const lookupMs = await worker.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const open = indexedDB.open('hammer-lists');
          open.onsuccess = async () => {
            const db = open.result;
            const hosts = ['a.b.sub.listed.example', 'b.sub.listed.example', 'sub.listed.example', 'listed.example'];
            const runs = 200;
            const started = performance.now();
            for (let i = 0; i < runs; i++) {
              const store = db.transaction('adult', 'readonly').objectStore('adult');
              await Promise.all(hosts.map((h) => new Promise((done) => (store.count(h).onsuccess = done))));
            }
            resolve((performance.now() - started) / runs);
          };
        }),
    );
    console.log(`[measure] lookup of 4 hosts: ${lookupMs.toFixed(3)} ms on average`);
    expect(lookupMs).toBeLessThan(20);

    // A wrongly listed site let through the real way (request, cooldown, retype) is never redirected,
    // even once its service worker is back and serving pages out of the rules' sight.
    const letThrough = await command(context, worker, {
      type: 'requestRemoval',
      target: { kind: 'exception', category: 'adult', domain: 'listed.example' },
      fallbackConfirmText: 'I choose this.',
    });
    await finishCooldowns(worker);
    expect((await command(context, worker, { type: 'confirmRemoval', id: letThrough.requestId, text: 'I choose this.' })).ok).toBe(true);
    await openUnderServiceWorker(page, `${site.origin}/`);
    expect(await landsOn(context, `${site.origin}/other`)).toBe(`${site.origin}/other`);

    // Refresh switched off: the bundled list is in use again, and the table holds it, not the downloaded one.
    expect((await command(context, worker, { type: 'setListRefresh', enabled: false })).ok).toBe(true);
    await expect.poll(async () => (await tableMeta(worker)).adult?.source, { timeout: 90_000 }).toBe('bundled');
    expect(await tableHas(worker, 'listed.example')).toBe(false);
    expect(await tableHas(worker, 'd1.fake-list.example')).toBe(false);

    // Adult switched off (removal request, cooldown passed, retyped): the table is emptied.
    const asked = await command(context, worker, {
      type: 'requestRemoval',
      target: { kind: 'category', category: 'adult' },
      fallbackConfirmText: 'I choose this.',
    });
    await finishCooldowns(worker);
    expect((await command(context, worker, { type: 'confirmRemoval', id: asked.requestId, text: 'I choose this.' })).ok).toBe(true);
    const offAt = Date.now();
    await expect.poll(async () => (await tableMeta(worker)).adult, { timeout: 90_000 }).toBeUndefined();
    console.log(`[measure] table emptied ${Date.now() - offAt} ms after adult was switched off`);
  } finally {
    await context.close();
    await site.close();
    await sub.close();
  }
});
