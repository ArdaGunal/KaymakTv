import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

// BASLIK (2.6.8) · Ekranda hangi ad yazar? Kararlar `docs/testler/2.6.8.md` §0. Örnekler arşivde ölçüldü.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = yardimci.baslat('GORUNEN BASLIK (BASLIK-04/05/06)', { kokOneki: 'gorunen-baslik-' });
const oku = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const { gorunenBaslik, buyukBaslik, ikincilBaslik } = tsLoader(root)('utils/gorunenBaslik.ts');

const cekic = { title: 'The Hammer and the Rose', language: 'tr', original_title: 'Çekiç ve Gül', titles: { tr: 'Çekiç ve Gül', en: 'The Hammer and the Rose' } };
const dark = { title: 'Dark Legacy', language: 'tr', original_title: 'Kötü Kan', titles: { tr: 'Kötü Kan', en: 'Dark Legacy' } };
const trendCekic = { title: 'The Hammer and the Rose', language: 'tr', original_title: 'Çekiç ve Gül' };
const got = { title: 'Game of Thrones', language: 'en', original_title: 'Game of Thrones', titles: { en: 'Game of Thrones' } };
const aot = { title: 'Attack on Titan', language: 'ja', original_title: '進撃の巨人', titles: {} };
const heist = { title: 'Money Heist', language: 'es', original_title: 'La casa de papel', titles: { en: 'Money Heist' } };
const avengers = { title: 'The Avengers', language: 'en', original_title: 'The Avengers', titles: { tr: 'Yenilmezler' } };
const eski = { title: 'Eski Kayit' };

T.H('Ana baslik');
T.ok('tr + yerli: Turkce ad', gorunenBaslik(cekic, 'tr') === 'Çekiç ve Gül');
T.ok('tr + yerli: sozluk ozgun adin onunde', gorunenBaslik(dark, 'tr') === 'Kötü Kan');
T.ok('tr + yerli, sozluk yok (Trakt ekrani): ozgun ad', gorunenBaslik(trendCekic, 'tr') === 'Çekiç ve Gül');
T.ok('tr + yabanci: uluslararasi ad', gorunenBaslik(got, 'tr') === 'Game of Thrones' && gorunenBaslik(aot, 'tr') === 'Attack on Titan');
T.ok('tr + yabanci: ceviri ana basliga gecmez', gorunenBaslik(avengers, 'tr') === 'The Avengers');
T.ok('en: Turkce ad yok', gorunenBaslik(cekic, 'en') === 'The Hammer and the Rose' && gorunenBaslik(dark, 'en') === 'Dark Legacy');
T.ok('Dil etiketi tr-TR de tr sayilir', gorunenBaslik(cekic, 'tr-TR') === 'Çekiç ve Gül');
T.ok('Bilinmeyen dil varsayilana duser, Turkceye degil', gorunenBaslik(cekic, 'de') === 'The Hammer and the Rose');
T.ok('Baslik alani olmayan eski kayit bozulmaz', gorunenBaslik(eski, 'tr') === 'Eski Kayit');
T.ok('Yapim yoksa bos metin', gorunenBaslik(null, 'tr') === '' && gorunenBaslik(undefined, 'tr') === '');

T.H('Buyuk harf');
T.ok('Turkce: CEKIC degil, noktali I', buyukBaslik(cekic, 'tr') === 'ÇEKİÇ VE GÜL', buyukBaslik(cekic, 'tr'));
T.ok('Ingilizce: Ingilizce kural', buyukBaslik({ title: 'Kill Bill' }, 'en') === 'KILL BILL');
T.ok('Ad yoksa yedek', buyukBaslik({ title: '' }, 'tr', 'isimsiz') === 'İSİMSİZ');

T.H('Detay ikincil satiri');
T.ok('Yerli yapimda yok', ikincilBaslik(cekic, 'tr') === null);
T.ok('Yabancida ceviri, etiketsiz', JSON.stringify(ikincilBaslik(avengers, 'tr')) === JSON.stringify({ metin: 'Yenilmezler', ozgunMu: false }));
T.ok('Ceviri yoksa ayni alfabeli ozgun ad, etiketli', JSON.stringify(ikincilBaslik(heist, 'tr')) === JSON.stringify({ metin: 'La casa de papel', ozgunMu: true }));
T.ok('Ingilizce uygulamada Cekic ve Gul ozgun ad olarak', JSON.stringify(ikincilBaslik(cekic, 'en')) === JSON.stringify({ metin: 'Çekiç ve Gül', ozgunMu: true }));
T.ok('Kanji alt satira gelmez', ikincilBaslik(aot, 'tr') === null);
T.ok('Normallesince ayni ise yok', ikincilBaslik({ title: 'The Hammer and The Rose', language: 'en', original_title: 'the hammer, and the rose' }, 'tr') === null);
T.ok('Ana adla ayni ise yok', ikincilBaslik(got, 'tr') === null);

