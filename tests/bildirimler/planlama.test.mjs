// ==========================================================================
// BILDIRIMLER — B1: SAF PLANLAMA KATMANI
// ==========================================================================
// 🔴 BU DOSYANIN VAR OLUS SEBEBI: bildirim sisteminin karar veren kismi
// (ne zaman, hangi bolum, kac tane) Expo'ya HIC dokunmadan dogrulanabilsin.
// Cihaz testi pahali ve yavas; bu uc modul yanlissa cihazda saatlerce
// "neden gelmedi" aranir.
//
// 🔴 NEDEN `.mjs` VE NEDEN `.ts` DOGRUDAN IMPORT EDILIYOR:
// Node 24 TypeScript'i yerel calistiriyor (tur soyma). Olculdu: `.ts`
// icindeki UZANTISIZ calisma-zamani import'lari cozulemiyor
// (ERR_MODULE_NOT_FOUND). Bu yuzden test edilen uc modulun HICBIRINDE
// calisma-zamani import'u yok — bagimliliklar parametre olarak geciyor.
// Bu bir test hilesi degil, modullerin saf kalmasini zorlayan yapisal kural
// (bkz. features/notifications/scheduling/fireTime.ts basligi).
//
// 🔴 CIKTIDA TURKCE KARAKTER YOK — tests/yardimci.js kurali (SSH/Pi).

import yardimci from '../yardimci.js';
import { resolveFireTime } from '../../features/notifications/scheduling/fireTime.ts';
import { applyBudget } from '../../features/notifications/retention/budget.ts';
import {
  buildDefaultPrefs,
  reconcilePrefs,
  getActiveCategories,
} from '../../features/notifications/registry.ts';
import {
  planEpisodeToday,
  planSeasonPremiere,
} from '../../features/notifications/scheduling/planners/episodePlanners.ts';
import { planMovieRelease } from '../../features/notifications/scheduling/planners/movieReleasePlanner.ts';
import { dedupeByEntity } from '../../features/notifications/retention/dedupe.ts';
import {
  buildWatchedEpisodeKeys,
  buildWatchedMovieIds,
  mapCalendarToUpcoming,
  mapCalendarToUpcomingMovies,
  normalizeDateOnly,
} from '../../features/notifications/scheduling/mapCalendar.ts';

const { baslat } = yardimci;
const T = baslat('BILDIRIM PLANLAMA (B1)', { kokOneki: 'bildirim-test-' });

// 🔴 TUM TARIHLER YEREL DUVAR SAATIYLE KURULUYOR (`new Date(y, m, d, s)`).
// Sabit UTC dizgeleri yazmak testi calistigi makinenin saat dilimine
// bagimli kilardi; boylece test Turkiye'de de UTC'de de ayni sonucu verir.
const yerel = (y, ay, gun, saat = 0, dakika = 0) => new Date(y, ay, gun, saat, dakika, 0, 0);
const yerelISO = (...a) => yerel(...a).toISOString();

// ─────────────────────────────────────────────────────────────────────────
T.H('resolveFireTime — spoiler korumasi');

const simdi = yerel(2026, 8, 14, 12, 0).getTime();

T.ok(
  'Sabah 04:00 yayinlanan bolum AYNI GUN tercih saatinde (20:00) gonderilir',
  resolveFireTime(yerelISO(2026, 8, 15, 4, 0), 20, simdi) === yerel(2026, 8, 15, 20, 0).getTime(),
);

// EN INCE KURAL: tercih saati yayin saatinden ONCE kalirsa, o saatte
// "yeni bolum yayinlandi" demek duped uz yalan olur - bolum daha cikmamistir.
T.ok(
  'Gece 23:30 yayinlanan bolum ERTESI GUN 20:00e kaydirilir (yalan bildirim onlenir)',
  resolveFireTime(yerelISO(2026, 8, 15, 23, 30), 20, simdi) === yerel(2026, 8, 16, 20, 0).getTime(),
);

T.ok(
  'Tercih saati tam yayin saatine esitse AYNI GUN kalir (kaydirma tetiklenmez)',
  resolveFireTime(yerelISO(2026, 8, 15, 20, 0), 20, simdi) === yerel(2026, 8, 15, 20, 0).getTime(),
);

T.ok(
  'Gecmiste kalan an icin bildirim KURULMAZ (null)',
  resolveFireTime(yerelISO(2026, 8, 10, 4, 0), 20, simdi) === null,
);

