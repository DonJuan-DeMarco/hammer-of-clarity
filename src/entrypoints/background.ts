import { browser } from 'wxt/browser';
import { targetFromUrl } from '../core/domain';
import { reduce, type Command, type CommandResult } from '../core/reducer';
import { parseDomainList } from '../core/lists';
import { desiredListTables, hostSuffixes, listDecision } from '../core/listTable';
import { blockDecision, blockPagePath, type BlockDecision } from '../core/navigation';
import { acceptRefreshedList, listRulePlan } from '../core/refresh';
import { buildRules, LIST_CATEGORIES, listRulesetRule } from '../core/rules';
import { blockedSiteDomains, newlyBlockedDomains, originsFor } from '../core/siteData';
import { protectionGaps } from '../core/tamper';
import type { State } from '../core/types';
import { applyRules, installListRule } from '../adapters/dnr';
import { downloadList } from '../adapters/lists';
import { clearSiteData } from '../adapters/siteData';
import { bundledDomains, clearTable, listedIn, replaceTable, tableMeta } from '../adapters/listTable';
import { t } from '../adapters/i18n';
import type { CommandMessage } from '../adapters/messages';
import {
  hasFullSiteAccess,
  isIncognitoAllowed,
  onReEnabled,
  onSiteAccessChanged,
  openOnboarding,
  setWarningBadge,
} from '../adapters/lifecycle';
import { loadState, saveState } from '../adapters/storage';

const MENU_BLOCK_LINK = 'block-link';
const ALARM_EXPIRE_REMOVALS = 'expire-removals';
const ALARM_CHECK_GRADUATION = 'check-graduation';
const ALARM_REFRESH_LISTS = 'refresh-lists';

function ensureAlarm(name: string, periodInMinutes: number, delayInMinutes = periodInMinutes): void {
  void browser.alarms.get(name).then((existing) => {
    if (!existing) void browser.alarms.create(name, { periodInMinutes, delayInMinutes });
  });
}

/**
 * The only path for change: command → reducer → browser → save. Rules go first so that
 * by the time any page sees the new state (via storage), the browser already blocks to match.
 */
async function apply(command: Command): Promise<CommandResult> {
  const state = await loadState();
  const { state: next, result } = reduce(state, command, Date.now());
  if (next !== state) {
    await syncBrowser(next);
    await saveState(next);
    // Sites that just became blocked lose their service worker and cached pages, so their
    // next page load reaches the network and the blocking rules (#14).
    await clearSiteData(newlyBlockedDomains(state, next).flatMap(originsFor));
    // The safety net's list table follows the list in use (#16). Not awaited: a fill can take
    // seconds and must never hold up a click.
    void syncListTables();
  }
  return result;
}

/** Makes the browser match the state: blocking rules, and the warning badge while incognito is uncovered. */
async function syncBrowser(state: State): Promise<void> {
  await applyRules(buildRules(state), listRulePlan(state));
  await setWarningBadge(protectionGaps(state).length > 0);
}

/** Incognito access and site access: either one switched off is a side door (D13, 1.0.1). */
async function checkAccess(): Promise<void> {
  await dispatch({ type: 'incognitoStatus', allowed: await isIncognitoAllowed() });
  await dispatch({ type: 'siteAccessStatus', full: await hasFullSiteAccess() });
  await syncBrowser(await loadState());
}

// Changes run one at a time so two quick clicks can't overwrite each other's state.
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task);
  queue = run.catch(() => undefined);
  return run;
}
const dispatch = (command: Command) => enqueue(() => apply(command));

/**
 * The safety net (#15): a tab landed on a page that should have been blocked, served out of
 * sight of the blocking rules (a service worker, the back/forward cache). Send it to the block
 * page, which logs the visit like any other, and clear the site's service worker so the next
 * visit is blocked the normal way.
 */
async function catchBlockedTab(tabId: number, url: string): Promise<void> {
  const state = await loadState();
  const decision = blockDecision(state, url) ?? (await listedDecision(state, url));
  if (!decision) return;
  const { origin, hostname } = new URL(url);
  await browser.tabs.update(tabId, { url: browser.runtime.getURL(blockPagePath(decision) as never) });
  await clearSiteData([origin, ...originsFor(hostname)]);
}

/** The adult and gambling lists' part of the safety net (#16): a lookup in the on-device table. */
async function listedDecision(state: State, url: string): Promise<BlockDecision | null> {
  const inUse = LIST_CATEGORIES.filter((c) => state.categories[c].enabled);
  if (inUse.length === 0 || !/^https?:/.test(url)) return null;
  return listDecision(state, url, await listedIn(hostSuffixes(new URL(url).hostname), inUse));
}

// Table work runs one job at a time, apart from the command queue, so it never delays a click.
let tableQueue: Promise<unknown> = Promise.resolve();
function enqueueTable(task: () => Promise<unknown>): Promise<unknown> {
  tableQueue = tableQueue.then(task).catch((error) => console.warn('[lists] table', error));
  return tableQueue;
}