T.H('Kutuphane sekli');
const { yanitiSekillendir } = tsLoader(root)('services/library/kaymakSekil.ts');
const sekil = yanitiSekillendir({
  diziler: [{ traktId: 1, title: 'The Hammer and the Rose', language: 'tr', original_title: 'Çekiç ve Gül', titles: { tr: 'Çekiç ve Gül' }, ilerleme: {} }],
  filmler: [{ traktId: 2, title: 'The Avengers', language: 'en', original_title: 'The Avengers', titles: { tr: 'Yenilmezler' } }],
});
T.ok('Dizi uc alani tasiyor', gorunenBaslik(sekil.watchedShows[0].show, 'tr') === 'Çekiç ve Gül');
T.ok('Film uc alani tasiyor', ikincilBaslik(sekil.watchedMovies[0].movie, 'tr').metin === 'Yenilmezler');

T.H('Takip mantigi');
const { categorizeShows } = tsLoader(root, {})('store/tracking/trackingLogic.ts');
const kart = categorizeShows({
  watchedShows: [], watchlistShows: [{ show: { ...cekic, ids: { trakt: 1 } } }], showProgressMap: {},
  labels: { dil: 'tr', unnamedShow: 'x', notStarted: 'y', caughtUp: 'z' },
});
T.ok('Dizi karti: dile duyarli buyuk ad', kart.notStarted[0]?.showName === 'ÇEKİÇ VE GÜL', JSON.stringify(kart.notStarted[0]?.showName));
const { categorizeMovies } = tsLoader(root, {})('store/tracking/movieTrackingLogic.ts');
const filmKart = categorizeMovies({
  watchedMovies: [], watchlistMovies: [{ movie: { title: 'Kis Uykusu', language: 'tr', original_title: 'Kış Uykusu', ids: { trakt: 2 } } }],
  labels: { dil: 'tr', unnamedMovie: 'x' },
});
T.ok('Film karti: Turkce ad', filmKart.watchlist[0]?.title === 'Kış Uykusu');

T.H('Bildirim');
const { mapCalendarToUpcoming } = tsLoader(root)('features/notifications/scheduling/mapCalendar.ts');
const takvim = [{ first_aired: '2026-11-05T20:00:00.000Z', episode: { season: 1, number: 1, ids: { trakt: 9 } }, show: { ...cekic, ids: { trakt: 1 } } }];
T.ok('Cozucu verilirse ekrandaki ad', mapCalendarToUpcoming(takvim, new Set(), [], (o) => gorunenBaslik(o, 'tr'))[0]?.showTitle === 'Çekiç ve Gül');
T.ok('Cozucu verilmezse ham ad (saf katman)', mapCalendarToUpcoming(takvim, new Set())[0]?.showTitle === 'The Hammer and the Rose');
const planlar = oku('features/notifications/scheduling/buildPlans.ts');
T.ok('Uc bildirim yolu da cozucuyu geciriyor', (planlar.match(/\badCoz\b/g) || []).length >= 4 && /gorunenBaslik\(oge, input\.language\)/.test(planlar));

T.H('Ekranlarda ham ad kalmadi');
const KLASORLER = ['app', 'components', 'screens', 'hooks', 'store/tracking', 'features/notifications', 'features/feed/components'];
// Yalnız adres (slug) üretimi ve yapım kendisi: ekrana yazılmaz.
const IZINLI = /renderCopy|generateMediaSlug|generateEpisodeSlug|item\.title \|\| item\.show\?\.title|\/\/ |^\s*\*|adCoz|Tip|: \{ title\?:/;
const ham = /\b(?:show|movie|media|showMeta|showData|movieData)\??\.title\b|\b(?:item|entry)\??\.(?:show|movie)\??\.title\b/;
const bulgular = [];
const gez = (d) => {
  for (const g of fs.readdirSync(path.join(root, d), { withFileTypes: true })) {
    const yol = `${d}/${g.name}`;
    if (g.isDirectory()) { if (g.name !== 'node_modules') gez(yol); continue; }
    if (!/\.tsx?$/.test(g.name)) continue;
    oku(yol).split('\n').forEach((satir, i) => {
      if (ham.test(satir) && !IZINLI.test(satir)) bulgular.push(`${yol}:${i + 1}: ${satir.trim().slice(0, 90)}`);
    });
  }
};
KLASORLER.forEach(gez);
T.ok('Ham yapim adi yalniz adres uretiminde', bulgular.length === 0, bulgular.join(' | '));
T.ok('Ham buyuk harf kalmadi', !/\.title \|\| t\('unnamed(Show|Movie)'\)\)\.toUpperCase/.test(oku('hooks/useDashboardData.ts') + oku('hooks/useMoviesDashboardData.ts')));
T.ok('Olu ceviri kaldirildi', !/applyTranslation/.test(oku('services/api/shows.ts') + oku('services/api/movies.ts') + oku('services/api/traktClient.ts')));
T.ok('Iki dilde etiket', /"originalTitleLabel": "Özgün ad: \{\{ad\}\}"/.test(oku('locales/tr/media.json')) && /"originalTitleLabel": "Original title: \{\{ad\}\}"/.test(oku('locales/en/media.json')));
T.ok('Akis kartina ekrandaki ad gider', /gorunenAd: gorunenBaslik\(media, i18n\.language\)/.test(oku('services/library/mutations/progress.ts')) && /showTitle: job\.media\.gorunenAd \|\| job\.media\.title/.test(oku('services/library/outbox/transport.ts')));
T.bitir();
