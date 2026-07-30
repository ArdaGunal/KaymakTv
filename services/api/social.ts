import { getTraktClient } from './traktClient';

// Trakt'ın kendi sosyal grafiği (Follow/Following) — bkz. docs/feed.md
// "Mimari Pivot". KaymakTV kendi takip tablosunu tutmuyor, tüm takip
// ilişkisi doğrudan Trakt API'sinden okunup yazılıyor. Bu uç noktaların
// hepsi kullanıcının KENDİ token'ıyla çağrılıyor — Trakt zaten "bu isteği
// kim yapıyor" sorusunu kendi OAuth'uyla cevapladığı için ayrı bir kimlik
// doğrulama katmanına (Worker vb.) hiç gerek yok.

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
  const client = await getTraktClient();
  const response = await client.post(`/users/${encodeURIComponent(username)}/follow`, {});
  return { approvedAt: response.data?.approved_at ?? null };
};

// NOT: Path gerçekten `/follow` — dokümantasyon sayfasının adı "unfollow"
// olsa da HTTP path'i aynı follow endpoint'i, yalnızca metod DELETE.
export const unfollowTraktUser = async (username: string): Promise<void> => {
  const client = await getTraktClient();
  await client.delete(`/users/${encodeURIComponent(username)}/follow`);
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
