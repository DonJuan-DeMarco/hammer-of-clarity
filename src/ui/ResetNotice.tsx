/**
 * The gentle reset message (D10): no numbers, nothing about what was lost; it points
 * back to the user's reason and something to do instead. Shown once, then acknowledged.
 */
import { useEffect, useRef } from 'preact/hooks';
import { pickRedirect } from '../core/redirects';
import { pendingResets } from '../core/tamper';
import type { Redirect, State } from '../core/types';
import { t } from '../adapters/i18n';
import { sendCommand } from '../adapters/messages';

interface Snapshot {
  reason?: string;
  redirect: Redirect | null;
}

/** `withReasonAndRedirect`: off on the block page, which already shows both. */
export function ResetNotice({ state, withReasonAndRedirect = true }: { state: State; withReasonAndRedirect?: boolean }) {
  // Captured on first sight, so acknowledging (which clears the flags) doesn't hide it mid-read.
  const snapshot = useRef<Snapshot | null | undefined>(undefined);
  if (snapshot.current === undefined) {
    const reset = pendingResets(state);
    snapshot.current =
      reset.length === 0
        ? null
        : {
            reason: reset.map((id) => state.categories[id].reason).find(Boolean),
            redirect: pickRedirect(state.redirects),
          };
  }

  useEffect(() => {
    if (snapshot.current) void sendCommand({ type: 'acknowledgeResets' });
  }, []);

  const shown = snapshot.current;
  if (!shown) return null;
  return (
    <section class="reset-notice" role="status" data-testid="reset-notice">
      <p>
        <strong>{t('resetHeading')}</strong> {t('resetBody')}
      </p>
      {withReasonAndRedirect && shown.reason && (
        <p>
          {t('resetWhy')} <em>{shown.reason}</em>
        </p>
      )}
      {withReasonAndRedirect && shown.redirect && <p>{shown.redirect.text}</p>}
    </section>
  );
}
