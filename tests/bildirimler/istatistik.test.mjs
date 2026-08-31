// ==========================================================================
// BILDIRIMLER — B6: AYLIK IZLEME OZETI (anlik goruntu farki)
// ==========================================================================
// 🔴 BU TAKIMIN VAR OLUS SEBEBI: bu kategori kullaniciya SAYI soyluyor.
// Yanlis bir sayi, "45 saat izledin" diyip aslinda 3 saat izlemis olmak,
// guveni bir daha toplanmayacak sekilde kirar. O yuzden hesabin her siniri
// burada kilitli.
//
// Yontem: Trakt `/users/me/stats` TUM ZAMANLARIN toplam dakikasini verir.
// Iki tarih arasindaki FARK, o donemde izlenen dakikanin ta kendisidir.
// (Alternatiflerin neden elendigi `stats/snapshot.ts` basliginda.)
//
// Cikti ASCII (tests/yardimci.js kurali).

import yardimci from '../yardimci.js';
import { evaluateMonthlyStats } from '../../features/notifications/stats/snapshot.ts';
import { planMonthlyStats } from '../../features/notifications/scheduling/planners/monthlyStatsPlanner.ts';
import { snapToPreferredHour } from '../../features/notifications/scheduling/fireTime.ts';

const { baslat } = yardimci;
const T = baslat('AYLIK OZET (B6)', { kokOneki: 'bildirim-stats-' });

const GUN = 24 * 3600 * 1000;
const simdi = new Date(2026, 8, 15, 12, 0, 0, 0).getTime();

const goruntu = (takenAt, ek = {}) => ({
  takenAt,
  episodeMinutes: 1000,
  movieMinutes: 500,
  episodesWatched: 50,
  moviesWatched: 10,
  ...ek,
});
const guncel = (ek = {}) => ({
  episodeMinutes: 1000,
  movieMinutes: 500,
  episodesWatched: 50,
  moviesWatched: 10,
  ...ek,
});

// ─────────────────────────────────────────────────────────────────────────
T.H('evaluateMonthlyStats — taban alma');

// ILK CALISTIRMA: "tum zamanlarin toplami"ni bu ayin rakami gibi sunmak
// duped uz yalan olurdu. Yalnizca taban alinir.
const ilk = evaluateMonthlyStats(null, guncel(), simdi, 28);
T.ok('Ilk calistirmada BILDIRIM URETILMEZ', ilk.report === null);
T.ok('Ilk calistirmada taban KAYDEDILIR', ilk.nextSnapshot?.episodeMinutes === 1000);
T.ok('Taban zamani simdi olarak damgalandi', ilk.nextSnapshot?.takenAt === simdi);

// Istatistikler yuklenmediyse yanlis taban kaydetmek, SONRAKI ayin sayisini
// kalici olarak bozardi.
const veriYok = evaluateMonthlyStats(null, null, simdi, 28);
T.ok('Istatistik yoksa taban da ALINMAZ', veriYok.report === null && veriYok.nextSnapshot === null);

T.ok(
  'Bozuk taban (takenAt sayi degil) yeni taban aldirir',
  evaluateMonthlyStats({ takenAt: 'bozuk' }, guncel(), simdi, 28).nextSnapshot !== null,
);

// ─────────────────────────────────────────────────────────────────────────
T.H('evaluateMonthlyStats — donem ve fark hesabi');

T.ok(
  'Donem DOLMADIYSA hicbir sey yapilmaz (taban da yenilenmez)',
  (() => {
    const r = evaluateMonthlyStats(goruntu(simdi - 10 * GUN), guncel({ episodeMinutes: 3000 }), simdi, 28);
    return r.report === null && r.nextSnapshot === null;
  })(),
);

const rapor = evaluateMonthlyStats(
  goruntu(simdi - 30 * GUN),
  guncel({ episodeMinutes: 3400, movieMinutes: 800, episodesWatched: 95, moviesWatched: 13 }),
  simdi,
  28,
);

T.ok('Donem dolunca rapor uretildi', rapor.report !== null);
// (3400-1000) + (800-500) = 2700 dakika
T.ok('Dakika farki DOGRU hesaplandi', rapor.report?.minutes === 2700, 'dakika: ' + rapor.report?.minutes);
T.ok('Bolum farki dogru', rapor.report?.episodes === 45);
T.ok('Film farki dogru', rapor.report?.movies === 3);
T.ok('Donem uzunlugu tasiniyor', rapor.report?.periodDays === 30);
T.ok('Rapor sonrasi yeni taban alindi', rapor.nextSnapshot?.episodeMinutes === 3400);

// 🔴 Kullanici Trakt'ta gecmisini silerse toplamlar DUSER. "Bu ay -3 saat
// izledin" saclamaligi olmamali.
T.ok(
  'Negatif fark sifira kirpilir ve bildirim gonderilmez',
  (() => {
    const r = evaluateMonthlyStats(goruntu(simdi - 30 * GUN), guncel({ episodeMinutes: 10, movieMinutes: 5 }), simdi, 28);
    return r.report === null && r.nextSnapshot !== null;
  })(),
);

// "Bu ay 0 saat izledin" hem degersiz hem kullaniciyi suclayan bir mesaj.
T.ok(
  'Hic izlenmemisse bildirim YOK ama taban yenilenir (her acilista tekrar denenmesin)',
  (() => {
    const r = evaluateMonthlyStats(goruntu(simdi - 30 * GUN), guncel(), simdi, 28);
    return r.report === null && r.nextSnapshot?.takenAt === simdi;
  })(),
);

// ─────────────────────────────────────────────────────────────────────────
T.H('planMonthlyStats — bildirim uretimi');

const secenek = {
  now: simdi,
  snapToPreferredHour: (t) => snapToPreferredHour(t, 20),
  renderCopy: (v) => ({ title: `${v.hours} saat`, body: `${v.episodes} bolum / ${v.periodDays} gun` }),
};

const planlar = planMonthlyStats(rapor.report, secenek);

T.ok('Rapor varsa TEK bildirim uretilir', planlar.length === 1);
T.ok('Kimlik gun bazli ve deterministik', planlar[0].identifier === 'monthlyStats:2026-09-15');
T.ok('Istatistik ekranina goturur', planlar[0].data.deepLink === '/(protected)/profile/statistics');
T.ok('Tercih saatine yaslandi', planlar[0].fireAt === new Date(2026, 8, 15, 20).getTime());
// "2.700 dakika" okunmaz, "45 saat" okunur.
T.ok('Dakika SAATE yuvarlanarak metne gecti', planlar[0].title === '45 saat', 'baslik: ' + planlar[0].title);
T.ok('Donem uzunlugu metne gecti', planlar[0].body === '45 bolum / 30 gun');

T.ok('Rapor yoksa bildirim YOK', planMonthlyStats(null, secenek).length === 0);
T.ok(
  'Sifir dakikalik rapor bildirime DONUSMEZ',
  planMonthlyStats({ minutes: 0, episodes: 0, movies: 0, periodDays: 30 }, secenek).length === 0,
);

T.bitir();
