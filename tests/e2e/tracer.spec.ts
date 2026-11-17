import { expect, test } from './fixtures';

test('a blocked site redirects to the block page', async ({ context, serviceWorker }) => {
  // Wait for onInstalled to have installed the rule.
  await expect
    .poll(() => serviceWorker.evaluate(async () => (await chrome.declarativeNetRequest.getDynamicRules()).length))
    .toBe(1);

  const page = await context.newPage();
  await page.goto('https://example.com/');

  await expect(page).toHaveURL(/^chrome-extension:\/\/[a-z]+\/block\.html\?b=test$/);
  await expect(page.getByTestId('reason')).toHaveText('You chose to keep this out.');
});
