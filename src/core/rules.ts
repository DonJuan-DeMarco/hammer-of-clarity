/**
 * Turns what the user has blocked into declarativeNetRequest rules.
 * Pure: no chrome.* access, so it can be tested without a browser.
 */

export interface BlockTarget {
  id: string;
  domain: string;
}

/** The subset of a chrome.declarativeNetRequest.Rule this extension emits. */
export interface RedirectRule {
  id: number;
  priority: number;
  action: { type: 'redirect'; redirect: { extensionPath: string } };
  condition: { urlFilter: string; resourceTypes: ('main_frame' | 'sub_frame')[] };
}

export function buildRules(blocks: BlockTarget[]): RedirectRule[] {
  return blocks.map((block, index) => ({
    id: index + 1,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: { extensionPath: `/block.html?b=${encodeURIComponent(block.id)}` },
    },
    condition: {
      urlFilter: `||${block.domain}/`,
      resourceTypes: ['main_frame', 'sub_frame'],
    },
  }));
}
