import { readFileSync } from 'node:fs';
import type { BrowserContext, Page, Worker } from '@playwright/test';
import { expect, extensionIdOf, finishCooldowns, test } from './fixtures';

// Switching on a ~10 MB ruleset makes these slower than the rest.
test.describe.configure({ timeout: 90_000 });

/**
 * Safety: every http(s) request in these tests gets a blank placeholder page, so a real
 * adult or gambling site can never load, even if blocking failed. The extension's redirect
 * happens before Playwright's routing, so blocked URLs still reach the block page.
 */
async function stubTheWeb(context: BrowserContext) {
  await context.route(/^https?:\/\//, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>placeholder</title><p>placeholder</p>' }),
  );
}

/** A domain from the list as actually built into the extension. */
function listedDomain(category: 'adult' | 'gambling', position: 'first' | 'last'): string {
  const [rule] = JSON.parse(readFileSync(`.output/chrome-mv3/rulesets/${category}.json`, 'utf8'));
  const domains: string[] = rule.condition.requestDomains;
  return position === 'first' ? domains[0]! : domains[domains.length - 1]!;
}

async function openSettings(context: BrowserContext, worker: Worker): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionIdOf(worker)}/options.html`);
  return page;
}

async function visit(context: BrowserContext, url: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(url).catch(() => {});
  return page;
}

async function turnOn(settings: Page, category: 'adult' | 'gambling', reason = '') {
  const card = settings.getByTestId(`category-${category}`);
  await card.getByRole('button', { name: 'Block this category' }).click();
  if (reason) await card.getByPlaceholder('Why are you blocking these? (optional)').fill(reason);
  await card.getByRole('button', { name: 'Turn on' }).click();
  await expect(card.getByTestId('stage')).toBeVisible();
}

test('adult: listed domains, subdomains and keyword hostnames are blocked; searches are not', async ({ context, serviceWorker }) => {
  await stubTheWeb(context);
  const last = listedDomain('adult', 'last');

  // Off: nothing happens.
  await expect(await visit(context, `https://${last}/`)).toHaveURL(`https://${last}/`);

  await turnOn(await openSettings(context, serviceWorker), 'adult', 'For my relationship');

  const listed = await visit(context, `https://${last}/`);
  await expect(listed).toHaveURL(/block\.html\?c=adult$/);
  await expect(listed.getByTestId('reason')).toHaveText('For my relationship');
  await expect(await visit(context, `https://www.${listedDomain('adult', 'first')}/some/page`)).toHaveURL(/block\.html\?c=adult$/);
  await expect(await visit(context, 'https://free-porn-test.example/')).toHaveURL(/block\.html\?c=adult$/);

  const search = 'https://www.google.com/search?q=porn+addiction+help';
  await expect(await visit(context, search)).toHaveURL(search);
});

test('gambling: listed domains are blocked once it is on', async ({ context, serviceWorker }) => {
  await stubTheWeb(context);
  const domain = listedDomain('gambling', 'last');

  await expect(await visit(context, `https://${domain}/`)).toHaveURL(`https://${domain}/`);
  await turnOn(await openSettings(context, serviceWorker), 'gambling');
  await expect(await visit(context, `https://${domain}/`)).toHaveURL(/block\.html\?c=gambling$/);
});

test('a wrongly listed site can be let through after the wait, without setting adult back', async ({ context, serviceWorker }) => {
  await stubTheWeb(context);
  const domain = listedDomain('adult', 'last');
  const settings = await openSettings(context, serviceWorker);
  await turnOn(settings, 'adult');

  const wrongly = settings.getByTestId('wrongly-blocked-adult');
  await wrongly.getByText('A site blocked by mistake?').click();
  await wrongly.getByPlaceholder('example.com').fill(domain);
  await wrongly.getByRole('button', { name: 'Ask to let it through' }).click();
  await expect(settings.getByTestId('removal-request')).toContainText(`${domain} in Adult`);
  await expect(await visit(context, `https://${domain}/`)).toHaveURL(/block\.html/);
  await finishCooldowns(serviceWorker);
  await settings.reload();
  const request = settings.getByTestId('removal-request');
  await request.getByRole('textbox').pressSequentially('I am choosing to remove this wall, and I accept what comes with it.');
  await request.getByRole('button', { name: 'Remove the wall' }).click();
  await expect(settings.getByTestId('removal-requests')).toHaveCount(0);

  await expect(await visit(context, `https://${domain}/`)).toHaveURL(`https://${domain}/`);
  await expect(await visit(context, `https://${listedDomain('adult', 'first')}/`)).toHaveURL(/block\.html\?c=adult$/);
  const adult = await serviceWorker.evaluate(async () => {
    const { 'state:v1': state } = await (globalThis as any).chrome.storage.local.get('state:v1');
    return state.categories.adult;
  });
  expect(adult.resetNoticePending).toBeUndefined();
  expect(adult.exceptions.map((e: { domain: string }) => e.domain)).toEqual([domain]);
});
