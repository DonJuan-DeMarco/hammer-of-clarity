/** Credits and licences (D20): the block lists are GPLv3 and must be credited. Mirrors NOTICE. */
import { render } from 'preact';
import { t } from '../../adapters/i18n';

const LISTS = [
  { name: 'OISD NSFW', home: 'https://oisd.nl', source: 'https://github.com/sjhgvr/oisd', licence: 'GPL-3.0' },
  {
    name: 'HaGeZi DNS Blocklists (Gambling, medium)',
    home: 'https://github.com/hagezi/dns-blocklists',
    source: 'https://github.com/hagezi/dns-blocklists',
    licence: 'GPL-3.0',
  },
];

const SOFTWARE = [{ name: 'Preact', source: 'https://github.com/preactjs/preact', licence: 'MIT' }];

function Credits() {
  return (
    <main>
      <h1>{t('creditsTitle')}</h1>
      <p>{t('creditsLicence')}</p>
      <p class="muted">{t('creditsSource')}</p>

      <h2>{t('creditsLists')}</h2>
      <p class="muted">{t('creditsListsHint')}</p>
      <ul>
        {LISTS.map((list) => (
          <li key={list.name}>
            <a href={list.home}>{list.name}</a> · {list.licence} · <a href={list.source}>{t('creditsSourceLink')}</a>
          </li>
        ))}
      </ul>

      <h2>{t('creditsSoftware')}</h2>
      <ul>
        {SOFTWARE.map((item) => (
          <li key={item.name}>
            <a href={item.source}>{item.name}</a> · {item.licence}
          </li>
        ))}
      </ul>
    </main>
  );
}

render(<Credits />, document.getElementById('app')!);
