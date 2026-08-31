// ==========================================================================
// BILDIRIMLER — B4: BILDIRIM YORGUNLUGU KORUMASI (throttle)
// ==========================================================================
// 🔴 COZULEN SOMUT SORUN: takip listesi yogun bir kullanicinin bugun 6 bolumu
// varsa saat 20:00'de arka arkaya 6 bildirim dusuyordu. Bildirimi kapattiran
// davranislarin basinda bu gelir.
//
// Cikti ASCII (tests/yardimci.js kurali).

import yardimci from '../yardimci.js';
import {
  throttlePlans,
  localDayKey,
  AGGREGATE_THRESHOLD,
  DAILY_CAP,
} from '../../features/notifications/scheduling/throttle.ts';
import {
  shouldShowPromptBanner,
  BANNER_SNOOZE_MS,
} from '../../features/notifications/promptBanner.ts';

const { baslat } = yardimci;
const T = baslat('BILDIRIM YORGUNLUGU (B4)', { kokOneki: 'bildirim-throttle-' });

const yerel = (y, ay, gun, saat = 20) => new Date(y, ay, gun, saat, 0, 0, 0).getTime();

const defter = [
  { id: 'episodeToday', channelId: 'episodes', defaultEnabled: true, priority: 10, tone: 'playful', budget: 30, i18nKey: 'x' },
  { id: 'seasonPremiere', channelId: 'premieres', defaultEnabled: true, priority: 20, tone: 'playful', budget: 10, i18nKey: 'x' },
  { id: 'movieRelease', channelId: 'movies', defaultEnabled: true, priority: 15, tone: 'playful', budget: 10, i18nKey: 'x' },
];

const plan = (categoryId, id, fireAt) => ({
  identifier: `${categoryId}:${id}`,
  categoryId,
  fireAt,
  title: 't' + id,
  body: 'b' + id,
  data: { categoryId, entityId: String(id), deepLink: `/episode/${id}`, plannedFireAt: fireAt },
});

const ozet = ({ categoryId, count }) => ({
  title: `${count} adet`,
  body: `${categoryId} ozeti`,
  deepLink: '/(protected)/(tabs)/shows',
});

const cagir = (planlar, ek = {}) => throttlePlans(planlar, defter, { renderSummary: ozet, ...ek });

// ─────────────────────────────────────────────────────────────────────────
T.H('localDayKey — gun gruplari YEREL takvime gore');

T.ok(
  'Ayni yerel gundeki iki an ayni anahtari verir',
  localDayKey(yerel(2026, 8, 15, 9)) === localDayKey(yerel(2026, 8, 15, 23)),
);
T.ok(
  'Farkli gunler farkli anahtar verir',
  localDayKey(yerel(2026, 8, 15)) !== localDayKey(yerel(2026, 8, 16)),
);

// ─────────────────────────────────────────────────────────────────────────
T.H('Toplulastirma — asil sikayetin cozumu');

const altiBolum = Array.from({ length: 6 }, (_, i) =>
  plan('episodeToday', 100 + i, yerel(2026, 8, 15) + i * 1000),
);
const toplu = cagir(altiBolum);

T.ok('6 bolum TEK bildirime indi', toplu.length === 1, 'kalan: ' + toplu.length);
T.ok('Ozet kimligi deterministik ve gun icerir', toplu[0].identifier === 'episodeToday:summary:2026-09-15');
T.ok('Ozet metni sayiyi tasiyor', toplu[0].title === '6 adet');
T.ok('Ozet, turun LISTESINE goturur (tek icerige degil)', toplu[0].data.deepLink === '/(protected)/(tabs)/shows');
T.ok(
  'Ozet grubun EN ERKEN aninda gider (gunun ilki yayinlaninca)',
  toplu[0].fireAt === Math.min(...altiBolum.map((p) => p.fireAt)),
);
T.ok('Ozet yuku plannedFireAt tasiyor (scheduler fark hesabi icin)', toplu[0].data.plannedFireAt === toplu[0].fireAt);

T.ok(
  'Esik ALTINDA kalan grup toplulastirilmaz (2 < 3)',
  cagir([plan('episodeToday', 1, yerel(2026, 8, 15)), plan('episodeToday', 2, yerel(2026, 8, 15))]).length === 2,
);
T.ok('Esik degeri ' + AGGREGATE_THRESHOLD + ' olarak disa aciliyor', AGGREGATE_THRESHOLD === 3);

T.ok(
  'FARKLI GUNLER ayri gruplanir, birbirine karismaz',
  cagir([
    ...Array.from({ length: 3 }, (_, i) => plan('episodeToday', 200 + i, yerel(2026, 8, 15) + i)),
    plan('episodeToday', 300, yerel(2026, 8, 16)),
  ]).length === 2,
);

T.ok(
  'FARKLI KATEGORILER ayri gruplanir (bolumler ozetlenir, film tekil kalir)',
  (() => {
    const r = cagir([
      ...Array.from({ length: 3 }, (_, i) => plan('episodeToday', 400 + i, yerel(2026, 8, 15) + i)),
      plan('movieRelease', 500, yerel(2026, 8, 15)),
    ]);
    return r.length === 2 && r.some((p) => p.identifier.includes('summary')) && r.some((p) => p.categoryId === 'movieRelease');
  })(),
);

