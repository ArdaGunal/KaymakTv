import axios from 'axios';
import { getMyFollowingSlugs } from '../../../services/api/social';
import { supabase } from './supabaseClient';
import { FeedActivity, FeedActivityType } from '../types';

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

  // Trakt'ta takip ettiğim herkes KaymakTV'yi kullanmış olmayabilir — yalnızca
  // bizim `users` tablomuzda (en az bir kez senkronize olmuş) karşılığı
  // olanları filtreliyoruz. Karşılığı olmayanlar için zaten `feed_activities`
  // hiç yok, sorgu doğal olarak boş döner.
  const { data: usersData, error: usersError } = await supabase
    .from('users')
    .select('id')
    .in('trakt_slug', followingSlugs);
  if (usersError) throw usersError;

  const followingIds = (usersData ?? []).map((row) => row.id);
  if (followingIds.length === 0) return [];

  const cutoff = new Date(Date.now() - FEED_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('feed_activities')
    .select('id, activity_type, show_id, show_title, show_poster_url, episode_number, rating, activity_at, user:users(id, trakt_slug, username, avatar_url)')
    .in('user_id', followingIds)
    .gte('activity_at', cutoff)
    .order('activity_at', { ascending: false })
    .limit(PAGE_SIZE);

  if (error) throw error;
  return ((data ?? []) as unknown as FeedActivityRow[]).map(mapRow);
}

const PROFILE_ACTIVITY_LIMIT = 20;

// Profil ekranındaki "Aktiviteler" sekmesi için — takip ettiklerim değil,
// TEK bir kullanıcının (kendimin) tüm izleme aktivitesi, tarih penceresi
// olmadan (profilde "son 30 gün" kısıtı anlamlı değil).
export async function fetchUserFeedActivities(traktSlug: string): Promise<FeedActivity[]> {
  const { data: userRow, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('trakt_slug', traktSlug)
    .maybeSingle();
  if (userError) throw userError;
  if (!userRow) return [];

  const { data, error } = await supabase
    .from('feed_activities')
    .select('id, activity_type, show_id, show_title, show_poster_url, episode_number, rating, activity_at, user:users(id, trakt_slug, username, avatar_url)')
    .eq('user_id', userRow.id)
    .order('activity_at', { ascending: false })
    .limit(PROFILE_ACTIVITY_LIMIT);

  if (error) throw error;
  return ((data ?? []) as unknown as FeedActivityRow[]).map(mapRow);
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

  const response = await axios.post(
    `${KAYMAK_WORKER_URL}/feed/delete`,
    { traktAccessToken, activityIds },
    { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
  );
  if (!response.data?.success) {
    throw new Error(response.data?.message || 'İşlem başarısız.');
  }
}

// Tekil silme, toplu uç noktanın tek elemanlı bir çağrısıdır — Worker'da
// ayrı bir kod yolu yok, tutarlılık için tek bir uç nokta yeterli.
export async function deleteActivity(traktAccessToken: string, activityId: string): Promise<void> {
  return deleteActivitiesBulk(traktAccessToken, [activityId]);
}
