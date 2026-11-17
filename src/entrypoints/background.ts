import { browser } from 'wxt/browser';
import { buildRules } from '../core/rules';
import { replaceDynamicRules } from '../adapters/dnr';

// Tracer bullet (ticket 01): one hard-coded block. Ticket 03 replaces this with real state.
const TRACER_BLOCKS = [{ id: 'test', domain: 'example.com' }];

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    void replaceDynamicRules(buildRules(TRACER_BLOCKS));
  });
});