T.ok(
  'Bugun yayinlandi ama tercih saati gecti ise KURULMAZ (gec bildirim yok)',
  resolveFireTime(yerelISO(2026, 8, 14, 4, 0), 20, yerel(2026, 8, 14, 21, 0).getTime()) === null,
);

T.ok(
  'Bozuk tarih sessizce NaN uretmez, null doner',
  resolveFireTime('kesinlikle-tarih-degil', 20, simdi) === null,
);

T.ok(
  'Gece yarisi tercihi (saat 0) gecerli bir deger olarak islenir',
  resolveFireTime(yerelISO(2026, 8, 15, 4, 0), 0, simdi) === yerel(2026, 8, 16, 0, 0).getTime(),
);

// ─────────────────────────────────────────────────────────────────────────
T.H('planEpisodeToday — secim kurallari');

const bolum = (id, gun, ek = {}) => ({
  showTitle: 'Test Dizisi',
  episodeTraktId: id,
  seasonNumber: 3,
  episodeNumber: 7,
  episodeTitle: 'Bolum Adi',
  firstAiredUtc: yerelISO(2026, 8, gun, 4, 0),
  alreadyWatched: false,
  ...ek,
});

const secenekler = {
  now: simdi,
  horizonDays: 14,
  resolveFireTime: (iso) => resolveFireTime(iso, 20, simdi),
  renderCopy: (v) => ({ title: 'Bugun yayinda', body: `${v.showTitle} S${v.seasonNumber}B${v.episodeNumber}` }),
};

const planlar = planEpisodeToday(
  [
    bolum(101, 15),
    bolum(102, 16, { alreadyWatched: true }),
    bolum(103, 15), // 101 ile ayni gun, farkli bolum
    bolum(101, 15), // KOPYA: Trakt takvimi ayni bolumu birden fazla dondurebilir
    bolum(104, 40), // ufuk disi (14 gunden uzak)
    bolum(105, 1), // gecmis
  ],
  secenekler,
);

const kimlikler = planlar.map((p) => p.identifier);

T.ok('Izlenmis bolum icin bildirim kurulmaz', !kimlikler.includes('episodeToday:102'));
T.ok('Ufuk disindaki bolum planlanmaz', !kimlikler.includes('episodeToday:104'));
T.ok('Gecmisteki bolum planlanmaz', !kimlikler.includes('episodeToday:105'));
T.ok(
  'Kopya bolum kaydi tekillestirilir',
  kimlikler.filter((k) => k === 'episodeToday:101').length === 1,
);
T.ok('Gecerli iki bolum planlandi', planlar.length === 2, 'uretilen: ' + planlar.length);

const ilk = planlar.find((p) => p.identifier === 'episodeToday:101');
T.ok('Kimlik deterministik ve kategori onekli', ilk?.identifier === 'episodeToday:101');
T.ok('Deep link bolum kimligine isaret eder', ilk?.data.deepLink === '/episode/101');
T.ok('Yuk (data) kategori ve varlik kimligi tasir', ilk?.data.categoryId === 'episodeToday' && ilk?.data.entityId === '101');
T.ok('Metin enjekte edilen renderCopy ile uretildi', ilk?.body === 'Test Dizisi S3B7');

T.ok(
  'Bos girdi bos plan uretir (patlamaz)',
  planEpisodeToday([], secenekler).length === 0,
);

// ─────────────────────────────────────────────────────────────────────────
T.H('applyBudget — sisme korumasi');

const kategoriler = [
  { id: 'episodeToday', channelId: 'episodes', defaultEnabled: true, priority: 10, tone: 'playful', budget: 3, i18nKey: 'x' },
];

const sahtePlan = (id, fireAt, categoryId = 'episodeToday') => ({
  identifier: `${categoryId}:${id}`,
  categoryId,
  fireAt,
  title: 't',
  body: 'b',
  data: { categoryId, entityId: String(id), deepLink: '/x' },
});

const bolBirakGirdi = [
  sahtePlan(5, simdi + 5000),
  sahtePlan(1, simdi + 1000),
  sahtePlan(4, simdi + 4000),
  sahtePlan(2, simdi + 2000),
  sahtePlan(3, simdi + 3000),
];
const girdiKopyasi = bolBirakGirdi.map((p) => p.identifier).join(',');

const butceli = applyBudget(bolBirakGirdi, kategoriler);

