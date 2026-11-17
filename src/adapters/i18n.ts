import { browser } from 'wxt/browser';

/** Type-only: keeps message keys checked without bundling the JSON. */
export type MessageKey = keyof typeof import('../../public/_locales/en/messages.json');

/** Every UI string goes through here, so adding a language never touches components. */
export function t(key: MessageKey, substitutions?: string | string[]): string {
  return browser.i18n.getMessage(key, substitutions);
}
