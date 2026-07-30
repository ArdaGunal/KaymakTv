import axios from 'axios';
import { getMyFollowingSlugs } from '../../../services/api/social';
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

// Feed doğası gereği "taze" olanı gösterir — docs/feed.md'de kararlaştırıldığı
// gibi son 30 gün + sabit bir sayfa boyutu. Daha eskisi bir kullanıcının
// profiline gidince (Phase 1.5) görülebilecek.
const FEED_WINDOW_DAYS = 30;
const PAGE_SIZE = 30;

interface FeedActivityRow {
  id: string;
  activity_type: FeedActivityType;
  show_id: number;
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

function mapRow(row: FeedActivityRow): FeedActivity {
  return {
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

export async function fetchFeedActivities(): Promise<FeedActivity[]> {
  const followingSlugs = await getMyFollowingSlugs();
  if (followingSlugs.length === 0) return [];

  const cutoff = new Date(Date.now() - FEED_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Trakt'ta takip ettiğim herkes KaymakTV'yi kullanmış olmayabilir — `!inner`
  // ile `users`e join edip `user.trakt_slug` üzerinden filtreliyoruz; karşılığı
  // olmayan slug'lar join'e hiç girmediğinden sorgu doğal olarak onları eler.
  // ESKİDEN: önce `users`den id'leri çekip SONRA `feed_activities`i o id'lerle
  // filtreleyen 2 AYRI, SIRALI istek vardı — bu, her yüklemede gereksiz bir
  // ağ round-trip'i ekliyordu. Tek sorguya indirildi (bkz. fetchUserFeedActivities'teki
  // aynı düzeltme, performans şikayeti üzerine).
  const { data, error } = await timeSupabaseCall('supabase.feed_activities.list', () =>
    supabase
      .from('feed_activities')
      .select('id, activity_type, show_id, show_title, show_poster_url, episode_number, rating, activity_at, user:users!inner(id, trakt_slug, username, avatar_url)')
      .in('user.trakt_slug', followingSlugs)
      .gte('activity_at', cutoff)
      .order('activity_at', { ascending: false })
      .limit(PAGE_SIZE)
  );

  if (error) throw error;
  return ((data ?? []) as unknown as FeedActivityRow[]).map(mapRow);
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
      .select('id, activity_type, show_id, show_title, show_poster_url, episode_number, rating, activity_at, user:users!inner(id, trakt_slug, username, avatar_url)')
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
