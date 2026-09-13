import { getTraktClient } from './traktClient';

// ══════════════════════════════════════════════════════════════════════════
// TRAKT PROFİL OKUMALARI — artık SOSYAL GRAF DEĞİL (M338)
// ══════════════════════════════════════════════════════════════════════════
// ⛔ Bu dosya eskiden Trakt'ın sosyal grafını (takip/takipçi/istek) okuyup
// yazıyordu: `docs/design/feed.md` "Mimari Pivot" kararıyla KaymakTV kendi
// takip tablosunu tutmuyordu. Faz T · T3 bu kararı TERSİNE çevirdi — grafın
// tek otoritesi artık bizim veritabanımız (`040_social_graph.sql`, karar §5.1)
// ve istemci tarafı `services/api/kaymakSocial.ts`'te.
//
// 🗑️ M338'de SİLİNENLER (kodda SIFIR kullanım, ölçüldü): `getFollowers`,
// `getFollowing`, `getMyFollowingSlugs`, `followTraktUser`, `unfollowTraktUser`,
// `getFollowRequests`, `approveFollowRequest`, `denyFollowRequest` ve yalnızca
// onların kullandığı `TRAKT_PROXY_URL`. Geri getirmek bir takip yolunu tekrar
// Trakt'a bağlamak olurdu — Google-only kullanıcıda 401 veren sınıf
// (`FAZ_T3_TASLAK` §1.1, M324'teki puanlama hatasıyla aynı).
// ⚠️ Web sunucusunun proxy izin listesi (`server/security.js`) bu Trakt yazma
// uçlarına HÂLÂ izin veriyor — `BACKLOG` §F7.
//
// Kalanlar yalnızca OKUMA ve yalnızca Trakt ZENGİNLEŞTİRMESİ içindir: isim,
// biyografi, avatar ve Trakt izleme kütüphanesi. Başkası için çağrılırken
// anahtar sunucunun döndürdüğü GERÇEK `traktSlug`'dır, rota parametresi DEĞİL
// (bkz. `features/publicProfile/hooks/usePublicProfileIdentity.ts`).

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
