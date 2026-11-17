import { render } from 'preact';
import { stageFor } from '../../core/stages';
import type { CategoryId, State } from '../../core/types';
import { t } from '../../adapters/i18n';
import { StageBadge } from '../../ui/StageBadge';
import { useAppState } from '../../ui/useAppState';

/** Which block sent us here: a personal block (`?b=`) or a category (`?c=`). */
function blockedBy(state: State, params: URLSearchParams): { category: CategoryId | null; reason?: string } {
  const blockId = params.get('b');
  if (blockId) {
    return { category: 'personal', reason: state.blocks.find((b) => b.id === blockId)?.reason };
  }
  const category = params.get('c');
  if (category && category in state.categories) {
    const id = category as CategoryId;
    return { category: id, reason: state.categories[id].reason };
  }
  return { category: null };
}

function BlockPage() {
  const state = useAppState();
  if (!state) return null;

  const { category, reason } = blockedBy(state, new URLSearchParams(location.search));
  const stage = category ? stageFor(state.categories[category], Date.now()) : null;

  return (
    <main>
      {stage && <StageBadge stage={stage} />}
      {/* SPEC §7.7: the block's own reason, or the category's reason, else the default. */}
      <p data-testid="reason">{reason ?? t('blockDefaultReason')}</p>
      <button type="button" onClick={() => history.back()}>
        {t('blockGoBack')}
      </button>
    </main>
  );
}

render(<BlockPage />, document.getElementById('app')!);
