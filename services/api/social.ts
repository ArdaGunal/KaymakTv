import axios from 'axios';
import { getTraktClient } from './traktClient';
import * as SecureStore from '../../utils/secureStorage';

// Trakt'ın kendi sosyal grafiği (Follow/Following) — bkz. docs/feed.md
// "Mimari Pivot". KaymakTV kendi takip tablosunu tutmuyor, tüm takip
// ilişkisi doğrudan Trakt API'sinden okunup yazılıyor. Bu uç noktaların
// hepsi kullanıcının KENDİ token'ıyla çağrılıyor — Trakt zaten "bu isteği
// kim yapıyor" sorusunu kendi OAuth'uyla cevapladığı için ayrı bir kimlik
// doğrulama katmanına (Worker vb.) hiç gerek yok.

// `/users/:id/follow` (POST/DELETE), `/users/hidden/*` ile AYNI aile davranışını
// gösteriyor: tarayıcıdan doğrudan `getTraktClient()` ile çağrıldığında Trakt
// CORS preflight'ını reddediyor (bkz. docs/HISTORY.md Madde 109 ve "takip
// isteği gitmiyor" bug raporu — hata `useFollowState`'te sessizce yutulup
// optimistic UI rollback'ine düştüğü için kullanıcıya hiçbir iz bırakmıyordu).
// `services/api/users.ts`'teki TRAKT_PROXY_URL ile BİREBİR AYNI desen:
// sunucu-sunucu isteği CORS'a hiç tabi değil. `Platform.OS` kontrolü
// EKLENMEDİ (bkz. Madde 91) — native/web aynı yolu kullanır.
const TRAKT_PROXY_URL = process.env.EXPO_PUBLIC_API_URL
  ? `${process.env.EXPO_PUBLIC_API_URL}/api/trakt-proxy`
  : '/api/trakt-proxy';

export interface TraktUserProfile {
  username: string;
  private: boolean;
  name: string | null;
  vip: boolean;
  ids: { slug: string };
  images?: { avatar?: { full: string } };
}

// GET /users/{id} yalnızca `extended=full` ile avatar (images.avatar.full)
// döndürüyor — canlı bir istekle doğrulandı, eksik bırakılırsa alan hiç gelmiyor.
export const getUserProfile = async (username: string): Promise<TraktUserProfile> => {
  const client = await getTraktClient();
  const response = await client.get(`/users/${encodeURIComponent(username)}?extended=full`);
  return response.data;
};

// `?extended=full` olmadan avatar/isim gibi alanlar eksik gelir — bkz. yukarıdaki not.
export const getFollowers = async (username: string, page?: number, limit?: number): Promise<TraktUserProfile[]> => {
  const client = await getTraktClient();
  let url = `/users/${encodeURIComponent(username)}/followers?extended=full`;
  if (page) url += `&page=${page}`;
  if (limit) url += `&limit=${limit}`;
  const response = await client.get(url);
  return (response.data ?? []).map((item: any) => item?.user).filter(Boolean);
};

export const getFollowing = async (username: string, page?: number, limit?: number): Promise<TraktUserProfile[]> => {
  const client = await getTraktClient();
  let url = `/users/${encodeURIComponent(username)}/following?extended=full`;
  if (page) url += `&page=${page}`;
  if (limit) url += `&limit=${limit}`;
  const response = await client.get(url);
  return (response.data ?? []).map((item: any) => item?.user).filter(Boolean);
};

export const getMyFollowingSlugs = async (): Promise<string[]> => {
  const client = await getTraktClient();
  const response = await client.get('/users/me/following');
  return (response.data ?? [])
    .map((item: any) => item?.user?.ids?.slug)
    .filter((slug: unknown): slug is string => typeof slug === 'string');
};

export interface FollowResult {
  // Gizli (private) hesaplarda takip isteği onay bekler — Trakt dokümantasyonu
  // ve canlı doğrulamayla teyit edildi: approvedAt null ise "istek gönderildi,
  // onay bekleniyor", dolu bir tarihse "anında takip edildi" demektir.
  approvedAt: string | null;
}

export const followTraktUser = async (username: string): Promise<FollowResult> => {
  const accessToken = await SecureStore.getItemAsync('traktAccessToken');
  const response = await axios.post(TRAKT_PROXY_URL, {}, {
    params: { endpoint: `/users/${encodeURIComponent(username)}/follow` },
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  return { approvedAt: response.data?.approved_at ?? null };
};

// NOT: Path gerçekten `/follow` — dokümantasyon sayfasının adı "unfollow"
// olsa da HTTP path'i aynı follow endpoint'i, yalnızca metod DELETE.
export const unfollowTraktUser = async (username: string): Promise<void> => {
  const accessToken = await SecureStore.getItemAsync('traktAccessToken');
  await axios.delete(TRAKT_PROXY_URL, {
    params: { endpoint: `/users/${encodeURIComponent(username)}/follow` },
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
};

export const getUserWatchedShows = async (username: string) => {
  const client = await getTraktClient();
  const response = await client.get(`/users/${encodeURIComponent(username)}/watched/shows?extended=full`);
  return response.data ?? [];
};

export const getUserWatchedMovies = async (username: string) => {
  const client = await getTraktClient();
  const response = await client.get(`/users/${encodeURIComponent(username)}/watched/movies?extended=full`);
  return response.data ?? [];
};
