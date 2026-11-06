// ==========================================================================
// ARAYUZ — 2.6.8 SIRA-01: Aktif Izlenenler siralamasi
// ==========================================================================
// Kural (kullanici, 2026-11-06): once izlemeye hazir olanlar, sonra en son
// hareket ustte. Hareket = son izleme ya da son yayinlanan bolum tarihi,
// hangisi yeniyse. Ara Verilenler / Guncel siralamasi DEGISMEZ.
//
// Cikti ASCII (tests/yardimci.js kurali).

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const T = yardimci.baslat('ARAYUZ AKTIF SIRALAMA (2.6.8 SIRA-01)', { kokOneki: 'arayuz-aktif-siralama-' });
const { categorizeShows, sonHareketAni } = tsLoader(KOK)('store/tracking/trackingLogic.ts');

const GUN = 24 * 60 * 60 * 1000;
const now = Date.parse('2026-11-06T12:00:00.000Z');
const once = (gun) => new Date(now - gun * GUN).toISOString();
const sonra = (gun) => new Date(now + gun * GUN).toISOString();
const labels = { dil: 'tr', unnamedShow: '?', notStarted: 'Baslamadi', caughtUp: 'Guncel' };

// Kaymak seklinde ilerleme: sezon 1'de `yayinlar` kadar bolum, ilki izlenmis,
// ikincisi siradaki (yayinlanmis -> izlemeye hazir).
const ilerleme = (yayinlar, ekstraSezonlar = []) => ({
  aired: yayinlar.length, completed: 1,
  next_episode: { season: 1, number: 2, title: 'S1E2' },
  seasons: [
    { number: 1, episodes: yayinlar.map((t, i) => ({ number: i + 1, completed: i === 0, first_aired: t })) },
    ...ekstraSezonlar,
  ],
});
const dizi = (id, sonIzleme) => ({ show: { ids: { trakt: id }, title: `D${id}` }, last_watched_at: sonIzleme });
const sira = (diziler, harita, ekstra = {}) =>
  categorizeShows({ watchedShows: diziler, watchlistShows: [], showProgressMap: harita, labels, now, ...ekstra })
    .upNext.map((k) => k.id);
const esit = (a, b) => JSON.stringify(a) === JSON.stringify(b);

T.H('sonHareketAni');
T.ok('son izleme daha yeniyse o', sonHareketAni(once(2), ilerleme([once(30), once(20)]), now) === Date.parse(once(2)));
T.ok('son yayinlanan bolum daha yeniyse o', sonHareketAni(once(90), ilerleme([once(30), once(1)]), now) === Date.parse(once(1)));
T.ok('gelecek tarihli bolum sayilmaz', sonHareketAni(once(9), ilerleme([once(30), once(20), sonra(3)]), now) === Date.parse(once(9)));
T.ok('ozel sezon (0) sayilmaz',
  sonHareketAni(once(50), ilerleme([once(60), once(55)], [{ number: 0, episodes: [{ number: 1, first_aired: once(1) }] }]), now) === Date.parse(once(50)));
T.ok('Trakt sekli: yalniz next_episode.first_aired',
  sonHareketAni(once(40), { next_episode: { season: 2, number: 1, first_aired: once(3) } }, now) === Date.parse(once(3)));
T.ok('hic tarih yoksa 0', sonHareketAni(undefined, { next_episode: null }, now) === 0);
// Emulator bulgusu (2026-11-06): `now` periyodik tazelenen state; az onceki izleme
// ondan yeni gorunebilir. Izleme suzulmemeli, yalniz yayin tarihleri suzulur.
const azOnce = new Date(now + 3 * 60 * 1000).toISOString();
T.ok('🔴 bayat now: ondan yeni izleme damgasi yine sayilir', sonHareketAni(azOnce, ilerleme([once(30), once(20)]), now) === Date.parse(azOnce));
T.ok('🔴 bayat now: az once izlenen dizi listenin basinda', esit(sira(
  [dizi(1, once(1)), dizi(2, azOnce)],
  { 1: ilerleme([once(40), once(1)]), 2: ilerleme([once(40), once(30)]) },
), [2, 1]));
T.ok('bozuk tarih cokertmez, 0 sayilir', sonHareketAni('bozuk', { seasons: [{ number: 1, episodes: [{ first_aired: 'x' }] }] }, now) === 0);

T.H('Aktif Izlenenler sirasi');
T.ok('en son izlenen ustte', esit(sira(
  [dizi(1, once(20)), dizi(2, once(3)), dizi(3, once(10))],
  { 1: ilerleme([once(400), once(399)]), 2: ilerleme([once(400), once(399)]), 3: ilerleme([once(400), once(399)]) },
), [2, 3, 1]));
T.ok('dun yayinlanan bolum 3 gun once izlenen dizinin onune gecer', esit(sira(
  [dizi(1, once(3)), dizi(2, once(30))],
  { 1: ilerleme([once(400), once(399)]), 2: ilerleme([once(40), once(1)]) },
), [2, 1]));
T.ok('izlemeye hazir olan, hesaplanmakta olanin (hareketi daha yeni olsa da) onunde', esit(sira(
  [dizi(1, once(1)), dizi(2, once(30))],
  { 2: ilerleme([once(400), once(399)]) },
), [2, 1]));
T.ok('tarihi olmayan dizi sona duser', esit(sira(
  [dizi(1, undefined), dizi(2, once(40))],
  { 1: { aired: 2, completed: 1, next_episode: { season: 1, number: 2, title: 'x' } }, 2: ilerleme([once(400), once(399)]) },
), [2, 1]));
T.ok('esit harekette giris sirasi korunur', esit(sira(
  [dizi(5, once(7)), dizi(4, once(7))],
  { 5: ilerleme([once(400), once(399)]), 4: ilerleme([once(400), once(399)]) },
), [5, 4]));

T.H('Diger kovalar degismedi');
const c = categorizeShows({
  watchedShows: [dizi(1, once(100)), dizi(2, once(60)), dizi(3, once(5)), dizi(4, once(9))],
  watchlistShows: [], labels, now,
  showProgressMap: {
    1: ilerleme([once(400), once(399)]), 2: ilerleme([once(400), once(399)]),
    3: { aired: 1, completed: 1, next_episode: null, seasons: [] },
    4: { aired: 1, completed: 1, next_episode: null, seasons: [] },
  },
});
T.ok('Ara Verilenler: en yeni son izleme ustte', esit(c.paused.map((k) => k.id), [2, 1]));
T.ok('Guncel: en yeni son izleme ustte', esit(c.caughtUp.map((k) => k.id), [3, 4]));
T.ok('Aktif bos (hepsi eski ya da guncel)', c.upNext.length === 0);

T.bitir();
