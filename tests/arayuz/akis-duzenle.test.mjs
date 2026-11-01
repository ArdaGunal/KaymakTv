import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

// C3 / M477 · Düzenle/sil (yalnız bugün var olan yollar) + puan güncellemesinde asılı kart.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const T = yardimci.baslat('AKIS DUZENLE / SIL (C3 / M477)', { kokOneki: 'akis-duzenle-' });
const oku = (f) => fs.readFileSync(path.join(root, f), 'utf8');

// ── Davranış: publishActivities puan güncellemesinde geçici kart EKLEMEZ ──
let cevap = { data: { success: true, published: 1 } };
let gonderilen = null;
const load = tsLoader(root, {
  zustand: require('zustand'),
  axios: { default: { post: async (_u, body) => { gonderilen = body; if (cevap instanceof Error) throw cevap; return cevap; } } },
  '../../../utils/secureStorage': { getItemAsync: async (k) => (k === 'traktAccessToken' ? 'kaymak_session_v1.x' : k === 'kaymakMyUsername' ? 'Test' : null), setItemAsync: async () => {} },
  '../../../services/api/auth': { refreshTraktToken: async () => ({}) },
  '../../../services/api/myIdentity': { getMyTraktSlug: async () => null },
  '../../../services/api/traktClient': { isKaymakSessionToken: (t) => typeof t === 'string' && t.startsWith('kaymak_session_v1.') },
  '../../../services/api/social': { getUserProfile: async () => null },
  './userBlocks': { getMySupabaseUserId: async () => 'ben' },
  './feedApi': { invalidateFeedCache: () => {}, invalidateUserFeedActivitiesCache: () => {}, fetchActivityById: async () => null },
  '../../../utils/metrics': { recordApiLatency: () => {}, recordMutationResult: () => {} },
  '../../../utils/errorLog': { logError: () => {} },
});
const { useFeedStore } = load('features/feed/store/feedStore.ts');
const { publishActivities } = load('features/feed/services/feedPublish.ts');
const st = useFeedStore.getState;
const kart = (id, ek) => ({ id, user: { id: 'ben' }, activityType: 'rated', showId: 7, mediaType: 'movie', rating: 6, activityAt: '2026-10-01T10:00:00.000Z', likeCount: 0, commentCount: 0, ...ek });
const yayin = (rating) => ({ activityType: 'rated', showId: 7, mediaType: 'movie', showTitle: 'Dune', rating, activityAt: new Date().toISOString() });

st().setFirstPage({ items: [kart('gercek-puan')], hasMore: false, nextCursor: null });
await publishActivities([yayin(10)]);
T.ok('Var olan kendi puan kartim yerinde guncellendi (6 -> 10)', st().activities.find((a) => a.id === 'gercek-puan').rating === 10);
T.ok('Gecici («gonderiliyor») kart EKLENMEDI', !st().activities.some((a) => a.isPending || a.id.startsWith('temp-')) && st().activities.length === 1);
T.ok('Sunucuya yine de yayinlandi', gonderilen?.activities?.[0]?.rating === 10);

cevap = new Error('ag yok');
await publishActivities([yayin(4)]);
T.ok('Hata olursa yerinde guncelleme GERI alinir (10 kalir, 4 degil)', st().activities.find((a) => a.id === 'gercek-puan').rating === 10);

cevap = { data: { success: true, published: 1 } };
st().setFirstPage({ items: [kart('baskasinin', { user: { id: 'baska' } })], hasMore: false, nextCursor: null });
await publishActivities([yayin(8)]);
T.ok('Baskasinin ayni yapimdaki puan karti DEGISMEZ', st().activities.find((a) => a.id === 'baskasinin').rating === 6);
T.ok('Kendi karti akista yoksa yeni puan icin gecici kart eklenir (INSERT yankisi yerlestirir)', st().activities.some((a) => a.id.startsWith('temp-rated-7')));

// ── Kaynak: yalnız sahibi, aynı mutasyon yolu, yorum silme metni ──
const puan = oku('features/feed/hooks/useOwnRatingEdit.tsx');
T.ok('Puan duzenleyici YALNIZ sahibine (isOwnActivity) ve yalniz puan kartinda', /actions\.isOwnActivity &&\s*!isGuest &&\s*activity\.activityType === 'rated'/.test(puan) && /canEditRating \? \(/.test(puan));
T.ok('Dizi/film sayfasiyla AYNI yol: setLocalRating+rateMedia / removeLocalRating+unrateMedia', /setLocalRating\(id, tur, val\)[\s\S]*rateMedia\(id, tur, val, \{/.test(puan) && /removeLocalRating\(id, tur\)[\s\S]*unrateMedia\(id, tur\)/.test(puan));
T.ok('Hata olursa kutuphane ve kart geri alinir', /setLocalRating\(id, tur, onceki\)[\s\S]{0,60}actions\.patch\(\{ rating: onceki \}\)/.test(puan));
const detay = oku('features/feed/components/detail/PublishedActivityDetail.tsx');
T.ok('Detayda Sil yalniz sahibine; silinince sayfadan cikar', /onDelete: actions\.isOwnActivity/.test(detay) && /if \(await actions\.deleteOwn\(\)\) geri\(\)/.test(detay));
T.ok('Yildizlar yalniz sahibine dokunulabilir', /onPressRating=\{puan\.canEditRating \? puan\.openRatingEditor : undefined\}/.test(detay));
const eylem = oku('features/feed/hooks/useActivityActions.tsx');
T.ok('Silme: profil + akis + inceleme onbellegi tazelenir, hata olursa kart geri gelir', /invalidateUserFeedActivitiesCache\(\)/.test(eylem) && /invalidateMediaReviewsCache/.test(eylem) && /upsertActivity\(a, false\)/.test(eylem));
T.ok('Yorum silme onayi kendi metniyle (DIL-02)', /commentDeleteConfirmTitle/.test(oku('features/feed/components/FeedCommentItem.tsx')) && /deleteConfirm\?\.title \?\?/.test(oku('features/feed/components/CardMenu.tsx')));
T.ok('Realtime UPDATE puani yamaliyor ve gecici puan kartini yerlestiriyor', /rating: row\.rating/.test(oku('features/feed/hooks/useFeedRealtime.ts')) && /activityType: 'rated',\s*showId: row\.show_id/.test(oku('features/feed/hooks/useFeedRealtime.ts')));
const puanMut = oku('services/library/mutations/ratings.ts');
T.ok('Kutuphanede olmayan yapim puaninda da akisa yayin (baslik ipucu, M477)', /kutuphane\.title \|\| ipucu\?\.title/.test(puanMut)
  && /rateMedia\(traktIdNum, 'show', rating, medya\)/.test(oku('hooks/useShowDetailHandlers.ts'))
  && /rateMedia\(traktIdNum, 'movie', rating, \{/.test(oku('app/movie/[id].tsx'))
  && /medya: \{ title: showData\?\.title/.test(oku('app/show/[id].tsx')));
T.bitir();
