import { useEffect, useState } from 'preact/hooks';
import { browser } from 'wxt/browser';
import type { State } from '../core/types';
import { loadState } from '../adapters/storage';

/** The stored state, kept in step with storage so a change made elsewhere shows up here too. */
export function useAppState(): State | null {
  const [state, setState] = useState<State | null>(null);
  useEffect(() => {
    const refresh = () => void loadState().then(setState);
    refresh();
    browser.storage.onChanged.addListener(refresh);
    return () => browser.storage.onChanged.removeListener(refresh);
  }, []);
  return state;
}
