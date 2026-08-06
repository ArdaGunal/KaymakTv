import axios from 'axios';
import { getFollowingSlugs } from '../../../store/followStore';
import { getMyTraktSlug } from '../../../services/api/myIdentity';
import { supabase } from './supabaseClient';
import { FeedActivity, FeedActivityType } from '../types';
import { CACHE_TTL } from '../../../utils/cacheTTL';
import { recordApiLatency, recordMutationResult } from '../../../utils/metrics';

// Supabase istekleri `services/api/traktClient.ts`'teki axios interceptor'ından
// GEÇMİYOR — o yalnızca Trakt trafiğini ölçer. Bu yüzden feed_activities
// sorguları performans raporunda görünmez kalıyordu. Aynı `api.latency.*`
// isim uzayını (bkz. traktClient.ts) manuel olarak burada da kullanıyoruz ki
// tek bir raporda hem Trakt hem Supabase/Worker gecikmeleri görülebilsin.
const timeSupabaseCall = async <T>(metricKey: string, fn: () => PromiseLike<T>): Promise<T> => {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    recordApiLatency(metricKey, Date.now() - start);
  }
};

// Aynı Cloudflare Worker'ın (kaymaktv-feedback-worker) /feed/delete uç
// noktası — bkz. feedSync.ts/feedPrivacy.ts. DOĞRUDAN client'tan Supabase'e
// DELETE atILMAZ: bu proje Supabase Auth kullanmıyor, `supabase` client'ı
// (supabaseClient.ts) yalnızca anon key + SELECT-only RLS ile okuma yapar.
// Silme, Worker'ın Trakt token'ını doğrulayıp service_role ile yaptığı bir
// yazma işlemidir.
const KAYMAK_WORKER_URL = process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL || '';

// Feed doğası gereği "taze" olanı gösterir — son 30 günlük pencere.
// Daha eskisi bir kullanıcının profiline gidince görülebilir.
const FEED_WINDOW_DAYS = 30;
// Sayfa başına kayıt. ESKİDEN 30'du ve TEK SEFERLİK bir tavandı (sayfalama
// yoktu — 30. kayıttan sonrasına ulaşmanın hiçbir yolu yoktu). Artık sonsuz
// kaydırmanın sayfa boyutu: ilk ekranı hızlı doldururken her ek isteği de
// küçük tutan bir denge.
const PAGE_SIZE = 15;

/**
 * BİLEŞİK (keyset) sayfalama imleci.
 *
 * ⚠️ NEDEN SADECE `activity_at` YETMEZ: toplu sezon işaretlemesinde TÜM
 * bölümler AYNI damgayı alır — client, Trakt'a tek bir `watched_at` gönderip
 * aynısını Akış'a yayınlıyor (dedup hizalaması için bilinçli, bkz.
 * services/api/users.ts). Yani `activity_at` UNIQUE DEĞİL.
 *
 * Bu durumda basit `.lt('activity_at', son)` imleci, sayfa sınırı bir damga
 * grubunun ORTASINA denk geldiğinde grubun kalan satırlarını ATLAR — akışta
 * sessiz veri kaybı. `.lte` kullanmak ise grup sayfa boyutundan büyükse
 * (40 bölümlük sezon) aynı sayfayı sonsuza dek döndürür.
 *
 * ÇÖZÜM: `(activity_at, id)` ikilisiyle sıralama ve imleç. `id` (uuid)
 * benzersiz olduğundan toplam sıralama kesin ve deterministiktir.
 */
export interface FeedCursor {
  activityAt: string;
  id: string;
}

export interface FeedPage {
  items: FeedActivity[];
  /** Bir sonraki sayfa için imleç; `hasMore` false ise null. */
  nextCursor: FeedCursor | null;
  hasMore: boolean;
}

// Supabase'den seçilen kolonlar — TEK yerde tanımlı ki `fetchFeedActivities`,
// `fetchUserFeedActivities` ve Realtime'ın satır tamamlama sorgusu birbirinden
// sapmasın (biri `tmdb_id` seçmeyi unutursa o kartta poster kaybolurdu).
const ACTIVITY_COLUMNS =
  'id, activity_type, show_id, media_type, tmdb_id, show_title, show_poster_url, episode_number, rating, activity_at, user:users!inner(id, trakt_slug, username, avatar_url)';

export interface FeedActivityRow {
  id: string;
  activity_type: FeedActivityType;
  show_id: number;
  media_type: 'show' | 'movie' | null;
  tmdb_id: number | null;
  show_title: string;
  show_poster_url: string | null;
  episode_number: string | null;
  rating: number | null;
  activity_at: string;
  user: {
    id: string;
    trakt_slug: string;
    username: string;
    avatar_url: string | null;
  };
}

