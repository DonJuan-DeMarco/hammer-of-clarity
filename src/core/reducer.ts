import { exceptionsFor, isCurated } from './categories';
import { normalizeDomain } from './domain';
import { cleanRedirect, type RedirectInput } from './redirects';
import { DAY_MS } from './stages';
import type { Block, CategoryId, State } from './types';

/** Every change to State is one of these. The UI sends them; only the reducer applies them. */
export type Command =
  | { type: 'addBlock'; domain: string; pathPrefix?: string; reason?: string }
  /** `excluded`: site keys (`domain` or `domain/path`) unticked at setup. Omitted → the list's defaults. */
  | { type: 'enableCategory'; category: CategoryId; reason?: string; excluded?: string[] }
  /** Install-time defaults, in the user's language. Ignored once any redirect exists. */
  | { type: 'seedRedirects'; redirects: RedirectInput[] }
  | ({ type: 'addRedirect' } & RedirectInput)
  | ({ type: 'updateRedirect'; id: string } & RedirectInput)
  | { type: 'removeRedirect'; id: string }
  | { type: 'recordAttempt'; category: CategoryId };

export type CommandResult =
  | { ok: true; blockId?: string }
  | {
      ok: false;
      reason:
        | 'alreadyBlocked'
        | 'invalidDomain'
        | 'alreadyEnabled'
        | 'notAvailable'
        | 'invalidRedirect'
        | 'lastRedirect'
        | 'notFound';
    };

/** Attempts are kept this long, only to decide graduation (D24). Never shown. */
const ATTEMPT_WINDOW_MS = 30 * DAY_MS;

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
    case 'seedRedirects': {
      if (state.redirects.length > 0) return { state, result: { ok: true } };
      const redirects = command.redirects.flatMap((input) => {
        const clean = cleanRedirect(input);
        return clean ? [{ id: newId(), ...clean }] : [];
      });
      return { state: { ...state, redirects }, result: { ok: true } };
    }
    case 'addRedirect': {
      const clean = cleanRedirect(command);
      if (!clean) return fail(state, 'invalidRedirect');
      return { state: { ...state, redirects: [...state.redirects, { id: newId(), ...clean }] }, result: { ok: true } };
    }
    case 'updateRedirect': {
      if (!state.redirects.some((r) => r.id === command.id)) return fail(state, 'notFound');
      const clean = cleanRedirect(command);
      if (!clean) return fail(state, 'invalidRedirect');
      const redirects = state.redirects.map((r) => (r.id === command.id ? { id: r.id, ...clean } : r));
      return { state: { ...state, redirects }, result: { ok: true } };
    }
    case 'removeRedirect': {
      if (!state.redirects.some((r) => r.id === command.id)) return fail(state, 'notFound');
      // The block page always has something to offer instead (D33).
      if (state.redirects.length === 1) return fail(state, 'lastRedirect');
      return { state: { ...state, redirects: state.redirects.filter((r) => r.id !== command.id) }, result: { ok: true } };
    }
    case 'recordAttempt': {
      // Hitting the block page is the system working: it is logged, never punished (D9).
      const attempts = [
        ...state.attempts.filter((a) => a.at > now - ATTEMPT_WINDOW_MS),
        { category: command.category, at: now },
      ];
      return { state: { ...state, attempts }, result: { ok: true } };
    }
  }
}

function fail(state: State, reason: Extract<CommandResult, { ok: false }>['reason']): Outcome {
  return { state, result: { ok: false, reason } };
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
