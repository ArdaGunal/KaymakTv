// ==========================================================================
// ARAYUZ — §C17: PROFIL ISTATISTIGI VE ILERLEME YUZDESI
// ==========================================================================
// Kullanici raporu (2026-09-12): profildeki "kac dizi/film izledin" bolumu ve
// dizilerin altindaki renk kodlu ilerleme cubugu KAYBOLMUSTU; yuzde de
// "dogrudur ama yine bak" dendi.
//
// Risk: bu sayilar kullanicinin emegini temsil ediyor. YANLIS bir sayi,
// eksik bir sayidan daha kotudur — kullanici verisini kaybettigini saniyor.
//
// Cikti ASCII (tests/yardimci.js kurali).

import yardimci from '../yardimci.js';
import { yerelIstatistik, gosterilecekIstatistik } from '../../utils/yerelIstatistik.ts';
import { getProgressBarColor, PROGRESS_BAR_COLOR } from '../../utils/progressBarColor.ts';
import { yanitiSekillendir } from '../../services/library/kaymakSekil.ts';

const { baslat } = yardimci;
const T = baslat('ARAYUZ PROFIL ISTATISTIGI (C17)', { kokOneki: 'arayuz-c17-' });

const dizi = (traktId, runtime) => ({ show: { ids: { trakt: traktId }, runtime } });
const film = (runtime, plays) => ({ movie: { runtime }, ...(plays === undefined ? {} : { plays }) });

// ─────────────────────────────────────────────────────────────────────────
T.H('Yerel istatistik — kendi verimizden hesap (C17.2)');

const S = [dizi(1, 45), dizi(2, 22), dizi(3, 50)];
const M = [film(120), film(90, 3)];
const P = { 1: { aired: 100, completed: 40 }, 2: { aired: 20, completed: 20 }, 3: { aired: 10, completed: 0 } };

const r = yerelIstatistik(S, M, P);
T.ok('izlenen bolum = tamamlananlarin toplami', r.episodes.watched === 60, String(r.episodes.watched));
T.ok('bolum dakikasi = tamamlanan x bolum suresi',
  r.episodes.minutes === 40 * 45 + 20 * 22, String(r.episodes.minutes));
T.ok('🔴 hic izlenmemis dizi sayima GIRMEZ (completed 0)', r.episodes.watched === 60);
T.ok('izlenen film = TEKIL film sayisi (plays degil)', r.movies.watched === 2, String(r.movies.watched));
T.ok('film dakikasi yeniden izlemeyi SAYAR (plays)',
  r.movies.minutes === 120 * 1 + 90 * 3, String(r.movies.minutes));

const bos = yerelIstatistik([], [], {});
T.ok('bos kutuphane sifir doner, coker degil', bos.episodes.watched === 0 && bos.movies.watched === 0);
T.ok('null girdiler coker degil',
  yerelIstatistik(null, null, null).episodes.watched === 0);

T.ok(
  '🔴 runtime BILINMEYEN yapim SAYIMDAN dusmez, yalnizca sureye 0 katar',
  (() => {
    const x = yerelIstatistik([dizi(9, undefined)], [film(undefined)], { 9: { aired: 5, completed: 5 } });
    return x.episodes.watched === 5 && x.episodes.minutes === 0
      && x.movies.watched === 1 && x.movies.minutes === 0;
  })(),
);
T.ok(
  'bozuk runtime (metin/negatif) 0 sayilir',
  yerelIstatistik([dizi(7, 'abc')], [film(-10)], { 7: { aired: 2, completed: 2 } }).episodes.minutes === 0,
);
T.ok(
  'ilerlemesi CEKILMEMIS dizi sessizce atlanir (harita eksik)',
  yerelIstatistik([dizi(42, 45)], [], {}).episodes.watched === 0,
);
T.ok(
  'kimliksiz kayit coker degil',
  yerelIstatistik([{ show: {} }, {}], [{}], {}).episodes.watched === 0,
);

// ─────────────────────────────────────────────────────────────────────────
T.H('Gosterilecek istatistik — T6.2: YEREL ONCE, Trakt YEDEK');

