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

/** The extension can't flip the incognito toggle itself; it can only open its own settings page. */
export async function openIncognitoSetting(): Promise<void> {
  await browser.tabs.create({ url: `chrome://extensions/?id=${browser.runtime.id}` });
}

/** A red "!" on the toolbar icon while incognito access is off. */
export async function setIncognitoWarning(on: boolean): Promise<void> {
  await browser.action.setBadgeText({ text: on ? '!' : '' });
  if (on) await browser.action.setBadgeBackgroundColor({ color: '#c62828' });
}
