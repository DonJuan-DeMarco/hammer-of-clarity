/**
 * Turns what the user has blocked into declarativeNetRequest rules.
 * Pure: no chrome.* access, so it can be tested without a browser.
 */
import type { Block } from './types';

/** The subset of a chrome.declarativeNetRequest.Rule this extension emits. */
export interface RedirectRule {
  id: number;
  priority: number;
  action: { type: 'redirect'; redirect: { extensionPath: string } };
  condition: { urlFilter: string; resourceTypes: ('main_frame' | 'sub_frame')[] };
}

export function buildRules(blocks: Block[]): RedirectRule[] {
  return blocks.map((block, index) => ({
    id: index + 1,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: { extensionPath: `/block.html?b=${encodeURIComponent(block.id)}` },
    },
    condition: {
      // `||` matches the domain and its subdomains; `^` stops `a.com` matching `a.community`.
      urlFilter: block.pathPrefix ? `||${block.domain}${block.pathPrefix}` : `||${block.domain}^`,
      resourceTypes: ['main_frame', 'sub_frame'],
    },
  }));
}
