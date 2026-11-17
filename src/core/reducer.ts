import { exceptionsFor, isCurated } from './categories';
import { normalizeDomain } from './domain';
import { cleanRedirect, type RedirectInput } from './redirects';
import {
  applyRemoval,
  confirmTextFor,
  cooldownFor,
  dropExpired,
  newRequest,
  normalizeConfirmText,
  requestStatus,
  resolveTarget,
  sameTarget,
} from './removal';
import { DAY_MS } from './stages';
import { acknowledgeResets, applyIncognitoStatus, resetAll } from './tamper';
import type { Block, CategoryId, RemovalTarget, State } from './types';

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
  | { type: 'recordAttempt'; category: CategoryId }
  /** `fallbackConfirmText`: the fixed sentence in the user's language, used when there's no reason (D23). */
  | { type: 'requestRemoval'; target: RemovalTarget; fallbackConfirmText: string }
  | { type: 'cancelRemoval'; id: string }
  | { type: 'confirmRemoval'; id: string; text: string }
  | { type: 'expireRemovals' }
  /** The extension was switched off and back on (D14). */
  | { type: 'tamper' }
  | { type: 'incognitoStatus'; allowed: boolean }
  /** The gentle reset message has been shown. */
  | { type: 'acknowledgeResets' };

export type CommandResult =
  | { ok: true; blockId?: string; requestId?: string }
  | {
      ok: false;
      reason:
        | 'alreadyBlocked'
        | 'invalidDomain'
        | 'alreadyEnabled'
        | 'notAvailable'
        | 'invalidRedirect'
        | 'lastRedirect'
        | 'notFound'
        | 'invalidRequest'
        | 'notReady'
        | 'wrongText';
    };

/** Attempts are kept this long, only to decide graduation (D24). Never shown. */
const ATTEMPT_WINDOW_MS = 30 * DAY_MS;

export type IdGenerator = () => string;

type Outcome = { state: State; result: CommandResult };

const defaultIds: IdGenerator = () => crypto.randomUUID();

/** Pure: (state, command, now) → new state. Returns the same state object when nothing changes. */
export function reduce(original: State, command: Command, now: number, newId: IdGenerator = defaultIds): Outcome {
  // Expired removal requests vanish on the next write, whatever it is.
  const state = dropExpired(original, now);
  switch (command.type) {
    case 'expireRemovals':
      return { state, result: { ok: true } };
    case 'tamper':
      return { state: resetAll(state, now), result: { ok: true } };
    case 'incognitoStatus':
      return { state: applyIncognitoStatus(state, command.allowed, now), result: { ok: true } };
    case 'acknowledgeResets':
      return { state: acknowledgeResets(state), result: { ok: true } };
    case 'requestRemoval': {
      const target = resolveTarget(state, command.target);
      if (!target) return fail(state, 'notFound');
      const existing = state.removalRequests.find((r) => sameTarget(r.target, target));
      if (existing) return { state, result: { ok: true, requestId: existing.id } };
      const confirmText = confirmTextFor(state, target, command.fallbackConfirmText);
      if (!confirmText) return fail(state, 'invalidRequest');
      const request = newRequest(newId(), target, now, confirmText, cooldownFor(target));
      return {
        state: { ...state, removalRequests: [...state.removalRequests, request] },
        result: { ok: true, requestId: request.id },
      };
    }
    case 'cancelRemoval': {
      if (!state.removalRequests.some((r) => r.id === command.id)) return fail(state, 'notFound');
      return { state: { ...state, removalRequests: state.removalRequests.filter((r) => r.id !== command.id) }, result: { ok: true } };
    }
    case 'confirmRemoval': {
      const request = state.removalRequests.find((r) => r.id === command.id);
      if (!request) return fail(state, 'notFound');
      if (requestStatus(request, now) !== 'confirmable') return fail(state, 'notReady');
      const remaining = { ...state, removalRequests: state.removalRequests.filter((r) => r.id !== request.id) };
      // The wall may have gone another way in the meantime; then there's nothing left to remove.
      if (!resolveTarget(state, request.target)) return { state: remaining, result: { ok: false, reason: 'notFound' } };
      if (normalizeConfirmText(command.text) !== request.confirmText) return fail(state, 'wrongText');
      return { state: applyRemoval(remaining, request.target, now), result: { ok: true } };
    }
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