T.ok('Kategori kotasi uygulandi (5 plan -> 3)', butceli.length === 3, 'kalan: ' + butceli.length);
T.ok(
  'EN YAKIN tarihli planlar korundu',
  butceli.map((p) => p.identifier).join(',') === 'episodeToday:1,episodeToday:2,episodeToday:3',
);
T.ok(
  'Girdi dizisi YERINDE degistirilmedi (saf fonksiyon sozu)',
  bolBirakGirdi.map((p) => p.identifier).join(',') === girdiKopyasi,
);

T.ok(
  'Kayit defterinde OLMAYAN kategori dusurulur (kotasiz kategori genel tavani yiyemez)',
  applyBudget([sahtePlan(9, simdi + 100, 'bilinmeyenKategori')], kategoriler).length === 0,
);

// Kategori kotalarinin TOPLAMI genel tavani asabilir; ikinci kirpma sart.
const genisKategori = [{ ...kategoriler[0], budget: 100 }];
const cokPlan = Array.from({ length: 80 }, (_, i) => sahtePlan(i, simdi + (i + 1) * 1000));
T.ok(
  'Genel tavan kategori kotasindan BAGIMSIZ olarak uygulanir',
  applyBudget(cokPlan, genisKategori, 50).length === 50,
);

// ─────────────────────────────────────────────────────────────────────────
T.H('mapCalendar — Trakt yanitini esleme');

const takvimKaydi = (epId, showId, ek = {}) => ({
  first_aired: yerelISO(2026, 8, 15, 4, 0),
  episode: { season: 2, number: 5, title: 'Bolum', ids: { trakt: epId } },
  show: { title: 'Dizi', ids: { trakt: showId } },
  ...ek,
});

const izlenenAnahtarlar = buildWatchedEpisodeKeys([
  { show: { ids: { trakt: 900 } }, seasons: [{ number: 2, episodes: [{ number: 5 }, { number: 6 }] }] },
  { show: { ids: { trakt: 901 } } }, // `seasons` YOK — extended=full gelmemis
  { bozuk: true },
]);

T.ok('Izlenen bolum anahtari uretildi', izlenenAnahtarlar.has('900:2:5'));
T.ok('Izlenmeyen bolum anahtari uretilmedi', !izlenenAnahtarlar.has('900:2:7'));
T.ok(
  'seasons alani olmayan kayit COKERTMEZ, sadece atlanir',
  !izlenenAnahtarlar.has('901:2:5') && izlenenAnahtarlar.size === 2,
);

const eslenen = mapCalendarToUpcoming(
  [
    takvimKaydi(201, 900), // S2B5 -> izlenmis
    takvimKaydi(202, 902),
    { first_aired: yerelISO(2026, 8, 16, 4, 0), episode: { ids: { trakt: 203 } } }, // eksik alanlar
    { episode: { season: 1, number: 1, ids: { trakt: 204 } }, show: { title: 'X', ids: { trakt: 903 } } }, // first_aired yok
  ],
  izlenenAnahtarlar,
);

T.ok('Eksik alanli kayitlar elendi', eslenen.length === 2, 'kalan: ' + eslenen.length);
T.ok(
  'Izlenmis bolum alreadyWatched=true isaretlendi',
  eslenen.find((e) => e.episodeTraktId === 201)?.alreadyWatched === true,
);
T.ok(
  'Izlenmemis bolum alreadyWatched=false',
  eslenen.find((e) => e.episodeTraktId === 202)?.alreadyWatched === false,
);
T.ok(
  'Bos girdiler patlamaz',
  mapCalendarToUpcoming([], new Set()).length === 0 && buildWatchedEpisodeKeys([]).size === 0,
);

// Uctan uca: esleme -> planlama. Izlenmis bolum bildirime DONUSMEMELI.
const uctanUca = planEpisodeToday(eslenen, secenekler);
T.ok(
  'Uctan uca: izlenmis bolum plana girmedi',
  uctanUca.length === 1 && uctanUca[0].identifier === 'episodeToday:202',
);

// ─────────────────────────────────────────────────────────────────────────
T.H('planSeasonPremiere — yalnizca sezon ilk bolumu');

