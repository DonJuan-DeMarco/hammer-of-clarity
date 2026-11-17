/** Editing the "do this instead" suggestions (D7). Used by settings and onboarding. */
import { useState } from 'preact/hooks';
import type { RedirectInput } from '../core/redirects';
import type { Redirect } from '../core/types';
import { t, type MessageKey } from '../adapters/i18n';
import { sendCommand } from '../adapters/messages';

/** Redirects change instantly in both directions; they don't weaken a wall (D33). */
export function RedirectsEditor({ redirects }: { redirects: Redirect[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);

  async function run(command: Parameters<typeof sendCommand>[0]): Promise<boolean> {
    const result = await sendCommand(command);
    if (result.ok) {
      setError(null);
      return true;
    }
    setError(result.reason === 'lastRedirect' ? 'redirectLastOne' : 'redirectInvalid');
    return false;
  }

  return (
    <section aria-label={t('settingsRedirects')} data-testid="redirects">
      <h2>{t('settingsRedirects')}</h2>
      <p>{t('settingsRedirectsHint')}</p>
      <ul>
        {redirects.map((redirect) =>
          editing === redirect.id ? (
            <li key={redirect.id}>
              <RedirectForm
                initial={redirect}
                submitLabel="redirectSave"
                onSubmit={(input) => run({ type: 'updateRedirect', id: redirect.id, ...input }).then((ok) => ok && setEditing(null))}
                onCancel={() => setEditing(null)}
              />
            </li>
          ) : (
            <li key={redirect.id} data-testid="redirect-item">
              <span>{redirect.text}</span>
              {redirect.kind === 'link' && <span> ({redirect.url})</span>}{' '}
              <button type="button" onClick={() => setEditing(redirect.id)}>
                {t('redirectEdit')}
              </button>{' '}
              <button type="button" onClick={() => void run({ type: 'removeRedirect', id: redirect.id })}>
                {t('redirectRemove')}
              </button>
            </li>
          ),
        )}
      </ul>
      <RedirectForm submitLabel="redirectAdd" onSubmit={(input) => run({ type: 'addRedirect', ...input })} />
      {error && <p role="alert">{t(error)}</p>}
    </section>
  );
}

function RedirectForm(props: {
  initial?: RedirectInput;
  submitLabel: MessageKey;
  onSubmit: (input: RedirectInput) => Promise<unknown>;
  onCancel?: () => void;
}) {
  const [kind, setKind] = useState<RedirectInput['kind']>(props.initial?.kind ?? 'instruction');
  const [text, setText] = useState(props.initial?.text ?? '');
  const [url, setUrl] = useState(props.initial?.url ?? '');

  async function submit(event: Event) {
    event.preventDefault();
    await props.onSubmit({ kind, text, ...(kind === 'link' && { url }) });
    if (!props.initial) {
      setText('');
      setUrl('');
    }
  }

  return (
    <form onSubmit={submit}>
      <select value={kind} onChange={(e) => setKind(e.currentTarget.value as RedirectInput['kind'])}>
        <option value="instruction">{t('redirectKindInstruction')}</option>
        <option value="link">{t('redirectKindLink')}</option>
      </select>{' '}
      <input
        type="text"
        placeholder={t('redirectTextPlaceholder')}
        value={text}
        onInput={(e) => setText(e.currentTarget.value)}
      />{' '}
      {kind === 'link' && (
        <input type="url" placeholder={t('redirectUrlPlaceholder')} value={url} onInput={(e) => setUrl(e.currentTarget.value)} />
      )}{' '}
      <button type="submit">{t(props.submitLabel)}</button>
      {props.onCancel && (
        <button type="button" onClick={props.onCancel}>
          {t('redirectCancel')}
        </button>
      )}
    </form>
  );
}
