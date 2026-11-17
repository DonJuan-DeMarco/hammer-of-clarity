/** One-time note that a category has graduated (D19): trust only works as a reward if you know. */
import { useEffect, useRef } from 'preact/hooks';
import { pendingGraduationAnnouncements } from '../core/graduation';
import type { CategoryId, State } from '../core/types';
import { t } from '../adapters/i18n';
import { sendCommand } from '../adapters/messages';
import { CATEGORY_NAMES } from './categoryNames';

export function GraduationNotice({ state }: { state: State }) {
  // Captured on first sight, so acknowledging doesn't hide it mid-read.
  const shown = useRef<CategoryId[] | undefined>(undefined);
  if (shown.current === undefined) shown.current = pendingGraduationAnnouncements(state);

  useEffect(() => {
    if (shown.current?.length) void sendCommand({ type: 'acknowledgeGraduations' });
  }, []);

  if (!shown.current.length) return null;
  return (
    <section class="graduation-notice" role="status" data-testid="graduation-notice">
      {shown.current.map((id) => (
        <p key={id}>
          <strong>{t('graduationAnnouncement', t(CATEGORY_NAMES[id]))}</strong>
        </p>
      ))}
      <p>{t('graduationExplain')}</p>
    </section>
  );
}
