import { readFileSync } from 'node:fs';
import { expect, extensionIdOf, test } from './fixtures';

test('credits and licences are reachable from settings', async ({ context, serviceWorker }) => {
  const settings = await context.newPage();
  await settings.goto(`chrome-extension://${extensionIdOf(serviceWorker)}/options.html`);
  await settings.getByTestId('credits-link').click();

  await expect(settings).toHaveURL(/\/credits\.html$/);
  await expect(settings.getByRole('heading', { name: 'Credits and licences' })).toBeVisible();
  await expect(settings.getByRole('link', { name: 'OISD NSFW' })).toBeVisible();
  await expect(settings.getByRole('link', { name: 'HaGeZi DNS Blocklists (Gambling, medium)' })).toBeVisible();
  await expect(settings.getByText('GNU General Public License, version 3')).toBeVisible();
});

test('the package carries the licence, the credits and every icon, and asks only for what it uses', () => {
  const manifest = JSON.parse(readFileSync('.output/chrome-mv3/manifest.json', 'utf8'));

  expect(manifest.permissions.sort()).toEqual(['alarms', 'browsingData', 'contextMenus', 'declarativeNetRequest', 'storage']);
  expect(manifest.host_permissions).toEqual(['<all_urls>']);
  expect(manifest.minimum_chrome_version).toBe('157');
  expect(Object.keys(manifest.icons)).toEqual(['16', '32', '48', '128']);
  expect(readFileSync('.output/chrome-mv3/LICENSE.txt', 'utf8')).toContain('GNU GENERAL PUBLIC LICENSE');
  expect(readFileSync('.output/chrome-mv3/NOTICE.txt', 'utf8')).toContain('hagezi/dns-blocklists');
});
