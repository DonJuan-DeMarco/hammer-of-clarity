import { browser } from 'wxt/browser';
import { targetFromUrl } from '../core/domain';
import { reduce, type Command, type CommandResult } from '../core/reducer';
import { parseDomainList } from '../core/lists';
import { acceptRefreshedList, listRulePlan } from '../core/refresh';
import { buildRules, LIST_CATEGORIES, listRulesetRule } from '../core/rules';
import type { State } from '../core/types';
import { applyRules, installListRule } from '../adapters/dnr';
import { downloadList } from '../adapters/lists';
import { t } from '../adapters/i18n';
import type { CommandMessage } from '../adapters/messages';
import { isIncognitoAllowed, onReEnabled, setIncognitoWarning } from '../adapters/lifecycle';
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
  }
  return result;
}

/** Makes the browser match the state: blocking rules, and the warning badge while incognito is uncovered. */
async function syncBrowser(state: State): Promise<void> {
  await applyRules(buildRules(state), listRulePlan(state));
  await setIncognitoWarning(!state.incognitoWasAllowed);
}

async function checkIncognito(): Promise<void> {
  await dispatch({ type: 'incognitoStatus', allowed: await isIncognitoAllowed() });
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
  }
}

export default defineBackground(() => {
  // Registered first, while the worker starts: this is how a re-enable is noticed (D14).
  onReEnabled(() => void dispatch({ type: 'tamper' }));
  // Every time the worker wakes, including on browser start and after a re-enable.
  void checkIncognito();

  browser.runtime.onInstalled.addListener(async () => {
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
