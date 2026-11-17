import { browser } from 'wxt/browser';
import { targetFromUrl } from '../core/domain';
import { reduce, type Command, type CommandResult } from '../core/reducer';
import { buildRules } from '../core/rules';
import type { State } from '../core/types';
import { replaceDynamicRules } from '../adapters/dnr';
import { t } from '../adapters/i18n';
import type { CommandMessage } from '../adapters/messages';
import { isIncognitoAllowed, onReEnabled, setIncognitoWarning } from '../adapters/lifecycle';
import { loadState, saveState } from '../adapters/storage';

const MENU_BLOCK_LINK = 'block-link';
const ALARM_EXPIRE_REMOVALS = 'expire-removals';

/** The only path for change: command → reducer → save → browser. */
async function apply(command: Command): Promise<CommandResult> {
  const state = await loadState();
  const { state: next, result } = reduce(state, command, Date.now());
  if (next !== state) {
    await saveState(next);
    await syncBrowser(next);
  }
  return result;
}

/** Makes the browser match the state: blocking rules, and the warning badge while incognito is uncovered. */
async function syncBrowser(state: State): Promise<void> {
  await replaceDynamicRules(buildRules(state));
  await setIncognitoWarning(!state.incognitoWasAllowed);
}

async function checkIncognito(): Promise<void> {
  await dispatch({ type: 'incognitoStatus', allowed: await isIncognitoAllowed() });
  await syncBrowser(await loadState());
}

// Commands run one at a time so two quick clicks can't overwrite each other's state.
let queue: Promise<unknown> = Promise.resolve();
function dispatch(command: Command): Promise<CommandResult> {
  const run = queue.then(() => apply(command));
  queue = run.catch(() => undefined);
  return run;
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

  // Expired removal requests also drop on any write; the alarm tidies up when nothing else happens.
  void browser.alarms.get(ALARM_EXPIRE_REMOVALS).then((existing) => {
    if (!existing) void browser.alarms.create(ALARM_EXPIRE_REMOVALS, { periodInMinutes: 60 });
  });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_EXPIRE_REMOVALS) void dispatch({ type: 'expireRemovals' });
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