// 🔄 ONCELIK TERSINE CEVRILDI (T6.2, 2026-09-14). T6.1den sonra yerel
// hesabin uc girdisi de BIZDEN geliyor ve eksiksiz; Trakti tercih etmeye
// devam etmek kendi verimiz dururken dis servise sormak olurdu.
T.ok(
  '🔑 YEREL veri VARSA Trakt gelse bile YEREL kullanilir',
  (() => {
    const g = gosterilecekIstatistik(
      { episodes: { watched: 7349, minutes: 300000 }, movies: { watched: 195, minutes: 20000 } }, r);
    return g.episodes.watched === 60 && g.movies.watched === 2;
  })(),
);
T.ok('Trakt verisi YOKSA da yerel hesap calisir (Google hesabi)',
  gosterilecekIstatistik(null, r).episodes.watched === 60);
T.ok('undefined de yerele duser', gosterilecekIstatistik(undefined, r).movies.watched === 2);
T.ok(
  '🔴 YEREL BOSSA onbellekteki Trakt degeri yedek — "0 saat" gostermekten iyi',
  (() => {
    const g = gosterilecekIstatistik(
      { episodes: { watched: 7349, minutes: 300000 }, movies: { watched: 195, minutes: 20000 } }, bos);
    return g.episodes.watched === 7349 && g.movies.minutes === 20000;
  })(),
);
T.ok(
  '🔴 HIC veri yoksa null — "0 / 0" gostermek yaniltici olurdu',
  gosterilecekIstatistik(null, bos) === null,
);
T.ok(
  'yerel bosken sunucu govdesi bozuksa sayilar 0a kenetlenir, coker degil',
  (() => {
    const g = gosterilecekIstatistik({ episodes: { watched: 'x' } }, bos);
    return g.episodes.watched === 0 && g.movies.watched === 0;
  })(),
);

// ─────────────────────────────────────────────────────────────────────────
T.H('Ilerleme yuzdesi ve renk (C17.1 + C17.3)');

const yuzde = (completed, aired) => (aired > 0 && completed > 0 ? (completed / aired) * 100 : 0);

T.ok('yarisi izlenmis dizi %50', yuzde(10, 20) === 50);
T.ok('tamami izlenmis %100', yuzde(20, 20) === 100);
T.ok('hic izlenmemis %0 (cubuk CIZILMEZ)', yuzde(0, 20) === 0);
T.ok('🔴 yayinlanmamis dizi (aired 0) SIFIRA BOLMEZ', yuzde(0, 0) === 0);
T.ok('tek bolum izlenmis 24 bolumluk dizi ~%4,2', Math.round(yuzde(1, 24) * 10) / 10 === 4.2);
T.ok(
  '🔑 payda YAYINLANAN bolum (aired), TOPLAM bolum degil — devam eden dizi %100 olabilir',
  yuzde(30, 30) === 100,
);

T.ok('birakilan -> turuncu', getProgressBarColor(true, false) === PROGRESS_BAR_COLOR.dropped);
T.ok('🔑 birakilan VE bitmis -> yine turuncu (birakilma once bakilir)',
  getProgressBarColor(true, true) === PROGRESS_BAR_COLOR.dropped);
T.ok('tamamlanmis -> yesil', getProgressBarColor(false, true) === PROGRESS_BAR_COLOR.finished);
T.ok('devam ediyor -> mavi', getProgressBarColor(false, false) === PROGRESS_BAR_COLOR.active);
T.ok('uc renk birbirinden FARKLI',
  new Set(Object.values(PROGRESS_BAR_COLOR)).size === 3);

// ─────────────────────────────────────────────────────────────────────────
T.H('Kaymak yolu — runtime akiyor mu (C17.2 cihaz raporu)');
// Kullanici (2026-09-12, APK): *"google only kullanicilarinda 0 gozukuyor…
// kac saat dizi film izledi yazmiyor."* Sebep: /library/sync yanitinda
// `runtime` HIC yoktu, istemci de sureyi ondan hesapliyordu. Sayim dogruydu,
// yalnizca SURE sifirdi. Sunucu artik kolonu donduruyor; bu test zincirin
// istemci ayagini kilitliyor.