const promiyerAdaylari = [
  bolum(301, 15, { seasonNumber: 4, episodeNumber: 1 }), // gercek promiyer
  bolum(302, 15, { seasonNumber: 4, episodeNumber: 2 }), // sıradan bolum
  bolum(303, 15, { seasonNumber: 0, episodeNumber: 1 }), // Specials (sezon 0)
];
const promiyerler = planSeasonPremiere(promiyerAdaylari, secenekler).map((p) => p.identifier);

T.ok('Sezonun 1. bolumu promiyer olarak planlandi', promiyerler.includes('seasonPremiere:301'));
T.ok('Sezonun 2. bolumu promiyer DEGIL', !promiyerler.includes('seasonPremiere:302'));
// Trakt'ta 0. sezon "Specials"tir; her special'in 1. bolumunu promiyer saymak
// kullaniciya "yeni sezon basliyor" diye YANLIS haber gonderirdi.
T.ok('Sezon 0 (Specials) promiyer SAYILMAZ', !promiyerler.includes('seasonPremiere:303'));

// ─────────────────────────────────────────────────────────────────────────
T.H('dedupeByEntity — ayni icerik icin cift bildirim yok');

const defter = [
  { id: 'episodeToday', channelId: 'episodes', defaultEnabled: true, priority: 10, tone: 'playful', budget: 30, i18nKey: 'x' },
  { id: 'seasonPremiere', channelId: 'premieres', defaultEnabled: true, priority: 20, tone: 'playful', budget: 10, i18nKey: 'x' },
];
const plan = (categoryId, entityId, fireAt, tur = 'episode') => ({
  identifier: `${categoryId}:${entityId}`,
  categoryId,
  fireAt,
  title: 't',
  body: 'b',
  data: { categoryId, entityId: String(entityId), deepLink: `/${tur}/${entityId}`, plannedFireAt: fireAt },
});

// ASIL HATA: bir sezon promiyeri HEM episodeToday HEM seasonPremiere
// planlayicisinin kapsamina girer. Ikisi de acikken kullanici AYNI bolum
// icin arka arkaya iki bildirim alirdi.
const cakisan = dedupeByEntity(
  [plan('episodeToday', 301, simdi + 1000), plan('seasonPremiere', 301, simdi + 1000)],
  defter,
);
T.ok('Ayni bolum icin tek plan kaldi', cakisan.length === 1);
T.ok('Yuksek oncelikli (promiyer) kazandi', cakisan[0].categoryId === 'seasonPremiere');

T.ok(
  'Girdi sirasi sonucu DEGISTIRMEZ',
  dedupeByEntity(
    [plan('seasonPremiere', 301, simdi + 1000), plan('episodeToday', 301, simdi + 1000)],
    defter,
  )[0].categoryId === 'seasonPremiere',
);

// Trakt kimlikleri TUR ICINDE benzersizdir, turler arasinda DEGIL: 123 numarali
// bolum ile 123 numarali film farkli seylerdir. `entityId` ile eslestirseydik
// biri digerini yutardi.
T.ok(
  'Ayni sayili bolum ve film CAKISMAZ',
  dedupeByEntity(
    [plan('episodeToday', 123, simdi + 1000), plan('movieRelease', 123, simdi + 2000, 'movie')],
    [...defter, { id: 'movieRelease', channelId: 'movies', defaultEnabled: true, priority: 15, tone: 'playful', budget: 10, i18nKey: 'x' }],
  ).length === 2,
);

T.ok(
  'Esit oncelikte EN ERKEN tarihli kazanir (deterministik)',
  dedupeByEntity(
    [plan('episodeToday', 5, simdi + 9000), plan('episodeToday', 5, simdi + 1000)],
    defter,
  )[0].fireAt === simdi + 1000,
);

// ─────────────────────────────────────────────────────────────────────────
T.H('Filmler — normalizeDateOnly ve planMovieRelease');

// 🔴 Trakt film takvimi tarihi SAATSIZ verir ("2026-09-15").
// `new Date("2026-09-15")` bunu UTC gece yarisi sayar; negatif ofsetli saat
// dilimlerinde (ABD) bu YEREL olarak bir onceki gundur ve kullanici filmin
// cikisini bir gun ERKEN haber alirdi.
const normalize = normalizeDateOnly('2026-09-15');
const normalizeTarih = new Date(normalize);
T.ok(
  'Saatsiz tarih YEREL gune sabitlenir (saat dilimi kaymasi yok)',
  normalizeTarih.getFullYear() === 2026 &&
    normalizeTarih.getMonth() === 8 &&
    normalizeTarih.getDate() === 15 &&
    normalizeTarih.getHours() === 0,
);
T.ok(
  'Saat iceren deger oldugu gibi birakilir',
  normalizeDateOnly('2026-09-15T04:30:00.000Z') === '2026-09-15T04:30:00.000Z',
);

