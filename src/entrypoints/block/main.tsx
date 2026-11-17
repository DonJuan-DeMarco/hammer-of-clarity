import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { t } from '../../adapters/i18n';
import { loadState } from '../../adapters/storage';

/** The block's own reason, else the default. Category reasons arrive in ticket 04. */
async function reasonFor(blockId: string | null): Promise<string> {
  if (!blockId) return t('blockDefaultReason');
  const state = await loadState();
  return state.blocks.find((b) => b.id === blockId)?.reason ?? t('blockDefaultReason');
}

function BlockPage() {
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    reasonFor(new URLSearchParams(location.search).get('b')).then(setReason);
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
