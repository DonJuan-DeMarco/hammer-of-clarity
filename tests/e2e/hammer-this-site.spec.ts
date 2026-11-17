import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, launchWithExtension, openPopupFor, serviceWorkerOf, test } from './fixtures';

const BLOCK_PAGE = /^chrome-extension:\/\/[a-z]+\/block\.html\?b=/;

test('"Hammer this site" blocks the site and shows the reason', async ({ context, serviceWorker }) => {
  const site = await context.newPage();
  await site.goto('https://example.com/');

  const popup = await openPopupFor(context, serviceWorker, site);
  await expect(popup.getByTestId('domain')).toHaveText('example.com');
  await popup.getByPlaceholder('Why? (optional)').fill('It eats my mornings');
  await popup.getByRole('button', { name: 'Hammer this site' }).click();

  await expect(site).toHaveURL(BLOCK_PAGE);
  await expect(site.getByTestId('reason')).toHaveText('It eats my mornings');
});

test('narrowing to the path blocks only that path', async ({ context, serviceWorker }) => {
  const site = await context.newPage();
  await site.goto('https://example.com/only-this');

  const popup = await openPopupFor(context, serviceWorker, site);
  await popup.getByLabel('Only block /only-this').check();
  await popup.getByRole('button', { name: 'Hammer this site' }).click();
  await expect(site).toHaveURL(BLOCK_PAGE);
  await expect(site.getByTestId('reason')).toHaveText('You chose to keep this out.');

  const root = await context.newPage();
  await root.goto('https://example.com/');
  await expect(root).toHaveURL('https://example.com/');
});

test('blocking the same site twice says it is already blocked', async ({ context, serviceWorker }) => {
  const site = await context.newPage();
  await site.goto('https://example.com/');
  await (await openPopupFor(context, serviceWorker, site)).getByRole('button', { name: 'Hammer this site' }).click();
  await expect(site).toHaveURL(BLOCK_PAGE);

  // The site now shows the block page, so ask again by sending the popup's command directly.
  const popup = await context.newPage();
  const extensionId = new URL(serviceWorker.url()).host;
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  const result = await popup.evaluate(() =>
    (globalThis as any).chrome.runtime.sendMessage({ type: 'command', command: { type: 'addBlock', domain: 'example.com' } }),
  );
  expect(result).toEqual({ ok: false, reason: 'alreadyBlocked' });
});

test('blocks survive a browser restart', async () => {
  const userDataDir = mkdtempSync(path.join(tmpdir(), 'hoc-e2e-'));
  try {
    let context = await launchWithExtension(userDataDir);
    let worker = await serviceWorkerOf(context);
    const site = await context.newPage();
    await site.goto('https://example.com/');
    await (await openPopupFor(context, worker, site)).getByRole('button', { name: 'Hammer this site' }).click();
    await expect(site).toHaveURL(BLOCK_PAGE);
    await context.close();

    context = await launchWithExtension(userDataDir);
    worker = await serviceWorkerOf(context);
    const again = await context.newPage();
    await again.goto('https://example.com/').catch(() => {});
    await expect(again).toHaveURL(BLOCK_PAGE);
    await context.close();
  } finally {
    rmSync(userDataDir, { recursive: true, force: true });
  }
});
