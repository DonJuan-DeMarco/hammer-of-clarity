import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { browser } from 'wxt/browser';
import { targetFromUrl, type UrlTarget } from '../../core/domain';
import { liveRequests } from '../../core/removal';
import { stageFor, type Stage } from '../../core/stages';
import type { CategoryId, State } from '../../core/types';
import { t, type MessageKey } from '../../adapters/i18n';
import { hasFullSiteAccess, isIncognitoAllowed, openExtensionSettings, openOnboarding } from '../../adapters/lifecycle';
import { sendCommand } from '../../adapters/messages';
import { clearSiteData } from '../../adapters/siteData';
import { loadState } from '../../adapters/storage';
import { GraduationNotice } from '../../ui/GraduationNotice';
import { ResetNotice } from '../../ui/ResetNotice';
import { CATEGORY_NAMES } from '../../ui/categoryNames';
import { StageBadge } from '../../ui/StageBadge';
import { useAppState } from '../../ui/useAppState';

interface TargetTab {
  tabId: number;
  /** The exact origin the page came from, port included. */
  origin: string | null;
  target: UrlTarget | null;
}

/** The tab to act on: the active tab, or `?tabId=` (end-to-end tests can't open a real popup). */
async function resolveTargetTab(): Promise<TargetTab | null> {
  const param = new URLSearchParams(location.search).get('tabId');
  const tab = param
    ? await browser.tabs.get(Number(param))
    : (await browser.tabs.query({ active: true, currentWindow: true }))[0];
  if (tab?.id === undefined) return null;
  const target = tab.url ? targetFromUrl(tab.url) : null;
  return { tabId: tab.id, origin: target && tab.url ? new URL(tab.url).origin : null, target };
}

function Popup() {
  const [tab, setTab] = useState<TargetTab | null | undefined>(undefined);
  const [onlyPath, setOnlyPath] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<MessageKey | null>(null);

  useEffect(() => {
    resolveTargetTab().then(setTab, () => setTab(null));
  }, []);

  if (tab === undefined) return null;
  if (!tab?.target) {
    return (
      <main>
        <Status />
        <p>{t('popupNotAWebsite')}</p>
        <Walls />
        <SettingsLink />
      </main>
    );
  }
  const { tabId, origin, target } = tab;

  async function hammer() {
    const result = await sendCommand({
      type: 'addBlock',
      domain: target.domain,
      pathPrefix: onlyPath ? target.path : undefined,
      reason,
    });
    if (result.ok) {
      // The background clears the site's usual origins; this one may have an unusual port (#14).
      if (origin) await clearSiteData([origin]);
      // Like Ctrl+F5: skip the cache and the site's service worker, which would otherwise serve
      // the page from the browser's own cache, out of sight of the blocking rules (#13).
      await browser.tabs.reload(tabId, { bypassCache: true });
      window.close();
    } else {
      setError(result.reason === 'alreadyBlocked' ? 'popupAlreadyBlocked' : 'popupNotAWebsite');
    }
  }

  return (
    <main>
      <Status />
      <p class="domain" data-testid="domain">{target.domain}</p>
      {target.path && (
        <label>
          <input type="checkbox" checked={onlyPath} onChange={(e) => setOnlyPath(e.currentTarget.checked)} />
          {t('popupOnlyPath', target.path)}
        </label>
      )}
      <input
        type="text"
        placeholder={t('popupReasonPlaceholder')}
        value={reason}
        onInput={(e) => setReason(e.currentTarget.value)}
      />
      <button type="button" class="primary" onClick={hammer}>
        {t('popupHammer')}
      </button>
      {error && <p role="alert">{t(error)}</p>}
      <Walls />
      <SettingsLink />
    </main>
  );
}

/** Every category that's on, with its stage. */
function Walls() {
  const state = useAppState();
  if (!state) return null;
  const now = Date.now();
  const walls = (Object.keys(state.categories) as CategoryId[])
    .map((id) => ({ id, stage: stageFor(state.categories[id], now) }))
    .filter((w): w is { id: CategoryId; stage: Stage } => w.stage !== null);
  if (walls.length === 0) return null;
  // A sentence, not a count: the popup carries no numbers.
  const waiting = liveRequests(state, now).length > 0;

  return (
    <section class="walls" aria-label={t('popupYourWalls')}>
      <h2>{t('popupYourWalls')}</h2>
      {waiting && <p data-testid="removal-waiting">{t('popupRemovalWaiting')}</p>}
      <ul>
        {walls.map(({ id, stage }) => (
          <li key={id} data-testid={`wall-${id}`}>
            {t(CATEGORY_NAMES[id])} <StageBadge stage={stage} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Checks incognito access (D13) and site access (1.0.1) on every open, before showing any
 * reset message, so a reset caused by that very check is shown now rather than next time.
 */
function Status() {
  const [checked, setChecked] = useState<{ allowed: boolean; fullAccess: boolean; state: State } | null>(null);

  useEffect(() => {
    void (async () => {
      const allowed = await isIncognitoAllowed();
      const fullAccess = await hasFullSiteAccess();
      await sendCommand({ type: 'incognitoStatus', allowed });
      await sendCommand({ type: 'siteAccessStatus', full: fullAccess });
      await sendCommand({ type: 'checkGraduation' });
      setChecked({ allowed, fullAccess, state: await loadState() });
    })();
  }, []);

  if (!checked) return null;
  return (
    <>
      {!checked.state.onboardingComplete && (
        <button type="button" class="primary" data-testid="finish-setup" onClick={() => void openOnboarding().then(() => window.close())}>
          {t('popupFinishSetup')}
        </button>
      )}
      {!checked.fullAccess && (
        <section class="incognito-warning" role="alert" data-testid="site-access-warning">
          <p>{t('siteAccessWarning')}</p>
          <button type="button" onClick={() => void openExtensionSettings().then(() => window.close())}>
            {t('siteAccessOpenSetting')}
          </button>
        </section>
      )}
      {!checked.allowed && (
        <section class="incognito-warning" role="alert" data-testid="incognito-warning">
          <p>{t('incognitoWarning')}</p>
          <button type="button" onClick={() => void openExtensionSettings().then(() => window.close())}>
            {t('incognitoOpenSetting')}
          </button>
        </section>
      )}
      <ResetNotice state={checked.state} />
      <GraduationNotice state={checked.state} />
    </>
  );
}

function SettingsLink() {
  return (
    <button type="button" class="quiet" onClick={() => void browser.runtime.openOptionsPage().then(() => window.close())}>
      {t('popupSettings')}
    </button>
  );
}

render(<Popup />, document.getElementById('app')!);