export function mapRow(row: FeedActivityRow): FeedActivity {
  return {
    // `media_type` 013 migration'ından ÖNCEKİ satırlarda yok — 'show'a düşmek
    // güvenli varsayılan (o dönemde film izleme aktivitesi hiç yazılmıyordu).
    mediaType: row.media_type === 'movie' ? 'movie' : 'show',
    tmdbId: row.tmdb_id ?? undefined,
    id: row.id,
    user: {
      id: row.user.id,
      traktSlug: row.user.trakt_slug,
      username: row.user.username,
      avatarUrl: row.user.avatar_url,
    },
    activityType: row.activity_type,
    showId: row.show_id,
    showTitle: row.show_title,
    showPosterUrl: row.show_poster_url,
    episodeNumber: row.episode_number ?? undefined,
    rating: row.rating ?? undefined,
    activityAt: row.activity_at,
  };
}

// İLK SAYFA için kısa ömürlü önbellek. Neden gerekli: Akış sekmesi her
// yeniden mount olduğunda (sekmeler arası geçiş, geri/ileri gezinme) sıfırdan
// yükleniyor, kullanıcı boş bir skeleton görüyordu. `refresh` (pull-to-refresh)
// `force: true` ile bunu bilinçli olarak atlar.
//
// YALNIZCA İLK SAYFA önbelleklenir: sonraki sayfalar imlece bağlıdır ve
// kullanıcı zaten kaydırarak bir kez istemiştir; onları da önbelleklemek
// bellekte anlamsız bir sayfa haritası tutmak olurdu.
let feedCache: { page: FeedPage; fetchedAt: number } | null = null;

/** Kendi aktivitem değişince (ör. senkron/yayın sonrası) bayat kalmasın diye. */
export function invalidateFeedCache(): void {
  feedCache = null;
}

/**
 * Akışın tek sayfasını çeker.
 *
 * @param cursor `null`/verilmezse ilk sayfa. Sonraki sayfalar için önceki
 *   sayfanın `nextCursor`ı geçilir.
 * @param force İlk sayfa önbelleğini atla (pull-to-refresh).
 */
