// ==========================================================================
// BILDIRIMLER — B7: UZAK METIN HAVUZU (dogrulama + birlestirme + guvenlik)
// ==========================================================================
// 🔴 BU TAKIM BIR GUVENLIK SINIRINI SINAR. Uzak havuz, modulun DISINDAN gelen
// tek serbest metindir ve dogrudan kullanicinin telefonunda bildirim olarak
// gorunur. Uc savunma hatti var, ucu de burada kilitli:
//   1. Satir dogrulama  (remoteSchema.parseRemoteVariants)
//   2. Gomulu metni EZEMEME  (remoteSchema.mergeRemotePool)
//   3. Yer tutucu beyaz listesi + temizlik  (interpolate)
//
// Cikti ASCII (tests/yardimci.js kurali).

import yardimci from '../yardimci.js';
import {
  parseRemoteVariants,
  mergeRemotePool,
} from '../../features/notifications/copy/remoteSchema.ts';
import {
  interpolate,
  MAX_TEXT_LENGTH,
} from '../../features/notifications/copy/interpolate.ts';
import {
  COPY_POOL,
  POOL_BY_CATEGORY,
} from '../../features/notifications/copy/pool.ts';

const { baslat } = yardimci;
const T = baslat('UZAK METIN HAVUZU (B7)', { kokOneki: 'bildirim-uzak-' });

const KATEGORILER = ['episodeToday', 'seasonPremiere', 'movieRelease', 'continueWatching', 'monthlyStats'];

const satir = (ek = {}) => ({
  id: 'setAlarm',
  category: 'episodeToday',
  tone: 'playful',
  weight: 1,
  title_tr: 'Saatini kur',
  body_tr: '{{showTitle}} bugun yayinda',
  title_en: 'Set your alarm',
  body_en: '{{showTitle}} airs today',
  ...ek,
});

// ─────────────────────────────────────────────────────────────────────────
T.H('pool.ts — kategoriye gore gruplama');

T.ok(
  'Duzlestirilmis havuz gruplu tanimdan TURETILIYOR',
  COPY_POOL.length === Object.values(POOL_BY_CATEGORY).reduce((t, v) => t + v.length, 0),
);
T.ok(
  'Her varyant kategorisini tasiyor',
  COPY_POOL.every((v) => typeof v.category === 'string' && v.category.length > 0),
);
T.ok(
  'Gruplu tanimdaki kategori, duzlestirmede DOGRU atanmis',
  COPY_POOL.filter((v) => v.category === 'continueWatching').every((v) =>
    POOL_BY_CATEGORY.continueWatching.some((x) => x.id === v.id),
  ),
);

// ─────────────────────────────────────────────────────────────────────────
T.H('parseRemoteVariants — bozuk satir tum havuzu dusurmemeli');

const gecerli = parseRemoteVariants([satir()], KATEGORILER);
T.ok('Gecerli satir kabul edildi', gecerli.length === 1 && gecerli[0].id === 'setAlarm');
T.ok('Iki dilin metni de tasindi', gecerli[0].text.tr.title === 'Saatini kur' && gecerli[0].text.en.title === 'Set your alarm');

const karisik = parseRemoteVariants(
  [
    satir(),
    satir({ id: 'kotu id!' }),                    // gecersiz kimlik
    satir({ id: 'a', category: 'olmayanKategori' }),
    satir({ id: 'b', tone: 'agresif' }),          // gecersiz ton
    satir({ id: 'c', title_tr: '' }),             // eksik dil metni
    satir({ id: 'd', body_en: null }),
    satir({ id: 'e', active_from: '12-20' }),     // yarim pencere
    null,
    'metin degil',
  ],
  KATEGORILER,
);
T.ok('Yalnizca gecerli satir kaldi', karisik.length === 1, 'kalan: ' + karisik.length);

T.ok(
  'Ayni (kategori,id) iki kez gelirse ilki gecerli',
  parseRemoteVariants([satir({ title_tr: 'ilk' }), satir({ title_tr: 'ikinci' })], KATEGORILER)[0]
    .text.tr.title === 'ilk',
);
T.ok(
  'Gecersiz agirlik varsayilana (1) duser, asiri agirlik kirpilir',
  parseRemoteVariants([satir({ weight: 'cok' }), satir({ id: 'z', weight: 999 })], KATEGORILER)
    .map((v) => v.weight).join(',') === '1,10',
);
T.ok(
  'Tam pencere kabul edilir',
  parseRemoteVariants([satir({ active_from: '12-20', active_until: '01-05' })], KATEGORILER)[0]
    .activeFrom === '12-20',
);
T.ok('Bos girdi bos sonuc', parseRemoteVariants([], KATEGORILER).length === 0);

