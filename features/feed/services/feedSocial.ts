import axios from 'axios';
import { supabase } from './supabaseClient';

// Akış Sosyal Katmanı — Kişisel Not/Alıntı, Yorum, Beğeni. bkz.
// docs/design/FEED_SOCIAL_PLAN.md. Okuma doğrudan Supabase'ten (anon key + RLS
// SELECT-only, diğer feed tablolarıyla AYNI desen); yazma Worker üzerinden
// (kimlik doğrulamalı + blok kontrolü, bkz. kaymaktv-feedback-worker).
const KAYMAK_WORKER_URL = process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL || '';

export interface FeedComment {
  id: string;
  activityId: string;
  userId: string;
  traktSlug: string;
  username: string;
  avatarUrl: string | null;
  body: string;
  spoiler: boolean;
  likeCount: number;
  createdAt: string;
}

const COMMENT_COLUMNS =
  'id, activity_id, body, spoiler, like_count, created_at, user:users!inner(id, trakt_slug, username, avatar_url)';

interface CommentRow {
  id: string;
  activity_id: string;
  body: string;
  spoiler: boolean;
  like_count: number;
  created_at: string;
  user: { id: string; trakt_slug: string; username: string; avatar_url: string | null };
}

function mapCommentRow(row: CommentRow): FeedComment {
  return {
    id: row.id,
    activityId: row.activity_id,
    userId: row.user.id,
    traktSlug: row.user.trakt_slug,
    username: row.user.username,
    avatarUrl: row.user.avatar_url,
    body: row.body,
    spoiler: row.spoiler,
    likeCount: row.like_count,
    createdAt: row.created_at,
  };
}

/** Bir aktivitenin yorumları, eskiden yeniye (Trakt'ın kendi yorum sistemiyle
 *  KARIŞTIRILMASIN — bu tamamen ayrı, KaymakTV'nin kendi Supabase'inde). */
export async function fetchComments(activityId: string): Promise<FeedComment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select(COMMENT_COLUMNS)
    .eq('activity_id', activityId)
    // ⚠️ OTOMATİK GİZLEME (024). `is_visible` TÜRETİLMİŞ bir kolon
    // (`report_count < 3`) — elle yönetilmiyor, senkron dışı kalamaz.
    // Akış tarafındaki `.eq('in_feed', true)` ile aynı rol; isimlendirme de
    // bilinçli olarak aynı yönde (pozitif), ters isim F14'teki "iki zıt yön"
    // karışıklığını tekrarlardı.
    //
    // 🔴 SERT BAĞIMLILIK: `024` çalıştırılmamış bir ortamda bu filtre
    // "kolon yok" hatası verir ve YORUMLARIN TAMAMI kırılır (`020`'deki
    // `in_feed` ile aynı sınıf bağımlılık).
    .eq('is_visible', true)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as CommentRow[]).map(mapCommentRow);
}

/** null/boş `note` → notu kaldırır. Yalnızca kendi aktivitende çalışır
 *  (Worker sahiplik kontrolü yapar). */
export async function setActivityNote(
  traktAccessToken: string,
  activityId: string,
  note: string | null,
  noteSpoiler: boolean
): Promise<{ note: string | null; noteSpoiler: boolean }> {
  if (!KAYMAK_WORKER_URL) throw new Error('EXPO_PUBLIC_KAYMAK_WORKER_URL tanımlı değil.');
  const response = await axios.post(
    `${KAYMAK_WORKER_URL}/feed/note`,
    { traktAccessToken, activityId, note, noteSpoiler },
    { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
  );
  if (!response.data?.success) throw new Error(response.data?.message || 'İşlem başarısız.');
  return { note: response.data.note, noteSpoiler: response.data.noteSpoiler };
}

/** Yalnızca kişisel not eklenmiş ya da puanlanmış aktivitelere yorum
 *  yapılabilir — Worker bu kuralı da doğrular, burası erken/anlaşılır hata
 *  için (bkz. docs/design/FEED_SOCIAL_PLAN.md). */
export async function addComment(
  traktAccessToken: string,
  activityId: string,
  body: string,
  spoiler: boolean
): Promise<{ id: string; createdAt: string }> {
  if (!KAYMAK_WORKER_URL) throw new Error('EXPO_PUBLIC_KAYMAK_WORKER_URL tanımlı değil.');
  const response = await axios.post(
    `${KAYMAK_WORKER_URL}/feed/comment`,
    { traktAccessToken, activityId, body, spoiler },
    { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
  );
  if (!response.data?.success) throw new Error(response.data?.message || 'İşlem başarısız.');
  return response.data.comment;
}

export async function deleteComment(traktAccessToken: string, commentId: string): Promise<void> {
  if (!KAYMAK_WORKER_URL) throw new Error('EXPO_PUBLIC_KAYMAK_WORKER_URL tanımlı değil.');
  const response = await axios.post(
    `${KAYMAK_WORKER_URL}/feed/comment/delete`,
    { traktAccessToken, commentId },
    { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
  );
  if (!response.data?.success) throw new Error(response.data?.message || 'İşlem başarısız.');
}

export type LikeTargetType = 'activity' | 'comment';

/** Beğen/beğenmeyi geri al — toggle. Worker idempotent (çift tıklama
 *  no-op'tur, hata dönmez). */
export async function setLike(
  traktAccessToken: string,
  targetType: LikeTargetType,
  targetId: string,
  like: boolean
): Promise<void> {
  if (!KAYMAK_WORKER_URL) throw new Error('EXPO_PUBLIC_KAYMAK_WORKER_URL tanımlı değil.');
  const response = await axios.post(
    `${KAYMAK_WORKER_URL}/feed/like`,
    { traktAccessToken, targetType, targetId, like },
    { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
  );
  if (!response.data?.success) throw new Error(response.data?.message || 'İşlem başarısız.');
}

// ── "Ben beğendim mi" kümeleri ──────────────────────────────────────────
// Bu proje Supabase Auth kullanmıyor, RLS auth.uid() veremiyor — "hangi
// kartları BEN beğenmişim" bilgisi client'ın kendi user_id'siyle ayrı bir
// sorguyla çekilir (getVisibleUserIds ile AYNI mantık). `targetIds` verilirse
// sorgu o kümeyle sınırlanır — kullanıcının TÜM beğeni geçmişini çekmek
// yerine yalnızca ekrandaki kartlar/yorumlar sorgulanır.
export async function getMyLikedActivityIds(myUserId: string, activityIds?: string[]): Promise<Set<string>> {
  let query = supabase.from('feed_activity_likes').select('activity_id').eq('user_id', myUserId);
  if (activityIds && activityIds.length > 0) query = query.in('activity_id', activityIds);
  const { data, error } = await query;
  if (error) throw error;
  return new Set(((data ?? []) as { activity_id: string }[]).map((r) => r.activity_id));
}

export async function getMyLikedCommentIds(myUserId: string, commentIds?: string[]): Promise<Set<string>> {
  let query = supabase.from('feed_comment_likes').select('comment_id').eq('user_id', myUserId);
  if (commentIds && commentIds.length > 0) query = query.in('comment_id', commentIds);
  const { data, error } = await query;
  if (error) throw error;
  return new Set(((data ?? []) as { comment_id: string }[]).map((r) => r.comment_id));
}
