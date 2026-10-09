import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

// C2 · Detay sayfası (yayın) + yarım pencere (sistem kaydı).
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = yardimci.baslat('AKIS DETAY (C2)', { kokOneki: 'akis-detay-' });
const load = tsLoader(root, {
  'expo-router': { useRouter: () => ({}) },
  react: { useCallback: (f) => f, useState: (v) => [v, () => {}] },
  '../../../services/api/shows': { getEpisodeDetail: async () => ({}) },
});
const { isUserPublished } = load('features/feed/utils/activityKind.ts');
const { formatExactDate } = load('utils/formatExactDate.ts');
const { parseEpisodeCode } = load('features/feed/hooks/useOpenEpisode.ts');
const oku = (f) => fs.readFileSync(path.join(root, f), 'utf8');

// Ayrım — Worker yorum kapısıyla aynı kural (not VEYA puan).
T.ok('Gonderi = yayin', isUserPublished({ activityType: 'posted', note: 'x' }));
T.ok('Inceleme = yayin', isUserPublished({ activityType: 'reviewed', note: 'x' }));
T.ok('Yazisiz puan = yayin (kullanici karari)', isUserPublished({ activityType: 'rated', rating: 8 }));
T.ok('Alintili izleme = yayin', isUserPublished({ activityType: 'watched_episode', note: 'harika' }));
T.ok('Ciplak izleme = sistem', !isUserPublished({ activityType: 'watched_episode' }) && !isUserPublished({ activityType: 'completed_show', note: '' }));
const worker = path.join(root, '../kaymaktv-feedback-worker/src/routes/feedComment.js');
if (fs.existsSync(worker)) T.ok('Worker yorum kapisi hala not || puan', /if \(!activity\.note && activity\.rating == null\)/.test(fs.readFileSync(worker, 'utf8')));

// Tam tarih.
const simdi = new Date(2026, 9, 10, 12, 0);
const buYil = formatExactDate(new Date(2026, 9, 10, 9, 5).toISOString(), 'en', simdi);
T.ok(`Bu yil: gun ay · SS:DD, yil yok (${buYil})`, /· 09:05$/.test(buYil) && !/2026/.test(buYil));
T.ok('Gecmis yil yazilir', /2025/.test(formatExactDate(new Date(2025, 11, 3, 21, 14).toISOString(), 'tr', simdi)));
T.ok('Bozuk tarih bos', formatExactDate('x', 'tr') === '' && formatExactDate(undefined, 'tr') === '');

// Bölüm kodu.
T.ok('S01E24 cozulur', JSON.stringify(parseEpisodeCode('S01E24')) === '{"season":1,"episode":24}');
T.ok('Bozuk kod null (dizi sayfasina dusulur)', parseEpisodeCode('') === null && parseEpisodeCode('1x24') === null);

// Bağlantılar.
const kart = oku('features/feed/components/FeedCard.tsx');
const detay = oku('features/feed/components/detail/PublishedActivityDetail.tsx');
const bolum = oku('features/feed/hooks/useOpenEpisode.ts');
T.ok('Yorum ikonu -> detay, yorum kutusu odakli', /actions\.openDetail\(true\)/.test(kart) && /\?yorum=1/.test(oku('features/feed/hooks/useActivityActions.tsx')) && /focusComposer=\{yorum === '1'\}/.test(oku('app/activity/[id].tsx')));
T.ok('Eski alttan yorum penceresi kalkti', !fs.existsSync(path.join(root, 'features/feed/components/FeedCommentSheet.tsx')));
T.ok('Yazilmis yorumla cikis onay ister (Y16 korumasi tasindi)', /beforeRemove/.test(detay) && /confirmAsync/.test(detay));
T.ok('Bolume git: kimlik katalogdan cozulur, 0 ile ACILMAZ', /getEpisodeDetail/.test(bolum) && /if \(!epId\) return fallback\(\)/.test(bolum));
T.ok('Detay verisi once store (ag beklemez), begeni durumu ile tazelenir', /useFeedStore\(\(s\)/.test(oku('features/feed/hooks/useActivityDetail.ts')) && /withLikes: true/.test(oku('features/feed/hooks/useActivityDetail.ts')));
T.ok('Realtime yolu begeni sorgusu eklemez (A-4)', /withLikes\?: boolean/.test(oku('features/feed/services/feedApi.ts')) && !/fetchActivityById\([^)]*withLikes/.test(oku('features/feed/hooks/useFeedRealtime.ts')));
T.ok('Pencere her platformda ekranin ortasinda (kullanici duzeltmesi)', /justifyContent: 'center'/.test(oku('features/feed/components/detail/SystemActivitySheet.tsx')) && !/flex-end/.test(oku('features/feed/components/detail/SystemActivitySheet.tsx')));
T.bitir();
