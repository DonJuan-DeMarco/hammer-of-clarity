/**
 * Removes sites' service workers and cached pages (#14), so their next page load goes to the
 * network, where the blocking rules see it. Cookies and logins are not touched.
 */
import { browser } from 'wxt/browser';

export async function clearSiteData(origins: string[]): Promise<void> {
  if (origins.length === 0) return;
  try {
    const [first, ...rest] = origins;
    await browser.browsingData.remove({ origins: [first!, ...rest] }, { serviceWorkers: true, cacheStorage: true });
  } catch (error) {
    // Never let clearing get in the way of blocking itself.
    console.warn('[site data] could not clear', origins, error);
  }
}
