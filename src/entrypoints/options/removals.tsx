/** Removal requests in settings (SPEC §7.2, §7.8): ask, wait, retype, or cancel. */
import { useEffect, useState } from 'preact/hooks';
import { entryKey } from '../../core/categories';
import { liveRequests, requestStatus, sameTarget } from '../../core/removal';
import type { RemovalRequest, RemovalTarget, State } from '../../core/types';
import { t, type MessageKey } from '../../adapters/i18n';
import { sendCommand } from '../../adapters/messages';
import { CATEGORY_NAMES } from '../../ui/categoryNames';

/**
 * The current time, read fresh on every render (so a request created a moment ago with no
 * cooldown is already confirmable), plus a re-render every 30 s so waiting ones flip over.
 */
export function useNow(): number {
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(timer);
  }, []);
  return Date.now();
}

const formatTime = (at: number) =>
  new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(at);

export function describeTarget(state: State, target: RemovalTarget): string {
  switch (target.kind) {
    case 'block': {
      const block = state.blocks.find((b) => b.id === target.blockId);
      return block ? entryKey(block) : '';
    }
    case 'category':
      return t(CATEGORY_NAMES[target.category]);
    case 'exception':
      return t('removalTargetSiteIn', [entryKey(target), t(CATEGORY_NAMES[target.category])]);
  }
}

/** The slow path's first step. Once asked, it just says so; there's nothing faster to click. */
export function RequestRemovalButton(props: { state: State; now: number; target: RemovalTarget; label?: MessageKey }) {
  const pending = liveRequests(props.state, props.now).some((r) => sameTarget(r.target, props.target));
  if (pending) return <span class="pending">{t('removalRequested')}</span>;
  return (
    <button
      type="button"
      onClick={() =>
        void sendCommand({ type: 'requestRemoval', target: props.target, fallbackConfirmText: t('removalFixedSentence') })
      }
    >
      {t(props.label ?? 'removalRequest')}
    </button>
  );
}

export function RemovalRequests({ state, now }: { state: State; now: number }) {
  const requests = liveRequests(state, now);
  if (requests.length === 0) return null;
  return (
    <section aria-label={t('removalSectionTitle')} data-testid="removal-requests">
      <h2>{t('removalSectionTitle')}</h2>
      <p>{t('removalSectionHint')}</p>
      <ul>
        {requests.map((request) => (
          <li key={request.id} data-testid="removal-request">
            <strong>{describeTarget(state, request.target)}</strong>
            <RequestBody request={request} now={now} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function RequestBody({ request, now }: { request: RemovalRequest; now: number }) {
  const [typed, setTyped] = useState('');
  const [wrong, setWrong] = useState(false);
  const cancel = (
    <button type="button" onClick={() => void sendCommand({ type: 'cancelRemoval', id: request.id })}>
      {t('removalCancel')}
    </button>
  );

  if (requestStatus(request, now) === 'cooling') {
    return (
      <p>
        {t('removalCoolingUntil', formatTime(request.readyAt))} {cancel}
      </p>
    );
  }

  async function confirm(event: Event) {
    event.preventDefault();
    const result = await sendCommand({ type: 'confirmRemoval', id: request.id, text: typed });
    setWrong(!result.ok && result.reason === 'wrongText');
  }

  // Typing it yourself is the point: paste and drop are refused (D11).
  const refuse = (event: Event) => event.preventDefault();

  return (
    <form onSubmit={confirm}>
      <p>{t('removalTypeToConfirm')}</p>
      <blockquote data-testid="confirm-text">{request.confirmText}</blockquote>
      <input
        type="text"
        aria-label={t('removalTypeToConfirm')}
        value={typed}
        autocomplete="off"
        spellcheck={false}
        onInput={(e) => setTyped(e.currentTarget.value)}
        onPaste={refuse}
        onDrop={refuse}
      />{' '}
      <button type="submit">{t('removalConfirm')}</button> {cancel}
      <p>{t('removalConfirmBefore', formatTime(request.expiresAt))}</p>
      {wrong && <p role="alert">{t('removalWrongText')}</p>}
    </form>
  );
}
