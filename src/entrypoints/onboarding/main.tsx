/**
 * First-run setup (SPEC §7.6): welcome → categories → redirects → incognito → done.
 * Every change goes through the same commands as settings. Categories turn on when you
 * leave their step: turning on is instant, turning off later is slow (D11).
 */
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { browser } from 'wxt/browser';
import { CURATED_LISTS, entryKey, isCurated } from '../../core/categories';
import type { CategoryId, State } from '../../core/types';
import { t, type MessageKey } from '../../adapters/i18n';
import { isIncognitoAllowed, openExtensionSettings } from '../../adapters/lifecycle';
import { sendCommand } from '../../adapters/messages';
import emblemUrl from '../../assets/emblem.svg';
import { RedirectsEditor } from '../../ui/RedirectsEditor';
import { useAppState } from '../../ui/useAppState';

const STEPS = ['welcome', 'categories', 'redirects', 'incognito', 'done'] as const;
type Step = (typeof STEPS)[number];
type CardId = Exclude<CategoryId, 'personal'>;

const CARDS: { id: CardId; name: MessageKey; description: MessageKey }[] = [
  { id: 'adult', name: 'categoryAdultName', description: 'categoryAdultDescription' },
  { id: 'gambling', name: 'categoryGamblingName', description: 'categoryGamblingDescription' },
  { id: 'social', name: 'categorySocialName', description: 'categorySocialDescription' },
  { id: 'short-video', name: 'categoryShortVideoName', description: 'categoryShortVideoDescription' },
];

function Onboarding() {
  const state = useAppState();
  const [step, setStep] = useState<Step | null>(null);

  useEffect(() => {
    if (state && step === null) setStep(state.onboardingComplete ? 'done' : 'welcome');
  }, [state]);

  if (!state || !step) return null;
  const next = () => setStep(STEPS[STEPS.indexOf(step) + 1]!);

  return (
    <main class="onboarding" data-testid={`step-${step}`}>
      <img class="emblem" src={emblemUrl} alt="" />
      <div class="dots" aria-hidden="true">
        {STEPS.map((s, i) => (
          <span key={s} class={i <= STEPS.indexOf(step) ? 'on' : ''} />
        ))}
      </div>
      {step === 'welcome' && <Welcome onNext={next} />}
      {step === 'categories' && <Categories state={state} onNext={next} />}
      {step === 'redirects' && <Redirects state={state} onNext={next} />}
      {step === 'incognito' && <Incognito onNext={next} />}
      {step === 'done' && <Done />}
    </main>
  );
}

function Welcome({ onNext }: { onNext: () => void }) {
  return (
    <>
      <h1>{t('onboardingWelcomeTitle')}</h1>
      <p class="lead">{t('onboardingWelcomeBody')}</p>
      <div class="actions" style={{ justifyContent: 'center' }}>
        <button type="button" class="primary" onClick={onNext}>
          {t('onboardingStart')}
        </button>
      </div>
    </>
  );
}

interface Pick {
  reason: string;
  unticked: string[];
}

