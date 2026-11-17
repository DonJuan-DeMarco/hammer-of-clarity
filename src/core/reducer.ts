import { normalizeDomain } from './domain';
import type { Block, State } from './types';

/** Every change to State is one of these. The UI sends them; only the reducer applies them. */
export type Command = { type: 'addBlock'; domain: string; pathPrefix?: string; reason?: string };

export type CommandResult =
  | { ok: true; blockId?: string }
  | { ok: false; reason: 'alreadyBlocked' | 'invalidDomain' };

export type IdGenerator = () => string;

const defaultIds: IdGenerator = () => crypto.randomUUID();

/** Pure: (state, command, now) → new state. Returns the same state object when nothing changes. */
export function reduce(
  state: State,
  command: Command,
  now: number,
  newId: IdGenerator = defaultIds,
): { state: State; result: CommandResult } {
  switch (command.type) {
    case 'addBlock':
      return addBlock(state, command, now, newId);
  }
}

function addBlock(
  state: State,
  command: Extract<Command, { type: 'addBlock' }>,
  now: number,
  newId: IdGenerator,
): { state: State; result: CommandResult } {
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

/** True when an existing block already blocks everything the new one would. */
function isCovered(blocks: Block[], domain: string, pathPrefix: string | undefined): boolean {
  return blocks.some(
    (b) => b.domain === domain && (b.pathPrefix === undefined || b.pathPrefix === pathPrefix),
  );
}
