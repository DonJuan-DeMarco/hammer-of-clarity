import { defineConfig } from 'wxt';
import preact from '@preact/preset-vite';
import { resolve } from 'node:path';
import { buildListRuleset } from './scripts/lists';

export default defineConfig({
  srcDir: 'src',
  vite: () => ({ plugins: [preact()] }),
  manifest: {
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    minimum_chrome_version: '157',
    // Each one is used (ticket 13): blocking rules, saved state, the right-click item, timers,
    // and clearing blocked sites' service workers (#14; adds no install or update warning).
    permissions: ['declarativeNetRequest', 'storage', 'contextMenus', 'alarms', 'browsingData'],
    // Redirect rules only fire on sites the extension has host access to (verified in ticket 01).
    // It also lets the popup read the current tab's address (so no activeTab or tabs) and covers
    // the two list downloads (ticket 06).
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
      // GPLv3 travels with the package, along with the credits for the bundled lists.
      files.push({ absoluteSrc: resolve('LICENSE'), relativeDest: 'LICENSE.txt' });
      files.push({ absoluteSrc: resolve('NOTICE'), relativeDest: 'NOTICE.txt' });
    },
  },
});
