/** Browser lifecycle signals used for tamper detection (D13, D14). */
import { browser } from 'wxt/browser';

interface ExtensionLoadedDetails {
  reason: 'install' | 'update' | 'browser_update' | 'enable' | 'startup' | 'reload' | string;
}

/**
 * Calls back when the extension comes back after being switched off (Chrome 157+,
 * `runtime.onExtensionLoaded` with reason "enable"). A browser restart is reason
 * "startup" and is not tamper. Must be registered while the service worker starts.
 */
export function onReEnabled(callback: () => void): void {
  const event = (browser.runtime as unknown as {
    onExtensionLoaded?: { addListener(cb: (details: ExtensionLoadedDetails) => void): void };
  }).onExtensionLoaded;
  event?.addListener((details) => {
    if (details.reason === 'enable') callback();
  });
}

export function isIncognitoAllowed(): Promise<boolean> {
  return browser.extension.isAllowedIncognitoAccess();
}

export async function openOnboarding(): Promise<void> {
  await browser.tabs.create({ url: browser.runtime.getURL('/onboarding.html' as never) });
}

const ALL_SITES = { origins: ['<all_urls>'] };

/** False when the user has limited the extension's site access ("On click" or specific sites). */
export function hasFullSiteAccess(): Promise<boolean> {
  return browser.permissions.contains(ALL_SITES);
}

/** Calls back whenever the user changes the extension's site access (Chrome reports it as added/removed). */
export function onSiteAccessChanged(callback: () => void): void {
  browser.permissions.onAdded.addListener(callback);
  browser.permissions.onRemoved.addListener(callback);
}

/**
 * The extension's own page in chrome://extensions, where the user can turn incognito access on or
 * set site access back to all sites. The extension can't change either itself.
 */
export async function openExtensionSettings(): Promise<void> {
  await browser.tabs.create({ url: `chrome://extensions/?id=${browser.runtime.id}` });
}

/** A red "!" on the toolbar icon while a side door is open (incognito off, or site access limited). */
export async function setWarningBadge(on: boolean): Promise<void> {
  await browser.action.setBadgeText({ text: on ? '!' : '' });
  if (on) await browser.action.setBadgeBackgroundColor({ color: '#c62828' });
}