const yanit = {
  diziler: [
    { traktId: 1, title: 'A', year: 2020, tmdbId: 11, runtime: 45,
      ilerleme: { aired: 10, completed: 4, last_watched_at: '2026-09-01T00:00:00Z' } },
    { traktId: 2, title: 'B', year: 2021, tmdbId: 12, runtime: null,
      ilerleme: { aired: 5, completed: 5, last_watched_at: null } },
  ],
  filmler: [
    { traktId: 9, title: 'F', year: 2019, tmdbId: 19, runtime: 120, plays: 2, last_watched_at: null },
  ],
};

const sekil = yanitiSekillendir(yanit);
T.ok('dizi nesnesi runtime TASIYOR', sekil.watchedShows[0].show.runtime === 45);
T.ok('runtime null ise undefined (sayima engel DEGIL)', sekil.watchedShows[1].show.runtime === undefined);
T.ok('film nesnesi runtime TASIYOR', sekil.watchedMovies[0].movie.runtime === 120);
T.ok('plays korunuyor', sekil.watchedMovies[0].plays === 2);
T.ok('ids.trakt korunuyor (magazanin anahtari)', sekil.watchedShows[0].show.ids.trakt === 1);

const kY = yerelIstatistik(sekil.watchedShows, sekil.watchedMovies, sekil.showProgressMap);
T.ok('🔴 ARTIK SURE HESAPLANIYOR (eskiden 0 idi)', kY.episodes.minutes === 4 * 45, String(kY.episodes.minutes));
T.ok('runtime bilinmeyen dizi sayima giriyor, sureye 0 katiyor', kY.episodes.watched === 9, String(kY.episodes.watched));
T.ok('film suresi plays ile carpiliyor', kY.movies.minutes === 240, String(kY.movies.minutes));
T.ok('🔑 bolum artik gorunur (null degil)', gosterilecekIstatistik(null, kY) !== null);

// ─────────────────────────────────────────────────────────────────────────
T.H('Tur etiketleri — favori tur (C18)');
// Kullanici (2026-09-12, APK): *"favori tur yazmiyor."* Sebep: /library/sync
// `genres` dondurmuyordu cunku catalog_entities'te kolon HIC yoktu (047).

const turluYanit = {
  diziler: [
    { traktId: 1, title: 'A', year: 2020, tmdbId: 11, runtime: 45,
      genres: ['drama', 'science-fiction'],
      ilerleme: { aired: 10, completed: 4, last_watched_at: null } },
    { traktId: 2, title: 'B', year: 2021, tmdbId: 12, runtime: 20,
      genres: null,
      ilerleme: { aired: 4, completed: 4, last_watched_at: null } },
  ],
  filmler: [
    { traktId: 9, title: 'F', year: 2019, tmdbId: 19, runtime: 120,
      genres: ['comedy'], plays: 1, last_watched_at: null },
  ],
};
const tS = yanitiSekillendir(turluYanit);
T.ok('dizi turleri tasiniyor', JSON.stringify(tS.watchedShows[0].show.genres) === '["drama","science-fiction"]');
T.ok('film turleri tasiniyor', JSON.stringify(tS.watchedMovies[0].movie.genres) === '["comedy"]');
T.ok('🔑 tur YOKSA undefined ("bilinmiyor"), bos dizi DEGIL',
  tS.watchedShows[1].show.genres === undefined);

// 047 uygulanmadan sunucu alani hic gondermez -> istemci cokmemeli
const eskiYanit = {
  diziler: [{ traktId: 3, title: 'C', year: 2020, tmdbId: 13, runtime: 30,
    ilerleme: { aired: 2, completed: 2, last_watched_at: null } }],
  filmler: [],
};
const eS = yanitiSekillendir(eskiYanit);
T.ok('🔴 047 ONCESI yanit (genres alani HIC yok) cokme YAPMAZ',
  eS.watchedShows[0].show.genres === undefined && eS.watchedShows[0].show.runtime === 30);
T.ok('sure hesabi tur eksikliginden ETKILENMEZ',
  yerelIstatistik(eS.watchedShows, [], eS.showProgressMap).episodes.minutes === 60);

T.bitir();
