/** Settings page (SPEC §7.8). This ticket: category cards. Later tickets add requests, redirects, lists. */
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { CURATED_LISTS, entryKey, isCurated, type CuratedCategoryId } from '../../core/categories';
import { stageFor, type Stage } from '../../core/stages';
import type { CategoryId } from '../../core/types';
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
    </main>
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
