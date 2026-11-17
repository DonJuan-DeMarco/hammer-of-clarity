import { browser } from 'wxt/browser';
import { targetFromUrl } from '../core/domain';
import { reduce, type Command, type CommandResult } from '../core/reducer';
import { buildRules } from '../core/rules';
import type { State } from '../core/types';
import { replaceDynamicRules } from '../adapters/dnr';
import { t } from '../adapters/i18n';
import type { CommandMessage } from '../adapters/messages';
import { loadState, saveState } from '../adapters/storage';

const MENU_BLOCK_LINK = 'block-link';

/** The only path for change: command → reducer → save → rules. */
async function apply(command: Command): Promise<CommandResult> {
  const state = await loadState();
  const { state: next, result } = reduce(state, command, Date.now());
  if (next !== state) {
    await saveState(next);
    await syncRules(next);
  }
  return result;
}

async function syncRules(state: State): Promise<void> {
  await replaceDynamicRules(buildRules(state));
}

// Commands run one at a time so two quick clicks can't overwrite each other's state.
let queue: Promise<unknown> = Promise.resolve();
function dispatch(command: Command): Promise<CommandResult> {
  const run = queue.then(() => apply(command));
  queue = run.catch(() => undefined);
  return run;
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(async () => {
    browser.contextMenus.create({ id: MENU_BLOCK_LINK, title: t('menuBlockLink'), contexts: ['link'] });
    await syncRules(await loadState());
  });

  browser.runtime.onStartup.addListener(async () => {
    await syncRules(await loadState());
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
