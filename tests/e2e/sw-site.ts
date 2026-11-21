/**
 * A local test site with a service worker that serves every page load from its cache, the way
 * many real sites do (#13). Chrome's blocking rules only see page loads that reach the network,
 * so a site like this is the hard case for blocking.
 *
 * Served on 127.0.0.1 (a secure context, so service workers are allowed) on a free port.
 * Pages `/` and `/other` are cached at install; any other path is fetched by the service
 * worker itself, which Chrome doesn't treat as a page load either.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Page } from '@playwright/test';

const PAGE = `<!doctype html><title>sw test site</title><p id="content">served by the test site</p>
<script>navigator.serviceWorker.register('/sw.js')</script>`;

const SERVICE_WORKER = `
const CACHE = 'v1';
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(['/', '/other'])));
});
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  const path = new URL(event.request.url).pathname;
  event.respondWith(caches.match(path).then((cached) => cached || fetch(event.request)));
});`;

export interface SwSite {
  /** e.g. http://127.0.0.1:53211 */
  origin: string;
  /** What a block on this site is keyed on. */
  domain: string;
  close(): Promise<void>;
}

export async function startSwSite(): Promise<SwSite> {
  const server = http.createServer((req, res) => {
    if (req.url === '/sw.js') {
      res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' });
      res.end(SERVICE_WORKER);
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(PAGE);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    origin: `http://127.0.0.1:${port}`,
    domain: '127.0.0.1',
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

/** Opens the site and waits until its service worker controls the page, so the hard case is real. */
export async function openUnderServiceWorker(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.evaluate(() => navigator.serviceWorker.ready);
  if (!(await page.evaluate(() => navigator.serviceWorker.controller !== null))) await page.reload();
  const controlled = await page.evaluate(() => navigator.serviceWorker.controller !== null);
  if (!controlled) throw new Error('sw-site: the service worker never took control of the page');
}
