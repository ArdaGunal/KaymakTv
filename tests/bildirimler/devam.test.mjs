// ==========================================================================
// BILDIRIMLER — B5: KALDIGIN YERDEN DEVAM (durtme)
// ==========================================================================
// 🔴 BU KATEGORI SISTEMIN EN KOLAY RAHATSIZ EDEN PARCASI. Kullanicinin acik
// talebi: "bunun rahatsız edici olmasını istemiyorum, arada bir uygulamaya
// uzun süre girmiyorsa yapılabilir."
//
// Bu takim o vaadin uc bacagini da kilitler:
//   1. Bitmis/gizli dizi icin durtme URETILMEZ
//   2. Durtme HER ZAMAN en az `awayDays` gun ILERIYE kurulur
//   3. Sogulma penceresi dolmadan ikinci durtme kurulmaz
//
// Cikti ASCII (tests/yardimci.js kurali).

import yardimci from '../yardimci.js';
import { pickResumeCandidate } from '../../features/notifications/scheduling/mapProgress.ts';
import { planContinueWatching } from '../../features/notifications/scheduling/planners/continueWatchingPlanner.ts';
import { snapToPreferredHour } from '../../features/notifications/scheduling/fireTime.ts';

const { baslat } = yardimci;
const T = baslat('KALDIGIN YERDEN DEVAM (B5)', { kokOneki: 'bildirim-devam-' });

const yerel = (y, ay, gun, saat = 12) => new Date(y, ay, gun, saat, 0, 0, 0).getTime();
const GUN = 24 * 3600 * 1000;
const simdi = yerel(2026, 8, 15, 12);

// ─────────────────────────────────────────────────────────────────────────
T.H('snapToPreferredHour — hedefi tercih saatine yaslar');

T.ok(
  'Ayni gunun tercih saati HEDEFTEN SONRAYSA o gune yaslanir',
  snapToPreferredHour(yerel(2026, 8, 20, 9), 20) === yerel(2026, 8, 20, 20),
);
// Yaslama geriye giderse "7 gun sonra hatirlat" dedigimiz bildirim 6,7 gun
// sonra giderdi ve bekleme esigi SESSIZCE kisalirdi.
T.ok(
  'Tercih saati hedefin GERISINDE kalirsa ERTESI gune kaydirilir',
  snapToPreferredHour(yerel(2026, 8, 20, 22), 20) === yerel(2026, 8, 21, 20),
);
T.ok(
  'Sonuc HICBIR ZAMAN hedeften once olmaz',
  [0, 6, 12, 18, 23].every((saat) =>
    [9, 12, 20, 22].every((tercih) => {
      const hedef = yerel(2026, 8, 20, saat);
      return snapToPreferredHour(hedef, tercih) >= hedef;
    }),
  ),
);

// ─────────────────────────────────────────────────────────────────────────
T.H('pickResumeCandidate — hangi dizi hatirlatilir');

const izlenen = (id, baslik, tarih) => ({
  show: { title: baslik, ids: { trakt: id } },
  last_watched_at: tarih,
});
const ilerleme = (sezon, bolum, epId = 900) => ({
  next_episode: { season: sezon, number: bolum, ids: { trakt: epId } },
});

const aday = pickResumeCandidate(
  [
    izlenen(1, 'Eski Dizi', '2026-01-01T10:00:00.000Z'),
    izlenen(2, 'Taze Dizi', '2026-09-10T10:00:00.000Z'),
    izlenen(3, 'Bitmis Dizi', '2026-09-14T10:00:00.000Z'),
    izlenen(4, 'Gizli Dizi', '2026-09-15T10:00:00.000Z'),
  ],
  {
    1: ilerleme(2, 3),
    2: ilerleme(4, 7, 901),
    3: {}, // next_episode YOK -> bitmis
    4: ilerleme(1, 2),
  },
  [4], // gizlenen
);

T.ok('EN SON izlenen, bitmemis dizi secildi', aday?.showTitle === 'Taze Dizi');
T.ok('Siradaki bolum tasindi', aday?.seasonNumber === 4 && aday?.episodeNumber === 7);
T.ok('Bolum kimligi tasindi (deep link icin)', aday?.nextEpisodeTraktId === 901);

