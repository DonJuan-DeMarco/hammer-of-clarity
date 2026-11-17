import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { CategoryId } from '../../core/types';
import { t } from '../../adapters/i18n';
import { loadState } from '../../adapters/storage';

/** A personal block's own reason, or the category's reason, else the default (SPEC §7.7). */
async function reasonFor(params: URLSearchParams): Promise<string> {
  const state = await loadState();
  const blockId = params.get('b');
  const category = params.get('c');
  const reason = blockId
    ? state.blocks.find((b) => b.id === blockId)?.reason
    : category && category in state.categories
      ? state.categories[category as CategoryId].reason
      : undefined;
  return reason ?? t('blockDefaultReason');
}

function BlockPage() {
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    reasonFor(new URLSearchParams(location.search)).then(setReason);
  }, []);

  if (reason === null) return null;
  return (
    <main>
      <p data-testid="reason">{reason}</p>
      <button type="button" onClick={() => history.back()}>
        {t('blockGoBack')}
      </button>
    </main>
  );
}

render(<BlockPage />, document.getElementById('app')!);