// ─────────────────────────────────────────────────────────────────────────
T.H('mergeRemotePool — GOMULU METIN EZILEMEZ');

const gomulu = [
  { id: 'popcorn', category: 'episodeToday', weight: 1, tone: 'playful' },
  { id: 'plain', category: 'episodeToday', weight: 1, tone: 'neutral' },
];

// 🔴 ASIL GUVENLIK IDDIASI: uzak satir, gomulu bir varyantin METNINI
// degistiremez. Yanlislikla ya da kotu niyetle eklenmis bir satir,
// denetlenmis bir metnin yerine gecemez.
const ezmeDenemesi = parseRemoteVariants(
  [satir({ id: 'popcorn', title_tr: 'ELE GECIRILDI', body_tr: 'kotu metin', weight: 5 })],
  KATEGORILER,
);
const ezilmis = mergeRemotePool(gomulu, ezmeDenemesi, 'tr');
const popcorn = ezilmis.find((v) => v.id === 'popcorn');

T.ok('Gomulu varyantin metni EZILMEDI (text alani bos kaldi)', popcorn?.text === undefined);
T.ok('Yalnizca agirlik uygulandi', popcorn?.weight === 5);

// ✅ Bilincli olarak birakilan kapi: agirligi 0 yaparak uzaktan SUSTURMA.
T.ok(
  'weight=0 ile gomulu varyant uzaktan SUSTURULABILIR',
  mergeRemotePool(gomulu, parseRemoteVariants([satir({ id: 'popcorn', weight: 0 })], KATEGORILER), 'tr')
    .find((v) => v.id === 'popcorn')?.weight === 0,
);

const eklenmis = mergeRemotePool(gomulu, gecerli, 'tr');
T.ok('YENI uzak varyant havuza eklendi', eklenmis.length === 3);
T.ok(
  'Yeni varyantin metni kendisiyle geldi',
  eklenmis.find((v) => v.id === 'setAlarm')?.text?.title === 'Saatini kur',
);
T.ok(
  'Dil secimi calisiyor (en)',
  mergeRemotePool(gomulu, gecerli, 'en').find((v) => v.id === 'setAlarm')?.text?.title === 'Set your alarm',
);
T.ok(
  'Uzak havuz bos ise gomulu havuz AYNEN kalir',
  mergeRemotePool(gomulu, [], 'tr').length === 2,
);

// ─────────────────────────────────────────────────────────────────────────
T.H('interpolate — yer tutucu beyaz listesi ve temizlik');

const degiskenler = { showTitle: 'Dizi', seasonNumber: 3, episodeNumber: 7 };

T.ok(
  'Izinli degiskenler dolduruluyor',
  interpolate('{{showTitle}} S{{seasonNumber}}B{{episodeNumber}}', degiskenler) === 'Dizi S3B7',
);
T.ok('Bosluklu yazim da calisir', interpolate('{{ showTitle }}', degiskenler) === 'Dizi');

// 🔴 Tanimadigimiz yer tutucu HAM BIRAKILMAZ, silinir: kullaniciya sizdirma
// girisiminin izi bile gosterilmez.
T.ok(
  'Beyaz listede OLMAYAN yer tutucu SILINIR (ham birakilmaz)',
  interpolate('A {{apiKey}} B', degiskenler) === 'A B',
);
T.ok(
  'Deger verilmeyen izinli degisken de silinir',
  interpolate('A {{count}} B', degiskenler) === 'A B',
);

T.ok(
  'Kontrol karakterleri temizlenir',
  interpolate('A\u0007B\u200bC', degiskenler) === 'ABC',
);
T.ok(
  'Uzun metin ' + MAX_TEXT_LENGTH + ' karaktere kirpilir',
  interpolate('x'.repeat(500), degiskenler).length === MAX_TEXT_LENGTH,
);
T.ok('Metin olmayan girdi bos dizge doner', interpolate(null, degiskenler) === '' && interpolate(42, degiskenler) === '');
T.ok('Yer tutucusuz metin oldugu gibi gecer', interpolate('Duz metin', degiskenler) === 'Duz metin');

T.bitir();