// Bitmis diziyi "kaldigin yer" diye hatirlatmak sistemi yalanci cikarir.
T.ok(
  'BITMIS dizi (next_episode yok) aday DEGIL',
  pickResumeCandidate([izlenen(3, 'Bitmis', '2026-09-14T10:00:00.000Z')], { 3: {} }, []) === null,
);
T.ok(
  'GIZLENEN dizi aday degil',
  pickResumeCandidate([izlenen(4, 'Gizli', '2026-09-15T10:00:00.000Z')], { 4: ilerleme(1, 2) }, [4]) === null,
);
// 0. sezon "Specials"tir; ana hikayenin devami degildir.
T.ok(
  'Sezon 0 (Specials) aday degil',
  pickResumeCandidate([izlenen(5, 'S', '2026-09-15T10:00:00.000Z')], { 5: ilerleme(0, 1) }, []) === null,
);
T.ok('Bos girdi null doner', pickResumeCandidate([], {}, []) === null);
T.ok(
  'Bozuk kayitlar cokertmez',
  pickResumeCandidate([null, { show: {} }, izlenen(9, 'X', 'gecersiz-tarih')], {}, []) === null,
);

// ─────────────────────────────────────────────────────────────────────────
T.H('planContinueWatching — rahatsiz etmeme kurallari');

const secenek = (ek = {}) => ({
  now: simdi,
  awayDays: 7,
  cooldownDays: 30,
  lastNudgeFiredAt: null,
  snapToPreferredHour: (t) => snapToPreferredHour(t, 20),
  renderCopy: (v) => ({ title: 'Kaldigin yer', body: `${v.showTitle} S${v.seasonNumber}B${v.episodeNumber}` }),
  ...ek,
});

const durtme = planContinueWatching(aday, secenek());

T.ok('Aday varsa TEK durtme uretilir', durtme.length === 1);
T.ok('Kimlik dizi bazli ve deterministik', durtme[0].identifier === 'continueWatching:2');
T.ok('Deep link siradaki bolume gider', durtme[0].data.deepLink === '/episode/901');
T.ok('Metin enjekte edilen renderCopy ile uretildi', durtme[0].body === 'Taze Dizi S4B7');

// 🔑 ASIL VAAT: durtme her zaman en az 7 gun ILERIDE.
T.ok(
  'Durtme EN AZ awayDays gun ileriye kuruldu',
  durtme[0].fireAt >= simdi + 7 * GUN,
  'fark: ' + ((durtme[0].fireAt - simdi) / GUN).toFixed(2) + ' gun',
);

T.ok('Aday yoksa durtme YOK', planContinueWatching(null, secenek()).length === 0);

// Sogulma penceresi: kullanici 7 gunde bir girip cikiyorsa her hafta
// durtulmemeli.
const yeniDurtme = planContinueWatching(aday, secenek({ lastNudgeFiredAt: simdi - 5 * GUN }));
T.ok(
  'Sogulma penceresi dolmadiysa durtme ERTELENIR',
  yeniDurtme[0].fireAt >= simdi - 5 * GUN + 30 * GUN,
  'fark: ' + ((yeniDurtme[0].fireAt - simdi) / GUN).toFixed(1) + ' gun sonra',
);
T.ok(
  'Sogulma penceresi dolduysa normal 7 gunluk kural gecerli',
  planContinueWatching(aday, secenek({ lastNudgeFiredAt: simdi - 60 * GUN }))[0].fireAt <
    simdi + 9 * GUN,
);
T.ok(
  'Bozuk sogulma damgasi durtmeyi kilitlemez',
  planContinueWatching(aday, secenek({ lastNudgeFiredAt: Number.NaN }))[0].fireAt >= simdi + 7 * GUN,
);

// Bolum kimligi yoksa yarim/kirik bir baglanti yerine dizi sayfasina.
T.ok(
  'Bolum kimligi yoksa DIZI sayfasina gidilir',
  planContinueWatching({ ...aday, nextEpisodeTraktId: null }, secenek())[0].data.deepLink === '/show/2',
);

T.bitir();
