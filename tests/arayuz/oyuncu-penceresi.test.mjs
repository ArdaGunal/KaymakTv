import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { tsLoader } from '../ts-test-loader.mjs';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = require('../yardimci').baslat('OYUNCU PENCERESI (2.6.5 madde 9)', { kokOneki: 'oyuncu-penceresi-' });
const oku = (f) => fs.readFileSync(path.join(root, f), 'utf8');

// Gercek servis govdesi; TMDB proxy'si sahte — cagrilar kaydedilir.
const istekler = [];
const yanit = { 'tr-TR': { id: 17419, name: 'Bryan Cranston', biography: '  ', profile_path: '/b.jpg' },
  'en-US': { id: 17419, name: 'Bryan Cranston', biography: 'Bryan Lee Cranston is an American actor.', profile_path: '/b.jpg' } };
const i18n = { language: 'tr' };
const { getTmdbPerson, getPersonProfileLarge } = tsLoader(root, {
  '../locales/index': { __esModule: true, default: i18n },
  './tmdbApi': { fetchFromTmdb: async (endpoint, params) => { istekler.push(`${endpoint}|${params.language}`); return { data: yanit[params.language] }; } },
})('services/tmdbPerson.ts');

T.H('Servis');
const kisi = await getTmdbPerson(17419);
T.ok('TR biyografi bossa Ingilizcesine duser', kisi.biography === 'Bryan Lee Cranston is an American actor.' && kisi.name === 'Bryan Cranston');
T.ok('Once uygulama dili, sonra yedek: iki istek', istekler.join(',') === '/person/17419|tr-TR,/person/17419|en-US');
await getTmdbPerson(17419);
T.ok('Ayni oyuncuya ikinci dokunus aga cikmaz', istekler.length === 2);
i18n.language = 'en';
await getTmdbPerson(17419);
T.ok('Dil degisince ayri kayit (EN tek istek)', istekler.length === 3 && istekler[2] === '/person/17419|en-US');
T.ok('Buyuk foto adresi / yoksa null', getPersonProfileLarge('/b.jpg') === 'https://image.tmdb.org/t/p/h632/b.jpg' && getPersonProfileLarge(null) === null);

T.H('Pencere uygulama icinde (kullanici: «uygulama disina cikmasin»)');
const sheet = oku('components/person/PersonSheet.tsx');
const cast = oku('components/MediaCast.tsx');
T.ok('Dis baglanti / tarayici yok', ![sheet, cast].some((s) => /Linking|openURL|WebBrowser|openBrowserAsync/.test(s)));
T.ok('Android geri tusu kapatir (onRequestClose)', /onRequestClose=\{onClose\}/.test(sheet));
T.ok('Web Escape kapatir', /event\.key === 'Escape'\) onClose\(\)/.test(sheet));
T.ok('Kapatma dugmesi var', /<X size=/.test(sheet) && /onPress=\{onClose\}/.test(sheet));
T.ok('TMDB atfi her zaman gorunur', sheet.includes("t('tmdbAttribution')"));
T.ok('Masaustu web yan panel, mobil alttan pencere', sheet.includes('isDesktopWeb ? styles.panel : styles.sheet'));
T.ok('MediaCast pencereyi aciyor; TMDB kimligi olmayan kart dokunulamaz', cast.includes('<PersonSheet') && cast.includes('return actorTmdbId ? ('));

T.H('Oy yer tutucusu kalkti (kullanici: «oy verme su anlik yapmayacagim»)');
T.ok('voteActor / onActorPress hicbir yerde yok', !['hooks/useEpisodeCast.ts', 'app/episode/[id].tsx', 'components/MediaCast.tsx'].some((f) => /voteActor|onActorPress/.test(oku(f))));
T.ok('Uc detay ekrani da ayni MediaCast', ['app/show/[id].tsx', 'app/movie/[id].tsx', 'app/episode/[id].tsx'].every((f) => oku(f).includes('<MediaCast cast=')));

T.H('Ceviri');
const tr = JSON.parse(oku('locales/tr/media.json')), en = JSON.parse(oku('locales/en/media.json'));
T.ok('Pencere anahtarlari TR + EN', ['personBioTitle', 'personBioEmpty', 'personLoadError', 'personRetry', 'tmdbAttribution'].every((k) => tr[k] && en[k]));
T.bitir();
