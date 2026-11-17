/** Settings page (SPEC §7.8): removal requests, categories, your sites, redirects. */
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { blockedEntries, CURATED_LISTS, entryKey, isCurated, type CuratedCategoryId } from '../../core/categories';
import { stageFor } from '../../core/stages';
import type { ListCategoryId } from '../../core/rules';
import type { CategoryId, State } from '../../core/types';
import { formatTime, RemovalRequests, RequestRemovalButton, useNow } from './removals';
import { t, type MessageKey } from '../../adapters/i18n';
import { sendCommand } from '../../adapters/messages';
import { StageBadge } from '../../ui/StageBadge';
import { RedirectsEditor } from '../../ui/RedirectsEditor';
import { useAppState } from '../../ui/useAppState';

/** Every category with a card. `personal` is shown as "Your sites" instead. */
type CardCategoryId = Exclude<CategoryId, 'personal'>;

const CARDS: { id: CardCategoryId; name: MessageKey; description: MessageKey }[] = [
  { id: 'adult', name: 'categoryAdultName', description: 'categoryAdultDescription' },
  { id: 'gambling', name: 'categoryGamblingName', description: 'categoryGamblingDescription' },
  { id: 'social', name: 'categorySocialName', description: 'categorySocialDescription' },
  { id: 'short-video', name: 'categoryShortVideoName', description: 'categoryShortVideoDescription' },
];

function Settings() {
  const state = useAppState();
  const now = useNow();
  if (!state) return null;
  return (
    <main>
      <h1>{t('settingsTitle')}</h1>
      <RemovalRequests state={state} now={now} />
      <section aria-label={t('settingsCategories')}>
        {CARDS.map((card) => (
          <CategoryCard key={card.id} {...card} state={state} now={now} />
        ))}
      </section>
      <PersonalBlocks state={state} now={now} />
      <RedirectsEditor redirects={state.redirects} />
      <ListsSection state={state} />
    </main>
  );
}

function PersonalBlocks({ state, now }: { state: State; now: number }) {
  if (state.blocks.length === 0) return null;
  return (
    <section aria-label={t('settingsYourSites')} data-testid="personal-blocks">
      <h2>{t('settingsYourSites')}</h2>
      <ul>
        {state.blocks.map((block) => (
          <li key={block.id}>
            {entryKey(block)} <RequestRemovalButton state={state} now={now} target={{ kind: 'block', blockId: block.id }} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CategoryCard(props: { id: CardCategoryId; name: MessageKey; description: MessageKey; state: State; now: number }) {
  const [open, setOpen] = useState(false);
  const { id, state, now } = props;
  const category = state.categories[id];
  const stage = stageFor(category, now);

  return (
    <article data-testid={`category-${id}`}>
      <h2>{t(props.name)}</h2>
      <p>{t(props.description)}</p>
      {category.enabled ? (
        <>
          <p>
            {t('categoryOn')} {stage && <StageBadge stage={stage} />}{' '}
            <RequestRemovalButton state={state} now={now} target={{ kind: 'category', category: id }} label="removalRequestCategory" />
          </p>
          {isCurated(id) && (
            <details>
              <summary>{t('categorySites')}</summary>
              <ul>
                {blockedEntries(id, category).map((entry) => (
                  <li key={entryKey(entry)} data-testid={`site-${entryKey(entry)}`}>
                    {entryKey(entry)}{' '}
                    <RequestRemovalButton
                      state={state}
                      now={now}
                      target={{ kind: 'exception', category: id, domain: entry.domain, ...(entry.pathPrefix && { pathPrefix: entry.pathPrefix }) }}
                    />
                  </li>
                ))}
              </ul>
            </details>
          )}
          {!isCurated(id) && <WronglyBlocked id={id} state={state} />}
        </>
      ) : open ? (
        isCurated(id) ? <CategorySetup id={id} /> : <ListCategorySetup id={id} />
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

/** Weekly list downloads (D16): on by default, and switching off is instant (D33). */
function ListsSection({ state }: { state: State }) {
  const { refreshEnabled, lastRefreshedAt } = state.lists;
  return (
    <section aria-label={t('settingsLists')} data-testid="lists">
      <h2>{t('settingsLists')}</h2>
      <label>
        <input
          type="checkbox"
          checked={refreshEnabled}
          onChange={(e) => void sendCommand({ type: 'setListRefresh', enabled: e.currentTarget.checked })}
        />{' '}
        {t('listsRefreshLabel')}
      </label>
      <p>{t('listsRefreshHint')}</p>
      <p data-testid="lists-status">
        {refreshEnabled && lastRefreshedAt ? t('listsLastUpdated', formatTime(lastRefreshedAt)) : t('listsBundled')}
      </p>
    </section>
  );
}

/** Adult and gambling come from long maintained lists: no checklist, just a reason. */
function ListCategorySetup({ id }: { id: ListCategoryId }) {
  const [reason, setReason] = useState('');
  return (
    <div>
      <p>{t('categoryListHint')}</p>
      <input
        type="text"
        placeholder={t('categoryReasonPlaceholder')}
        value={reason}
        onInput={(e) => setReason(e.currentTarget.value)}
      />
      <button type="button" onClick={() => sendCommand({ type: 'enableCategory', category: id, reason })}>
        {t('categoryTurnOn')}
      </button>
    </div>
  );
}

/**
 * Lists make mistakes. Letting a wrongly listed site through is a removal request
 * (24 hours, then the retype) but never resets the category (D32).
 */
function WronglyBlocked({ id, state }: { id: ListCategoryId; state: State }) {
  const [domain, setDomain] = useState('');
  const [error, setError] = useState(false);
  const { exceptions } = state.categories[id];

  async function submit(event: Event) {
    event.preventDefault();
    const result = await sendCommand({
      type: 'requestRemoval',
      target: { kind: 'exception', category: id, domain },
      fallbackConfirmText: t('removalFixedSentence'),
    });
    setError(!result.ok);
    if (result.ok) setDomain('');
  }

  return (
    <details data-testid={`wrongly-blocked-${id}`}>
      <summary>{t('wronglyBlockedSummary')}</summary>
      <p>{t('wronglyBlockedHint')}</p>
      {exceptions.length > 0 && (
        <ul>
          {exceptions.map((e) => (
            <li key={entryKey(e)}>{t('wronglyBlockedLetThrough', entryKey(e))}</li>
          ))}
        </ul>
      )}
      <form onSubmit={submit}>
        <input
          type="text"
          placeholder={t('wronglyBlockedPlaceholder')}
          value={domain}
          onInput={(e) => setDomain(e.currentTarget.value)}
        />{' '}
        <button type="submit">{t('wronglyBlockedRequest')}</button>
      </form>
      {error && <p role="alert">{t('wronglyBlockedInvalid')}</p>}
    </details>
  );
}

render(<Settings />, document.getElementById('app')!);