export async function fetchFeedActivities(
  cursor: FeedCursor | null = null,
  force = false
): Promise<FeedPage> {
  const isFirstPage = cursor === null;

  if (isFirstPage && !force && feedCache && Date.now() - feedCache.fetchedAt < CACHE_TTL.SHORT) {
    return feedCache.page;
  }

  // Görünür kullanıcıların Supabase `users.id` kümesi — takip ettiklerim + BEN.
  // ESKİDEN burada `user.trakt_slug` üzerinden `!inner` join filtresi vardı;
  // artık doğrudan `user_id` ile filtreliyoruz çünkü:
  //   1. `idx_feed_activities_user_time (user_id, activity_at DESC)` indeksi
  //      TAM OLARAK bu sorgu için var — join'li slug filtresi onu kullanamıyordu.
  //   2. Uzun takip listelerinde URL'e slug yerine uuid yazmak daha öngörülebilir.
  // Küme kısa ömürlü olarak önbelleklenir (bkz. getVisibleUserIds), böylece her
  // sayfa için ek bir `users` sorgusu atılmaz.
  const userIds = Array.from(await getVisibleUserIds());

  // Hiç kimse yoksa (yeni kullanıcı, kimseyi takip etmiyor ve kendi kaydı da
  // henüz oluşmamış) sorgu hiç atılmaz.
  if (userIds.length === 0) {
    const empty: FeedPage = { items: [], nextCursor: null, hasMore: false };
    if (isFirstPage) feedCache = { page: empty, fetchedAt: Date.now() };
    return empty;
  }

  const cutoff = new Date(Date.now() - FEED_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from('feed_activities')
    .select(ACTIVITY_COLUMNS)
    .in('user_id', userIds)
    .gte('activity_at', cutoff)
    // İKİ SEVİYELİ SIRALAMA imlecin sözleşmesi: `activity_at` benzersiz
    // olmadığı için (toplu sezon işaretlemesi) `id` toplam sıralamayı kesin
    // hale getirir. Aşağıdaki `.or(...)` filtresi bu sıralamayla BİREBİR
    // uyumlu olmak zorunda, aksi halde sayfa sınırlarında kayıt atlanır.
    .order('activity_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE_SIZE);

  if (cursor) {
    // Keyset koşulu: (activity_at, id) < (cursor.activityAt, cursor.id)
    //   activity_at < X   VEYA   (activity_at = X VE id < Y)
    //
    // Damga `toISOString()` ile normalize ediliyor: Postgres'ten "+00:00"
    // ekiyle dönebiliyor ve `+` karakteri PostgREST'in `or=` ifadesinde
    // URL kodlamasına takılabilirdi. "Z" biçiminde bu risk yok.
    // Değerler çift tırnak içinde — `:` ve `-` gibi karakterlerin ayrıştırıcı
    // tarafından yorumlanmasını engeller.
    const ts = new Date(cursor.activityAt).toISOString();
    query = query.or(
      `activity_at.lt."${ts}",and(activity_at.eq."${ts}",id.lt."${cursor.id}")`
    );
  }

  const { data, error } = await timeSupabaseCall('supabase.feed_activities.list', () => query);

  if (error) throw error;

  const rows = (data ?? []) as unknown as FeedActivityRow[];
  const items = rows.map(mapRow);

  // `hasMore`: tam sayfa döndüyse muhtemelen devamı var. Son sayfa tam
  // dolduğunda bir sonraki istek boş dönüp `hasMore`u kapatır — bir fazladan
  // istek pahasına, "devamı var mı" için ekstra bir COUNT sorgusundan kaçınmış
  // oluyoruz (count her sayfada tüm tabloyu taratırdı).
  const hasMore = rows.length === PAGE_SIZE;
  const last = rows[rows.length - 1];
  const page: FeedPage = {
    items,
    hasMore,
    nextCursor: hasMore && last ? { activityAt: last.activity_at, id: last.id } : null,
  };

  if (isFirstPage) feedCache = { page, fetchedAt: Date.now() };
  return page;
}

/**
 * Akışta aktivitesini görebileceğim kullanıcıların Supabase `users.id`
 * kümesi — takip ettiklerim + ben.
 *
 * Realtime için ŞART: gelen INSERT olayı yalnızca `feed_activities` satırını
 * taşır (`user_id` var, kullanıcı adı/slug YOK). Her olayda "bu kişiyi takip
 * ediyor muyum" diye sorgu atmak yerine kümeyi bir kez çözüp bellekte
 * tutuyoruz — eleme tek bir `Set.has()` çağrısı oluyor.
 */
// Kısa ömürlü önbellek: sonsuz kaydırmada HER sayfa bu kümeye ihtiyaç duyar;
// önbelleksiz her sayfa için fazladan bir `users` sorgusu atılırdı. Takip
// listesi zaten `followStore`'un kendi TTL'iyle yönetiliyor, buradaki 60 sn
// yalnızca slug→uuid çevirisini tekrarlamamak için.
let visibleUserIdsCache: { ids: Set<string>; fetchedAt: number } | null = null;

/** Takip/çıkış sonrası küme bayat kalmasın diye. */
export function invalidateVisibleUserIds(): void {
  visibleUserIdsCache = null;
}

export async function getVisibleUserIds(force = false): Promise<Set<string>> {
  if (!force && visibleUserIdsCache && Date.now() - visibleUserIdsCache.fetchedAt < CACHE_TTL.SHORT) {
    return visibleUserIdsCache.ids;
  }

  // Kendi slug'ım BİLİNÇLİ OLARAK dahil — kullanıcı kendi aktivitelerini de
  // akışta görür (bkz. docs/HISTORY.md Madde 142). Takip ettiklerim + ben.
  const [followingSlugs, mySlug] = await Promise.all([getFollowingSlugs(), getMyTraktSlug()]);
  const slugs = Array.from(new Set(mySlug ? [...followingSlugs, mySlug] : followingSlugs));
  if (slugs.length === 0) {
    const empty = new Set<string>();
    visibleUserIdsCache = { ids: empty, fetchedAt: Date.now() };
    return empty;
  }

  const { data, error } = await timeSupabaseCall('supabase.users.visibleIds', () =>
    supabase.from('users').select('id').in('trakt_slug', slugs)
  );
  if (error) throw error;
  const ids = new Set(((data ?? []) as { id: string }[]).map((row) => row.id));
  visibleUserIdsCache = { ids, fetchedAt: Date.now() };
  return ids;
}

/**
 * Tek bir aktiviteyi kullanıcı bilgisiyle birlikte çeker.
 * Realtime yükü `users` join'ini içermediği için (kart çizmek adı/avatarı
 * gerektirir) yeni satır geldiğinde bu tek sorgu atılır — yalnızca takip
 * ettiğim biri bir şey yaptığında, yani nadiren.
 */
export async function fetchActivityById(id: string): Promise<FeedActivity | null> {
  const { data, error } = await timeSupabaseCall('supabase.feed_activities.byId', () =>
    supabase.from('feed_activities').select(ACTIVITY_COLUMNS).eq('id', id).maybeSingle()
  );
  if (error) throw error;
  return data ? mapRow(data as unknown as FeedActivityRow) : null;
}

const PROFILE_ACTIVITY_LIMIT = 20;

// Profildeki "Aktiviteler" sekmesi (kendi profilim VEYA Public Profile — bkz.
// features/publicProfile/hooks/usePublicProfileActivity.ts, ikisi de bu
// fonksiyonu paylaşır) kısa süre içinde tekrar tekrar mount/unmount edilebilir
// (sekmeler arası geçiş, geri/ileri gezinme) — her seferinde 2 sıralı Supabase
// isteğiyle baştan yüklenmesi "aktiviteler bölümü geç geliyor" şikayetinin
// ana kaynağıydı. `services/api/shows.ts`'teki `trendingShowsCache` ile AYNI
// desen: kısa ömürlü (CACHE_TTL.SHORT = 60sn) bellek-içi önbellek — aynı
// slug'a tekrar bakıldığında ağ isteği ATLANIR, veri anında görünür.
const userFeedActivitiesCache = new Map<string, { data: FeedActivity[]; fetchedAt: number }>();

/** Silme (bkz. useUserActivity.ts) sonrası önbelleğin bayat kalmaması için. */
export function invalidateUserFeedActivitiesCache(traktSlug: string): void {
  userFeedActivitiesCache.delete(traktSlug);
}

// Takip ettiklerim değil, TEK bir kullanıcının TÜM izleme aktivitesi, tarih
// penceresi olmadan (profilde "son 30 gün" kısıtı anlamlı değil).
export async function fetchUserFeedActivities(traktSlug: string, force = false): Promise<FeedActivity[]> {
  const cached = userFeedActivitiesCache.get(traktSlug);
  if (!force && cached && Date.now() - cached.fetchedAt < CACHE_TTL.SHORT) {
    return cached.data;
  }

  // ESKİDEN: önce `users`den `id` çekip SONRA `feed_activities`i o id'yle
  // filtreleyen 2 SIRALI istek vardı (2× ağ round-trip'i). `!inner` join +
  // `user.trakt_slug` filtresiyle TEK isteğe indirildi — eşleşen `users`
  // satırı yoksa join hiç satır döndürmediğinden sonuç zaten doğal olarak
  // boş dizi olur, ayrı bir "bulunamadı" dalına gerek kalmadı.
  const { data, error } = await timeSupabaseCall('supabase.feed_activities.byUser', () =>
    supabase
      .from('feed_activities')
      .select(ACTIVITY_COLUMNS)
      .eq('user.trakt_slug', traktSlug)
      .order('activity_at', { ascending: false })
      .limit(PROFILE_ACTIVITY_LIMIT)
  );

  if (error) throw error;
  const mapped = ((data ?? []) as unknown as FeedActivityRow[]).map(mapRow);
  userFeedActivitiesCache.set(traktSlug, { data: mapped, fetchedAt: Date.now() });
  return mapped;
}

// ── Aktivite Silme (Hard Delete) ────────────────────────────────────────────
// Profil › Aktiviteler sekmesinde kullanıcının kendi aktivitelerini kalıcı
// olarak silmesi. Worker, id'leri `user_id = doğrulanan kullanıcı` şartıyla
// siler — bu yüzden başka bir kullanıcının id'si gönderilse bile hiçbir şey
// silinmez (bkz. kaymaktv-feedback-worker/src/index.js handleFeedDelete).
export async function deleteActivitiesBulk(
  traktAccessToken: string,
  activityIds: string[]
): Promise<void> {
  if (activityIds.length === 0) return;
  if (!KAYMAK_WORKER_URL) throw new Error('EXPO_PUBLIC_KAYMAK_WORKER_URL tanımlı değil.');

  const start = Date.now();
  try {
    const response = await axios.post(
      `${KAYMAK_WORKER_URL}/feed/delete`,
      { traktAccessToken, activityIds },
      { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
    );
    if (!response.data?.success) {
      throw new Error(response.data?.message || 'İşlem başarısız.');
    }
    // Silinen satırlar kendi aktivitelerim olduğundan Akış'ta da görünüyorlar
    // (bkz. fetchFeedActivities — kendi slug'ım artık sorguya dahil). Burada,
    // TEK bir yerde geçersiz kılmak, her çağıranın bunu ayrıca hatırlamak
    // zorunda kalmasını önler.
    invalidateFeedCache();
    recordMutationResult('deleteFeedActivities', true);
  } catch (error) {
    recordMutationResult('deleteFeedActivities', false);
    throw error;
  } finally {
    recordApiLatency('worker.feed.delete', Date.now() - start);
  }
}

// Tekil silme, toplu uç noktanın tek elemanlı bir çağrısıdır — Worker'da
// ayrı bir kod yolu yok, tutarlılık için tek bir uç nokta yeterli.
export async function deleteActivity(traktAccessToken: string, activityId: string): Promise<void> {
  return deleteActivitiesBulk(traktAccessToken, [activityId]);
}
