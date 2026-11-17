import { browser } from 'wxt/browser';
import { initialState } from '../core/state';
import type { State } from '../core/types';

const KEY = 'state:v1';

export async function loadState(): Promise<State> {
  const stored = (await browser.storage.local.get(KEY))[KEY] as State | undefined;
  return stored ? { ...initialState(), ...stored } : initialState();
}

export async function saveState(state: State): Promise<void> {
  await browser.storage.local.set({ [KEY]: state });
}