/** Four large cards, none pre-selected (D22). One click picks a card. */
function Categories({ state, onNext }: { state: State; onNext: () => void }) {
  const [picked, setPicked] = useState<Partial<Record<CardId, Pick>>>({});
  const [busy, setBusy] = useState(false);
  const chosen = (Object.keys(picked) as CardId[]).filter((id) => !state.categories[id].enabled);

  const toggle = (id: CardId) =>
    setPicked((current) => {
      if (current[id]) {
        const { [id]: _dropped, ...rest } = current;
        return rest;
      }
      const unticked = isCurated(id) ? CURATED_LISTS[id].filter((e) => e.defaultExcluded).map(entryKey) : [];
      return { ...current, [id]: { reason: '', unticked } };
    });
  const update = (id: CardId, change: Partial<Pick>) =>
    setPicked((current) => ({ ...current, [id]: { ...current[id]!, ...change } }));

  async function turnOnAndContinue() {
    setBusy(true);
    for (const id of chosen) {
      const pick = picked[id]!;
      await sendCommand({ type: 'enableCategory', category: id, reason: pick.reason, excluded: pick.unticked });
    }
    onNext();
  }

  return (
    <>
      <h1>{t('onboardingCategoriesTitle')}</h1>
      <p class="lead">{t('onboardingCategoriesBody')}</p>
      <div class="cards">
        {CARDS.map((card) => {
          const on = state.categories[card.id].enabled;
          const pick = picked[card.id];
          return (
            <div key={card.id} class={on || pick ? 'card picked' : 'card'} data-testid={`card-${card.id}`}>
              <button type="button" class="card-toggle" aria-pressed={on || !!pick} disabled={on} onClick={() => toggle(card.id)}>
                <strong>{t(card.name)}</strong>
                <span>{on ? t('categoryOn') : t(card.description)}</span>
              </button>
              {pick && isCurated(card.id) && (
                <ul>
                  {CURATED_LISTS[card.id].map((entry) => {
                    const key = entryKey(entry);
                    return (
                      <li key={key}>
                        <label>
                          <input
                            type="checkbox"
                            checked={!pick.unticked.includes(key)}
                            onChange={(e) =>
                              update(card.id, {
                                unticked: e.currentTarget.checked ? pick.unticked.filter((k) => k !== key) : [...pick.unticked, key],
                              })
                            }
                          />{' '}
                          {key}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
              {pick && (
                <input
                  type="text"
                  placeholder={t('categoryReasonPlaceholder')}
                  value={pick.reason}
                  onInput={(e) => update(card.id, { reason: e.currentTarget.value })}
                />
              )}
            </div>
          );
        })}
      </div>
      <div class="actions">
        <span class="status-wait">{t('onboardingCategoriesNote')}</span>
        <button type="button" class="primary" disabled={busy} onClick={turnOnAndContinue}>
          {chosen.length > 0 ? t('onboardingTurnOnContinue') : t('onboardingSkipForNow')}
        </button>
      </div>
    </>
  );
}

function Redirects({ state, onNext }: { state: State; onNext: () => void }) {
  return (
    <>
      <h1>{t('onboardingRedirectsTitle')}</h1>
      <p class="lead">{t('onboardingRedirectsBody')}</p>
      <div class="panel">
        <RedirectsEditor redirects={state.redirects} />
      </div>
      <div class="actions" style={{ justifyContent: 'flex-end' }}>
        <button type="button" class="primary" disabled={state.redirects.length === 0} onClick={onNext}>
          {t('onboardingContinue')}
        </button>
      </div>
    </>
  );
}

/** Setup can't finish without incognito access (D13): otherwise it's a hole in every wall. */
function Incognito({ onNext }: { onNext: () => void }) {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const check = async () => {
      const now = await isIncognitoAllowed();
      setAllowed(now);
      await sendCommand({ type: 'incognitoStatus', allowed: now });
    };
    void check();
    // The user flips the switch in another tab; check when they come back, and every few seconds.
    window.addEventListener('focus', check);
    const timer = setInterval(check, 2000);
    return () => {
      window.removeEventListener('focus', check);
      clearInterval(timer);
    };
  }, []);

  async function finish() {
    const result = await sendCommand({ type: 'completeOnboarding' });
    if (result.ok) onNext();
  }

  return (
    <>
      <h1>{t('onboardingIncognitoTitle')}</h1>
      <p class="lead">{t('onboardingIncognitoBody')}</p>
      <div class="panel" data-testid="incognito-status">
        {allowed ? (
          <p class="status-ok">{t('onboardingIncognitoOn')}</p>
        ) : (
          <>
            <p class="status-wait">{t('onboardingIncognitoHow')}</p>
            <button type="button" class="primary" onClick={() => void openExtensionSettings()}>
              {t('incognitoOpenSetting')}
            </button>
          </>
        )}
      </div>
      <div class="actions" style={{ justifyContent: 'flex-end' }}>
        <button type="button" class="primary" disabled={!allowed} onClick={finish}>
          {t('onboardingFinish')}
        </button>
      </div>
    </>
  );
}

function Done() {
  async function close() {
    const tab = await browser.tabs.getCurrent();
    if (tab?.id !== undefined) await browser.tabs.remove(tab.id);
  }
  return (
    <>
      <h1>{t('onboardingDoneTitle')}</h1>
      <p class="lead">{t('onboardingDoneBody')}</p>
      <div class="actions" style={{ justifyContent: 'center' }}>
        <button type="button" class="primary" onClick={close}>
          {t('onboardingClose')}
        </button>
      </div>
    </>
  );
}

render(<Onboarding />, document.getElementById('app')!);
