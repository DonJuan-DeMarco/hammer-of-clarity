import { defineConfig } from 'wxt';
import preact from '@preact/preset-vite';

export default defineConfig({
  srcDir: 'src',
  vite: () => ({ plugins: [preact()] }),
  manifest: {
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    minimum_chrome_version: '157',
    permissions: ['declarativeNetRequest', 'storage', 'contextMenus', 'activeTab'],
    // Redirect rules only fire on sites the extension has host access to (verified in ticket 01).
    host_permissions: ['<all_urls>'],
    web_accessible_resources: [
      { resources: ['block.html'], matches: ['<all_urls>'] },
    ],
  },
});