// Metin uretilemezse kullaniciyi bildirimsiz birakmak EN KOTU sonuc olurdu:
// toplulastirma YAPILMAZ, tekil bildirimler korunur.
// ⚠️ Ama gunluk tavan AYRI bir kuraldir ve yine uygulanir — bu yuzden 6 degil
// DAILY_CAP kadar kalir. (Ilk yazimda 6 bekliyordum, test yanlisimi yakaladi.)
T.ok(
  'renderSummary null donerse OZET URETILMEZ, tekil bildirimler kalir',
  (() => {
    const r = cagir(altiBolum, { renderSummary: () => null });
    return r.length === DAILY_CAP && r.every((p) => !p.identifier.includes('summary'));
  })(),
);

// ─────────────────────────────────────────────────────────────────────────
T.H('Gunluk tavan — toplulastirmadan SONRA');

T.ok('Tavan degeri ' + DAILY_CAP + ' olarak disa aciliyor', DAILY_CAP === 3);

// Ayni gunde 4 FARKLI kategori-grubu: toplulastirma ise yaramaz (her biri
// tekil), tavan devreye girer ve DUSUK oncelikli dusr.
const karisik = [
  plan('episodeToday', 1, yerel(2026, 8, 15, 20)),
  plan('episodeToday', 2, yerel(2026, 8, 15, 20)),
  plan('seasonPremiere', 3, yerel(2026, 8, 15, 20)),
  plan('movieRelease', 4, yerel(2026, 8, 15, 20)),
];
const tavanli = cagir(karisik);

T.ok('Gunluk tavan uygulandi (4 -> 3)', tavanli.length === 3, 'kalan: ' + tavanli.length);
T.ok(
  'YUKSEK oncelikli (promiyer) korundu',
  tavanli.some((p) => p.categoryId === 'seasonPremiere'),
);
T.ok(
  'Orta oncelikli (film) korundu',
  tavanli.some((p) => p.categoryId === 'movieRelease'),
);
T.ok(
  'Dusuk oncelikliden yalnizca biri kaldi',
  tavanli.filter((p) => p.categoryId === 'episodeToday').length === 1,
);

T.ok(
  'Girdi sirasi sonucu DEGISTIRMEZ (deterministik)',
  (() => {
    const a = cagir(karisik).map((p) => p.identifier).sort().join(',');
    const b = cagir([...karisik].reverse()).map((p) => p.identifier).sort().join(',');
    return a === b;
  })(),
);

T.ok(
  'Tavan GUN BASINA uygulanir, toplamda degil',
  cagir([
    plan('episodeToday', 1, yerel(2026, 8, 15)),
    plan('seasonPremiere', 2, yerel(2026, 8, 15)),
    plan('movieRelease', 3, yerel(2026, 8, 15)),
    plan('episodeToday', 4, yerel(2026, 8, 16)),
    plan('seasonPremiere', 5, yerel(2026, 8, 16)),
  ]).length === 5,
);

T.ok('Girdi dizisi YERINDE degistirilmedi', (() => {
  const girdi = [...karisik];
  cagir(girdi);
  return girdi.length === 4;
})());

T.ok('Bos girdi patlamaz', cagir([]).length === 0);

// ─────────────────────────────────────────────────────────────────────────
T.H('shouldShowPromptBanner — nazik hatirlatma ne zaman cikar');

const band = (ek = {}) =>
  shouldShowPromptBanner({
    permission: 'undetermined',
    masterEnabled: true,
    dismissedAt: null,
    now: yerel(2026, 8, 15),
    ...ek,
  });

T.ok('Izin istenmemisse GORUNUR', band() === true);
T.ok('Izin reddedilmisse GORUNUR (cihaz ayarlarina yonlendirir)', band({ permission: 'denied' }) === true);
T.ok('Izin VERILMISSE gorunmez (hatirlatacak sey yok)', band({ permission: 'granted' }) === false);
T.ok('Web (unsupported) gorunmez — yapilabilecek bir sey yok', band({ permission: 'unsupported' }) === false);
T.ok('Izin durumu HENUZ OKUNMAMISSA gorunmez (ekran ziplamasin)', band({ permission: null }) === false);

// 🔑 En onemli kural: kullanici ana anahtari KENDI kapattiysa israr yok.
T.ok(
  'Kullanici bildirimleri kendi kapattiysa ISRAR YOK',
  band({ masterEnabled: false }) === false,
);

const simdiBand = yerel(2026, 8, 15);
T.ok(
  'Kapatildiktan hemen sonra gorunmez',
  band({ dismissedAt: simdiBand - 1000, now: simdiBand }) === false,
);
T.ok(
  'Erteleme suresi dolmadan gorunmez (6 gun)',
  band({ dismissedAt: simdiBand - 6 * 24 * 3600 * 1000, now: simdiBand }) === false,
);
T.ok(
  'Erteleme suresi dolunca TEKRAR gorunur (8 gun)',
  band({ dismissedAt: simdiBand - 8 * 24 * 3600 * 1000, now: simdiBand }) === true,
);
T.ok('Erteleme suresi ' + BANNER_SNOOZE_MS / (24 * 3600 * 1000) + ' gun', BANNER_SNOOZE_MS === 7 * 24 * 3600 * 1000);

// Bozuk damga bandi SONSUZA KADAR gizleyebilirdi.
T.ok(
  'Gelecek tarihli/bozuk damga bandi kalici gizlemez',
  band({ dismissedAt: simdiBand + 999999999, now: simdiBand }) === true &&
    band({ dismissedAt: Number.NaN, now: simdiBand }) === true,
);

T.bitir();
