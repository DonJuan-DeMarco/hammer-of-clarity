import { render } from 'preact';
import { t } from '../../adapters/i18n';

function BlockPage() {
  return (
    <main>
      <p data-testid="reason">{t('blockDefaultReason')}</p>
      <button type="button" onClick={() => history.back()}>
        {t('blockGoBack')}
      </button>
    </main>
  );
}

render(<BlockPage />, document.getElementById('app')!);
