import { browser } from 'wxt/browser';
import type { Command, CommandResult } from '../core/reducer';

/** The one message the UI sends: a command for the background to apply. */
export interface CommandMessage {
  type: 'command';
  command: Command;
}

export function sendCommand(command: Command): Promise<CommandResult> {
  return browser.runtime.sendMessage({ type: 'command', command } satisfies CommandMessage);
}