const izlenenFilmler = buildWatchedMovieIds([
  { movie: { ids: { trakt: 700 } } },
  { bozuk: true },
]);
const filmler = mapCalendarToUpcomingMovies(
  [
    { released: '2026-09-15', movie: { title: 'Izlenmis Film', ids: { trakt: 700 } } },
    { released: '2026-09-15', movie: { title: 'Yeni Film', ids: { trakt: 701 } } },
    { released: '2026-09-15', movie: { title: 'Kimliksiz' } },
    { movie: { title: 'Tarihsiz', ids: { trakt: 702 } } },
  ],
  izlenenFilmler,
);

T.ok('Eksik alanli film kayitlari elendi', filmler.length === 2, 'kalan: ' + filmler.length);
T.ok(
  'Izlenmis film isaretlendi',
  filmler.find((f) => f.movieTraktId === 700)?.alreadyWatched === true,
);

const filmPlanlari = planMovieRelease(filmler, {
  now: simdi,
  horizonDays: 30,
  resolveFireTime: (iso) => resolveFireTime(iso, 20, simdi),
  renderCopy: (v) => ({ title: 'Vizyonda', body: v.title }),
});

T.ok('Izlenmis film planlanmadi', filmPlanlari.length === 1);
T.ok('Film deep link /movie/ yoluna gider', filmPlanlari[0].data.deepLink === '/movie/701');
T.ok('Film kimligi kategori onekli', filmPlanlari[0].identifier === 'movieRelease:701');

// ─────────────────────────────────────────────────────────────────────────
T.H('reconcilePrefs — surum gecisi ve bozuk veri');

const varsayilan = buildDefaultPrefs();

T.ok('Kayit yoksa varsayilanlar doner', reconcilePrefs(null).masterEnabled === varsayilan.masterEnabled);
T.ok('Varsayilanda izin HENUZ sorulmamis', varsayilan.permissionPromptedAt === null);

// v1'de kaydedilmis tercih v2'de eklenen kategoriyi ICERMEZ. Uzlastirmazsak
// `prefs.categories[yeni]` undefined doner: kullanici Ayarlar'da "acik"
// gorurken bildirim ALMAZ.
const eskiKayit = { masterEnabled: true, categories: { episodeToday: false }, preferredHour: 9 };
const uzlasan = reconcilePrefs(eskiKayit);
T.ok('Kullanicinin eski secimi KORUNDU', uzlasan.categories.episodeToday === false);
T.ok('Yeni kategori varsayilanini aldi', uzlasan.categories.seasonPremiere === true);
T.ok('Gecerli saat korundu', uzlasan.preferredHour === 9);

T.ok(
  'Sinir disi saat varsayilana duser (NaN/Invalid Date zinciri kirilir)',
  reconcilePrefs({ ...eskiKayit, preferredHour: 99 }).preferredHour === 20 &&
    reconcilePrefs({ ...eskiKayit, preferredHour: -1 }).preferredHour === 20,
);

// 🔴 ASIL KURAL: "sordu mu?" izi kaybolursa kullaniciya izin diyalogu TEKRAR
// gosterilir — kullanicinin acikca istemedigi davranis.
T.ok(
  'Sorulmus isareti KORUNUR (bir daha otomatik sorulmaz)',
  reconcilePrefs({ ...eskiKayit, permissionPromptedAt: 1234567890 }).permissionPromptedAt === 1234567890,
);
T.ok(
  'Bozuk isaret "henuz sorulmadi" sayilir (ilk kurulumda dogru davranis)',
  reconcilePrefs({ ...eskiKayit, permissionPromptedAt: 'bozuk' }).permissionPromptedAt === null &&
    reconcilePrefs(eskiKayit).permissionPromptedAt === null,
);

T.ok(
  'Ana anahtar kapaliyken hicbir kategori aktif degil',
  getActiveCategories({ ...uzlasan, masterEnabled: false }).length === 0,
);
T.ok(
  'Ana anahtar acikken yalnizca acik kategoriler aktif',
  getActiveCategories(uzlasan).every((c) => uzlasan.categories[c.id]),
);

T.bitir();
