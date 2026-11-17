import { exceptionsFor, isCurated } from './categories';
import { normalizeDomain } from './domain';
import type { Block, CategoryId, State } from './types';

/** Every change to State is one of these. The UI sends them; only the reducer applies them. */
export type Command =
  | { type: 'addBlock'; domain: string; pathPrefix?: string; reason?: string }
  /** `excluded`: site keys (`domain` or `domain/path`) unticked at setup. Omitted → the list's defaults. */
  | { type: 'enableCategory'; category: CategoryId; reason?: string; excluded?: string[] };

export type CommandResult =
  | { ok: true; blockId?: string }
  | { ok: false; reason: 'alreadyBlocked' | 'invalidDomain' | 'alreadyEnabled' | 'notAvailable' };

export type IdGenerator = () => string;

type Outcome = { state: State; result: CommandResult };

const defaultIds: IdGenerator = () => crypto.randomUUID();

/** Pure: (state, command, now) → new state. Returns the same state object when nothing changes. */
export function reduce(state: State, command: Command, now: number, newId: IdGenerator = defaultIds): Outcome {
  switch (command.type) {
    case 'addBlock':
      return addBlock(state, command, now, newId);
    case 'enableCategory':
      return enableCategory(state, command, now);
  }
}

function addBlock(state: State, command: Extract<Command, { type: 'addBlock' }>, now: number, newId: IdGenerator): Outcome {
  const domain = normalizeDomain(command.domain);
  if (!domain) return { state, result: { ok: false, reason: 'invalidDomain' } };

  const pathPrefix = command.pathPrefix && command.pathPrefix !== '/' ? command.pathPrefix : undefined;
  if (isCovered(state.blocks, domain, pathPrefix)) {
    return { state, result: { ok: false, reason: 'alreadyBlocked' } };
  }

  const reason = command.reason?.trim();
  const block: Block = {
    id: newId(),
    domain,
    ...(pathPrefix && { pathPrefix }),
    ...(reason && { reason }),
    createdAt: now,
  };

  const personal = state.categories.personal;
  return {
    state: {
      ...state,
      blocks: [...state.blocks, block],
      categories: {
        ...state.categories,
        personal: personal.enabled ? personal : { ...personal, enabled: true, stageStartedAt: now },
      },
    },
    result: { ok: true, blockId: block.id },
  };
}

/** Turning a category on is instant (moves toward safety are never slowed). */
function enableCategory(state: State, command: Extract<Command, { type: 'enableCategory' }>, now: number): Outcome {
  const { category } = command;
  // Adult and gambling get their sites in ticket 05; until then, turning them on would block nothing.
  if (!isCurated(category)) return { state, result: { ok: false, reason: 'notAvailable' } };
  const current = state.categories[category];
  if (current.enabled) return { state, result: { ok: false, reason: 'alreadyEnabled' } };

  const reason = command.reason?.trim();
  const { reason: _previous, ...rest } = current;
  return {
    state: {
      ...state,
      categories: {
        ...state.categories,
        [category]: {
          ...rest,
          enabled: true,
          ...(reason && { reason }),
          stageStartedAt: now,
          exceptions: exceptionsFor(category, command.excluded, now),
        },
      },
    },
    result: { ok: true },
  };
}

/** True when an existing block already blocks everything the new one would. */
function isCovered(blocks: Block[], domain: string, pathPrefix: string | undefined): boolean {
  return blocks.some((b) => b.domain === domain && (b.pathPrefix === undefined || b.pathPrefix === pathPrefix));
}
