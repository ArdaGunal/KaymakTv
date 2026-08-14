import axios from 'axios';
import { supabase } from './supabaseClient';
import { getMyTraktSlug } from '../../../services/api/myIdentity';
import { CACHE_TTL } from '../../../utils/cacheTTL';

// Kullanıcı Engelleme — KaymakTV'ye özel, Trakt'a hiç dokunmaz (bkz.
// docs/FEED_SOCIAL_PLAN.md §4). Okuma doğrudan Supabase'ten (anon key +
// RLS SELECT — diğer tüm sosyal tablolarla aynı "herkese açık oku,
// görünürlüğü client'ta filtrele" deseni, bkz. feedApi.ts); yazma
// (engelle/kaldır) Worker üzerinden (kimlik doğrulamalı, /feed/block).
const KAYMAK_WORKER_URL = process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL || '';

// ── Kendi Supabase users.id'im ──────────────────────────────────────────
// NOT: feedPublish.ts'teki `resolveMe().id` BU DEĞİL — orası yalnızca
// iyimser kart çizmek için `me-{slug}` sahte bir id kullanıyor.
// `user_blocks.blocker_id`'yi sorgulamak için GERÇEK Supabase uuid'i gerekir.
let myUserIdCache: { id: string | null; fetchedAt: number } | null = null;

export function invalidateMySupabaseUserId(): void {
  myUserIdCache = null;
}

export async function getMySupabaseUserId(): Promise<string | null> {
  if (myUserIdCache && Date.now() - myUserIdCache.fetchedAt < CACHE_TTL.SHORT) {
    return myUserIdCache.id;
  }
  const slug = await getMyTraktSlug();
  if (!slug) return null;
  const { data, error } = await supabase.from('users').select('id').eq('trakt_slug', slug).maybeSingle();
  if (error) throw error;
  const id = data?.id ?? null;
  myUserIdCache = { id, fetchedAt: Date.now() };
  return id;
}

// ── Engellenen/Engelleyen kümesi ────────────────────────────────────────
// Akış, yorumlar ve Realtime AYNI kümeyi paylaşmalı (bkz.
// docs/FEED_SOCIAL_PLAN.md §4.3) — "ben kimi engelledim" VEYA "beni kim
// engelledi" birleşimi, ikisi de görünürlükte aynı sonucu (karşılıklı
// görünmezlik) doğurur.
let blockedIdsCache: { ids: Set<string>; fetchedAt: number } | null = null;

export function invalidateBlockedUserIds(): void {
  blockedIdsCache = null;
}

export async function getBlockedUserIds(force = false): Promise<Set<string>> {
  if (!force && blockedIdsCache && Date.now() - blockedIdsCache.fetchedAt < CACHE_TTL.SHORT) {
    return blockedIdsCache.ids;
  }

  const myId = await getMySupabaseUserId();
  if (!myId) {
    const empty = new Set<string>();
    blockedIdsCache = { ids: empty, fetchedAt: Date.now() };
    return empty;
  }

  const [blockedByMeRes, blockingMeRes] = await Promise.all([
    supabase.from('user_blocks').select('blocked_id').eq('blocker_id', myId),
    supabase.from('user_blocks').select('blocker_id').eq('blocked_id', myId),
  ]);
  if (blockedByMeRes.error) throw blockedByMeRes.error;
  if (blockingMeRes.error) throw blockingMeRes.error;

  const ids = new Set<string>([
    ...((blockedByMeRes.data ?? []) as { blocked_id: string }[]).map((r) => r.blocked_id),
    ...((blockingMeRes.data ?? []) as { blocker_id: string }[]).map((r) => r.blocker_id),
  ]);
  blockedIdsCache = { ids, fetchedAt: Date.now() };
  return ids;
}

/** Bir Trakt slug'ından Supabase `users.id`'sini çözer — yalnızca o kullanıcı
 *  KaymakTV'yi en az bir kez kullanmışsa (sync/publish tetiklemişse) satırı
 *  vardır; yoksa null (engellenecek/görülecek bir şeyi de yok demektir). */
export async function getUserIdBySlug(traktSlug: string): Promise<string | null> {
  const { data, error } = await supabase.from('users').select('id').eq('trakt_slug', traktSlug).maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

/** Ben BU kişiyi engellemiş miyim (yönlü) — menüde "Engelle" mi "Engeli
 *  Kaldır" mı gösterileceğine karar vermek için. `getBlockedUserIds`'teki
 *  (yönsüz, "engelleyen VEYA engellenen") birleşimden FARKLI bir soru. */
export async function amIBlocking(myUserId: string, targetUserId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_blocks')
    .select('id')
    .eq('blocker_id', myUserId)
    .eq('blocked_id', targetUserId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export interface BlockedUser {
  id: string;
  traktSlug: string;
  username: string;
  avatarUrl: string | null;
  blockedAt: string;
}

// Ayarlar → "Engellenen Kullanıcılar" listesi — yalnızca BEN kimi
// engelledim gösterilir (beni engelleyenlerin listesi kasıtlı olarak
// gösterilmiyor, kullanıcıya "seni kim engelledi" bilgisini vermiyoruz).
export async function getMyBlockedUsers(): Promise<BlockedUser[]> {
  const myId = await getMySupabaseUserId();
  if (!myId) return [];

  // `users`e giden İKİ FK (blocker_id, blocked_id) var — PostgREST'e hangisi
  // olduğunu `!blocked_id` ile açıkça söylüyoruz, aksi halde "belirsiz ilişki"
  // hatası verir.
  const { data, error } = await supabase
    .from('user_blocks')
    .select('created_at, blocked:users!blocked_id(id, trakt_slug, username, avatar_url)')
    .eq('blocker_id', myId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  return ((data ?? []) as any[])
    .filter((row) => row.blocked)
    .map((row) => ({
      id: row.blocked.id,
      traktSlug: row.blocked.trakt_slug,
      username: row.blocked.username,
      avatarUrl: row.blocked.avatar_url,
      blockedAt: row.created_at,
    }));
}

export async function blockUser(traktAccessToken: string, blockedTraktSlug: string): Promise<void> {
  if (!KAYMAK_WORKER_URL) throw new Error('EXPO_PUBLIC_KAYMAK_WORKER_URL tanımlı değil.');
  const response = await axios.post(
    `${KAYMAK_WORKER_URL}/feed/block`,
    { traktAccessToken, blockedTraktSlug },
    { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
  );
  if (!response.data?.success) throw new Error(response.data?.message || 'İşlem başarısız.');
  invalidateBlockedUserIds();
}

export async function unblockUser(traktAccessToken: string, blockedTraktSlug: string): Promise<void> {
  if (!KAYMAK_WORKER_URL) throw new Error('EXPO_PUBLIC_KAYMAK_WORKER_URL tanımlı değil.');
  const response = await axios.post(
    `${KAYMAK_WORKER_URL}/feed/unblock`,
    { traktAccessToken, blockedTraktSlug },
    { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
  );
  if (!response.data?.success) throw new Error(response.data?.message || 'İşlem başarısız.');
  invalidateBlockedUserIds();
}
