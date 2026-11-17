import { render } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { browser } from 'wxt/browser';
import { pickRedirect } from '../../core/redirects';
import { stageFor } from '../../core/stages';
import type { CategoryId, Redirect, State } from '../../core/types';
import { t } from '../../adapters/i18n';
import { sendCommand } from '../../adapters/messages';
import emblemUrl from '../../assets/emblem.svg';
import { ResetNotice } from '../../ui/ResetNotice';
import { StageBadge } from '../../ui/StageBadge';
import { useAppState } from '../../ui/useAppState';

const params = new URLSearchParams(location.search);

/** Which block sent us here: a personal block (`?b=`) or a category (`?c=`). */
function blockedCategory(): CategoryId | null {
  if (params.get('b')) return 'personal';
  const category = params.get('c');
  return category ? (category as CategoryId) : null;
}

/** SPEC §7.7: the block's own reason, or the category's reason, else the default. */
function reasonFor(state: State, category: CategoryId | null): string {
  const blockId = params.get('b');
  const own = blockId ? state.blocks.find((b) => b.id === blockId)?.reason : undefined;
  const ofCategory = category && category in state.categories ? state.categories[category].reason : undefined;
  return own ?? ofCategory ?? t('blockDefaultReason');
}

function BlockPage() {
  const state = useAppState();
  const category = blockedCategory();
  // Picked once per visit, so the suggestion doesn't change under the reader when storage updates.
  const redirect = useRef<Redirect | null | undefined>(undefined);

  useEffect(() => {
    if (category) void sendCommand({ type: 'recordAttempt', category });
  }, []);

  if (!state) return null;
  if (redirect.current === undefined) redirect.current = pickRedirect(state.redirects);
  const stage = category && category in state.categories ? stageFor(state.categories[category], Date.now()) : null;

  return (
    <main class="block">
      <img class="emblem" src={emblemUrl} alt="" />
      <h1>{t('blockHeading')}</h1>
      {stage && <StageBadge stage={stage} />}
      <ResetNotice state={state} withReasonAndRedirect={false} />
      <blockquote data-testid="reason">{reasonFor(state, category)}</blockquote>
      {redirect.current && <Instead redirect={redirect.current} />}
      <button type="button" class="quiet" onClick={() => history.back()}>
        {t('blockGoBack')}
      </button>
    </main>
  );
}

function Instead({ redirect }: { redirect: Redirect }) {
  return (
    <section class="instead" data-testid="redirect" aria-label={t('blockInstead')}>
      <h2>{t('blockInstead')}</h2>
      {redirect.kind === 'link' && redirect.url ? (
        <a class="primary" href={redirect.url}>
          {redirect.text}
        </a>
      ) : (
        <>
          <p>{redirect.text}</p>
          <button type="button" class="primary" onClick={closeThisTab}>
            {t('blockDone')}
          </button>
        </>
      )}
    </section>
  );
}

async function closeThisTab() {
  const tab = await browser.tabs.getCurrent();
  if (tab?.id !== undefined) await browser.tabs.remove(tab.id);
}

render(<BlockPage />, document.getElementById('app')!);
