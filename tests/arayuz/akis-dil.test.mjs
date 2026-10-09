import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

// A-3 / C0 · Akış kartlarının SİSTEM metinleri çeviride; kullanıcı metni dokunulmaz.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const T = yardimci.baslat('AKIS DIL (A-3 / C0)', { kokOneki: 'akis-dil-' });
const i18next = require('i18next');
const oku = (dil, ns) => JSON.parse(fs.readFileSync(path.join(root, `locales/${dil}/${ns}.json`), 'utf8'));
const i18n = i18next.createInstance();
await i18n.init({
  lng: 'en', fallbackLng: 'en', ns: ['feed', 'common'], defaultNS: 'feed', interpolation: { escapeValue: false },
  resources: { en: { feed: oku('en', 'feed'), common: oku('en', 'common') }, tr: { feed: oku('tr', 'feed'), common: oku('tr', 'common') } },
});
const load = tsLoader(root, {});
const { activityLabel } = load('features/feed/utils/activityLabel.ts');
const { getMarathonMessage } = load('features/feed/utils/marathonMessages.ts');
const { formatRelativeTime } = load('utils/formatRelativeTime.ts');

const cumle = (dil, a) => {
  const t = i18n.getFixedT(dil, 'feed');
  const l = activityLabel(a, t);
  return `${l.before}[${a.showTitle}]${l.after}`;
};
const ep = { activityType: 'watched_episode', showTitle: 'Jujutsu Kaisen', episodeNumber: 'S01E24', mediaType: 'show' };
T.ok('EN bolum: watched [X] S01E24', cumle('en', ep) === 'watched [Jujutsu Kaisen] S01E24');
T.ok('TR bolum: [X] S01E24 izledi (eski metin aynen)', cumle('tr', ep) === '[Jujutsu Kaisen] S01E24 izledi');
const puan = { activityType: 'rated', showTitle: 'Dune', mediaType: 'movie', rating: 8 };
T.ok('EN puan 5 uzerinden', cumle('en', puan) === 'rated [Dune] 4/5');
T.ok('TR film puani', cumle('tr', puan) === '[Dune] filmine 4/5 puan verdi');
T.ok('TR dizi puani', cumle('tr', { ...puan, mediaType: 'show' }) === '[Dune] dizisine 4/5 puan verdi');
T.ok('EN film izleme', cumle('en', { activityType: 'watched_movie', showTitle: 'Dune', mediaType: 'movie' }) === 'watched [Dune]');
T.ok('Gonderi baglami yalniz yapim adi', cumle('en', { activityType: 'posted', showTitle: 'Dark Matter', mediaType: 'show' }) === '[Dark Matter]');
for (const tip of ['watched_episode', 'watched_movie', 'started_show', 'completed_show', 'rated', 'reviewed', 'posted']) {
  for (const dil of ['en', 'tr']) {
    const c = cumle(dil, { activityType: tip, showTitle: 'X', mediaType: 'show', episodeNumber: 'S01E01', rating: 6 });
    if (!c.includes('[X]') || /\{\{|feed:/.test(c)) T.ok(`${dil} ${tip} cumlesi saglam (${c})`, false);
  }
}
T.ok('Her tip, iki dilde: yapim adi cumlede, ham anahtar yok', true);

const m3en = getMarathonMessage('Arda', 47, i18n.getFixedT('en', 'feed'));
const m3tr = getMarathonMessage('Arda', 47, i18n.getFixedT('tr', 'feed'));
T.ok('Maraton seviye/renk korunur', m3en.level === 3 && m3en.color === '#fbbf24' && getMarathonMessage('a', 5, i18n.getFixedT('en')).level === 2 && getMarathonMessage('a', 3, i18n.getFixedT('en')).level === 1);
T.ok('Maraton EN/TR', m3en.badge === 'Season Slayer' && m3tr.headline === 'Arda sezonu tek oturuşta devirdi! 🏆🦉');

const once = (ms) => new Date(Date.now() - ms).toISOString();
const S = 3600e3, G = 24 * S;
const en = i18n.getFixedT('en'), tr = i18n.getFixedT('tr');
T.ok('EN «1 day ago» (eski hata: 1 days ago)', formatRelativeTime(once(G + 60e3), en) === '1 day ago');
T.ok('EN «2 days ago»', formatRelativeTime(once(2 * G + 60e3), en) === '2 days ago');
T.ok('EN «1 hour ago» / «3 hours ago»', formatRelativeTime(once(S + 60e3), en) === '1 hour ago' && formatRelativeTime(once(3 * S + 60e3), en) === '3 hours ago');
T.ok('EN «1 week ago»', formatRelativeTime(once(8 * G), en) === '1 week ago');
T.ok('TR «1 gün önce»', formatRelativeTime(once(G + 60e3), tr) === '1 gün önce');

const kart = fs.readFileSync(path.join(root, 'features/feed/components/FeedCard.tsx'), 'utf8')
  + fs.readFileSync(path.join(root, 'features/feed/components/MarathonFeedCard.tsx'), 'utf8')
  + fs.readFileSync(path.join(root, 'features/feed/utils/marathonMessages.ts'), 'utf8');
const kod = kart.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join('\n');
T.ok('Kart kodunda gomulu sistem cumlesi kalmadi', !/izledi'|izlendi`|puan verdi|başladı'|tamamladı'|Sezon Fatihi'|Hız Turu'/.test(kod));
T.bitir();
