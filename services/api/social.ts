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

// Trakt'ın CDN'i GET yanıtlarını agresif önbelliyor — `services/api/comments.ts`'teki
// AYNI `cacheBustParam` deseni (bkz. docs/HISTORY.md Madde 87/102): sabit bir
// URL'ye (`/users/{id}?extended=full`, her çağrıda BİREBİR AYNI) her seferinde
// benzersiz bir `_` parametresi eklemek CDN'i "yeni bir kaynak" sanmaya
// zorlayıp önbelleği atlatır. Neden gerekli: kullanıcı adını/bio'sunu
// trakt.tv'de değiştirip uygulamaya döndüğünde (bkz. docs/HISTORY.md Madde 134
// — düzenleme yalnızca orada yapılabiliyor), `getUserProfile('me')` CDN'de
// duran ESKİ yanıtı döndürürse değişiklik dakikalarca görünmezdi.
const cacheBustParam = () => `_=${Date.now()}`;

export interface TraktUserProfile {
  username: string;
  private: boolean;
  name: string | null;
  vip: boolean;
  ids: { slug: string };
  images?: { avatar?: { full: string } };
  // `?extended=full` ile gelir (bkz. aşağıdaki not) — Profili Düzenle formunu
  // doldurmak ve bio'yu profil ekranlarında göstermek için kullanılıyor,
  // önceden tipte tanımlı değildi. `location` BİLİNÇLİ OLARAK YOK — kullanıcı
  // bu uygulamada şehir/konum alanına gerek olmadığını belirtti.
  about?: string | null;
}

// GET /users/{id} yalnızca `extended=full` ile avatar (images.avatar.full)
// döndürüyor — canlı bir istekle doğrulandı, eksik bırakılırsa alan hiç gelmiyor.
export const getUserProfile = async (username: string): Promise<TraktUserProfile> => {
  const client = await getTraktClient();
  const response = await client.get(`/users/${encodeURIComponent(username)}?extended=full&${cacheBustParam()}`);
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

/**
 * Takip ettiklerimin slug listesi — akışın görünürlük kümesinin kaynağı.
 *
 * ⚠️ BİLİNÇLİ OLARAK `page`/`limit` GÖNDERİLMİYOR. Canlı ölçümle doğrulandı
 * (2026-08-17): bu uç `x-pagination-*` başlığı döndürmüyor ve tüm listeyi tek
 * yanıtta veriyor. AMA `?limit=N` parametresini **kabul ediyor** — buraya bir
 * gün `limit` eklenirse liste SESSİZCE kırpılır ve kimse fark etmez.
 *
 * ⚠️ `Array.isArray` GUARD'I SİLİNMEMELİ: `[]` (kullanıcı gerçekten kimseyi
 * takip etmiyor) ile "yanıt kabul edilemez" ayrımı, takip snapshot'ının
 * tamamının dayandığı ayrım (bkz. docs/FOLLOW_SNAPSHOT_PLAN.md ve Worker'daki
 * `normalizeFollowingSlugs`). Trakt bir gün 200 + HTML gövde döndürürse
 * (kapanış duyurusu, proxy sayfası) bugün `.map is not a function` TypeError'ı
 * TESADÜFEN doğru davranıyor — reject ediyor. Guard bunu niyetli ve teşhis
 * edilebilir hâle getiriyor.
 */
export const getMyFollowingSlugs = async (): Promise<string[]> => {
  const client = await getTraktClient();
  const response = await client.get('/users/me/following');
  if (!Array.isArray(response.data)) {
    throw new Error(
      `[social] /users/me/following beklenmeyen yanıt türü: ${typeof response.data}`
    );
  }
  return response.data
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

// Gelen takip istekleri (hesabım gizliyken beni takip etmek isteyip onayımı
// bekleyenler) — `/users/requests[/:id]`, `/users/:id/follow` ile AYNI
// "kullanıcının özel/yazma verisi" ailesinden (bkz. docs/HISTORY.md Madde
// 109/120/122). Bu oturumda internet erişimi olmadığından `curl` ile CORS
// doğrulaması YAPILAMADI — ihtiyatlı yol seçildi, üçü de zaten var olan
// `TRAKT_PROXY_URL` üzerinden geçiyor (server.js'te değişiklik GEREKMEDİ,
// proxy endpoint-agnostik).
export interface TraktFollowRequest {
  id: number;
  requested_at: string;
  user: TraktUserProfile;
}

export const getFollowRequests = async (): Promise<TraktFollowRequest[]> => {
  const accessToken = await SecureStore.getItemAsync('traktAccessToken');
  const response = await axios.get(TRAKT_PROXY_URL, {
    params: { endpoint: '/users/requests' },
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  return response.data ?? [];
};

export const approveFollowRequest = async (id: number): Promise<void> => {
  const accessToken = await SecureStore.getItemAsync('traktAccessToken');
  await axios.post(TRAKT_PROXY_URL, {}, {
    params: { endpoint: `/users/requests/${id}` },
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
};

export const denyFollowRequest = async (id: number): Promise<void> => {
  const accessToken = await SecureStore.getItemAsync('traktAccessToken');
  await axios.delete(TRAKT_PROXY_URL, {
    params: { endpoint: `/users/requests/${id}` },
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
