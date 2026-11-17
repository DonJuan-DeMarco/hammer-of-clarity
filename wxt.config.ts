import { defineConfig } from 'wxt';
import preact from '@preact/preset-vite';
import { buildListRuleset } from './scripts/lists';

export default defineConfig({
  srcDir: 'src',
  vite: () => ({ plugins: [preact()] }),
  manifest: {
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    minimum_chrome_version: '157',
    permissions: ['declarativeNetRequest', 'storage', 'contextMenus', 'activeTab', 'alarms'],
    // Redirect rules only fire on sites the extension has host access to (verified in ticket 01).
    host_permissions: ['<all_urls>'],
    web_accessible_resources: [
      { resources: ['block.html'], matches: ['<all_urls>'] },
    ],
    // The adult and gambling lists, built at build time (scripts/lists.ts). Off until their category is on.
    declarative_net_request: {
      rule_resources: [
        { id: 'adult', enabled: false, path: 'rulesets/adult.json' },
        { id: 'gambling', enabled: false, path: 'rulesets/gambling.json' },
      ],
    },
  },
  hooks: {
    'build:publicAssets': async (_wxt, files) => {
      for (const category of ['adult', 'gambling'] as const) {
        const { json, domains } = await buildListRuleset(category);
        console.log(`[lists] ${category}: ${domains} domains`);
        files.push({ relativeDest: `rulesets/${category}.json`, contents: json });
      }
    },
  },
});
