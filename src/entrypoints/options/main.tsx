/** Settings page (SPEC §7.8). This ticket: category cards. Later tickets add requests, redirects, lists. */
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { CURATED_LISTS, entryKey, isCurated, type CuratedCategoryId } from '../../core/categories';
import { stageFor, type Stage } from '../../core/stages';
import type { RedirectInput } from '../../core/redirects';
import type { CategoryId, Redirect } from '../../core/types';
import { t, type MessageKey } from '../../adapters/i18n';
import { sendCommand } from '../../adapters/messages';
import { StageBadge } from '../../ui/StageBadge';
import { useAppState } from '../../ui/useAppState';

type ListCategoryId = Exclude<CategoryId, 'personal'>;

const CARDS: { id: ListCategoryId; name: MessageKey; description: MessageKey }[] = [
  { id: 'adult', name: 'categoryAdultName', description: 'categoryAdultDescription' },
  { id: 'gambling', name: 'categoryGamblingName', description: 'categoryGamblingDescription' },
  { id: 'social', name: 'categorySocialName', description: 'categorySocialDescription' },
  { id: 'short-video', name: 'categoryShortVideoName', description: 'categoryShortVideoDescription' },
];

function Settings() {
  const state = useAppState();
  if (!state) return null;
  const now = Date.now();
  return (
    <main>
      <h1>{t('settingsTitle')}</h1>
      <section aria-label={t('settingsCategories')}>
        {CARDS.map((card) => (
          <CategoryCard
            key={card.id}
            {...card}
            enabled={state.categories[card.id].enabled}
            stage={stageFor(state.categories[card.id], now)}
          />
        ))}
      </section>
      <RedirectsEditor redirects={state.redirects} />
    </main>
  );
}

/** Redirects change instantly in both directions; they don't weaken a wall (D33). */
function RedirectsEditor({ redirects }: { redirects: Redirect[] }) {
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

function CategoryCard(props: {
  id: ListCategoryId;
  name: MessageKey;
  description: MessageKey;
  enabled: boolean;
  stage: Stage | null;
}) {
  const [open, setOpen] = useState(false);
  const available = isCurated(props.id);

  return (
    <article data-testid={`category-${props.id}`}>
      <h2>{t(props.name)}</h2>
      <p>{t(props.description)}</p>
      {props.enabled ? (
        <p>
          {t('categoryOn')} {props.stage && <StageBadge stage={props.stage} />}
        </p>
      ) : !available ? (
        <p>{t('categoryComingSoon')}</p>
      ) : open ? (
        <CategorySetup id={props.id as CuratedCategoryId} />
      ) : (
        <button type="button" onClick={() => setOpen(true)}>
          {t('categoryChoose')}
        </button>
      )}
    </article>
  );
}

/** Untick freely here; after setup, taking a site out is a removal request (D21). */
function CategorySetup({ id }: { id: CuratedCategoryId }) {
  const list = CURATED_LISTS[id];
  const [unticked, setUnticked] = useState(() => list.filter((e) => e.defaultExcluded).map(entryKey));
  const [reason, setReason] = useState('');

  const toggle = (key: string, ticked: boolean) =>
    setUnticked((current) => (ticked ? current.filter((k) => k !== key) : [...current, key]));

  return (
    <div>
      <p>{t('categorySitesHint')}</p>
      <ul>
        {list.map((entry) => {
          const key = entryKey(entry);
          return (
            <li key={key}>
              <label>
                <input
                  type="checkbox"
                  checked={!unticked.includes(key)}
                  onChange={(e) => toggle(key, e.currentTarget.checked)}
                />
                {key}
              </label>
            </li>
          );
        })}
      </ul>
      <input
        type="text"
        placeholder={t('categoryReasonPlaceholder')}
        value={reason}
        onInput={(e) => setReason(e.currentTarget.value)}
      />
      <button type="button" onClick={() => sendCommand({ type: 'enableCategory', category: id, reason, excluded: unticked })}>
        {t('categoryTurnOn')}
      </button>
    </div>
  );
}

render(<Settings />, document.getElementById('app')!);