/**
 * Makes each list table hold the list actually in use (#16): filled from the bundled list,
 * emptied when the category is off. A refreshed list is written by the refresh itself; if
 * its table is missing (storage cleared), the bundled list stands in until the next refresh.
 */
function syncListTables(): Promise<unknown> {
  return enqueueTable(async () => {
    const desired = desiredListTables(await loadState());
    const meta = await tableMeta();
    for (const category of LIST_CATEGORIES) {
      const want = desired[category];
      const have = meta[category];
      if (!want) {
        if (have) await clearTable(category);
      } else if ((want === 'bundled' && have?.source !== 'bundled') || (want === 'refreshed' && !have)) {
        const filled = await replaceTable(category, await bundledDomains(category), 'bundled');
        console.info(`[lists] ${category}: table filled from the bundled list, ${filled.domains} domains in ${filled.fillMs} ms`);
      }
    }
  });
}

/**
 * Weekly (D16): download each enabled list, check it, and swap it in. Downloading happens
 * outside the queue so a slow site never holds up a click; installing happens inside it,
 * re-checking that the category and refresh are still on. Any failure keeps what's
 * installed; the next week tries again.
 */
async function refreshLists(): Promise<void> {
  for (const category of LIST_CATEGORIES) {
    const before = await loadState();
    if (!before.lists.refreshEnabled || !before.categories[category].enabled) continue;
    let domains: string[];
    try {
      domains = parseDomainList(await downloadList(category));
    } catch (error) {
      console.warn(`[lists] ${category}: refresh failed, keeping the current list`, error);
      continue;
    }
    if (!acceptRefreshedList(category, domains.length, before.lists.installed?.[category]?.domains)) {
      console.warn(`[lists] ${category}: refusing a list of ${domains.length} domains`);
      continue;
    }
    await enqueue(async () => {
      const state = await loadState();
      if (!state.lists.refreshEnabled || !state.categories[category].enabled) return;
      await installListRule(category, listRulesetRule(category, domains));
      await apply({ type: 'listRefreshed', category, domains: domains.length });
    });
    // The safety net's table takes the new list too (#16), in the table queue.
    void enqueueTable(async () => {
      const state = await loadState();
      if (state.lists.installed?.[category]) await replaceTable(category, domains, 'refreshed');
    });
  }
}

export default defineBackground(() => {
  // Registered first, while the worker starts: this is how a re-enable is noticed (D14).
  onReEnabled(() => void dispatch({ type: 'tamper' }));
  // Every time the worker wakes, including on browser start and after a re-enable,
  // and whenever the user changes the extension's site access.
  void checkAccess();
  onSiteAccessChanged(() => void checkAccess());
  // Fills a missing list table (first run, an update, or storage cleared) in the background.
  void syncListTables();
  // A tab's address changes when a page is actually shown, however it was served (#15).
  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url) void catchBlockedTab(tabId, changeInfo.url);
  });

  browser.runtime.onInstalled.addListener(async ({ reason }) => {
    // First run: open setup (SPEC §7.6). Updates don't reopen it.
    if (reason === 'install') void openOnboarding();
    // Sites blocked before this version may still have a service worker serving their pages.
    if (reason === 'update') void loadState().then((state) => clearSiteData(blockedSiteDomains(state).flatMap(originsFor)));
    browser.contextMenus.create({ id: MENU_BLOCK_LINK, title: t('menuBlockLink'), contexts: ['link'] });
    // Defaults in the user's language, so setup can be skipped (Q14). No-op once any redirect exists.
    await dispatch({
      type: 'seedRedirects',
      redirects: [
        { kind: 'instruction', text: t('redirectDefaultWalk') },
        { kind: 'instruction', text: t('redirectDefaultWater') },
        { kind: 'instruction', text: t('redirectDefaultWrite') },
      ],
    });
    await syncBrowser(await loadState());
  });

  browser.runtime.onStartup.addListener(async () => {
    await syncBrowser(await loadState());
  });

  // Expired removal requests also drop on any write; this tidies up when nothing else happens.
  ensureAlarm(ALARM_EXPIRE_REMOVALS, 60);
  // Graduation is also checked whenever the popup opens.
  ensureAlarm(ALARM_CHECK_GRADUATION, 24 * 60);
  // Weekly, with the first run a minute after install so a fresh install gets fresh lists.
  ensureAlarm(ALARM_REFRESH_LISTS, 7 * 24 * 60, 1);
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_REFRESH_LISTS) void refreshLists();
    if (alarm.name === ALARM_EXPIRE_REMOVALS) void dispatch({ type: 'expireRemovals' });
    if (alarm.name === ALARM_CHECK_GRADUATION) void dispatch({ type: 'checkGraduation' });
  });

  browser.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId !== MENU_BLOCK_LINK || !info.linkUrl) return;
    const target = targetFromUrl(info.linkUrl);
    if (target) void dispatch({ type: 'addBlock', domain: target.domain });
  });

  browser.runtime.onMessage.addListener((message: CommandMessage, _sender, sendResponse) => {
    if (message?.type !== 'command') return;
    dispatch(message.command).then(sendResponse, (error) => sendResponse({ ok: false, error: String(error) }));
    return true; // keep the channel open for the async response
  });
});
