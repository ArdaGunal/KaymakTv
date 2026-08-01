import { addRating, removeRating } from '../../traktApi';
import { resolveMediaMeta } from '../mediaMeta';
import { publishActivities, retractLocalActivity, nowStamp } from '../../../features/feed/services/feedPublish';
import {
  CACHE_KEYS,
  safeStorageSet,
  setUserRatingsShows,
  setUserRatingsMovies,
  setUserRatingsEpisodes,
} from '../utils';

export const setLocalRating = (id: number, type: 'show' | 'movie' | 'episode', rating: number) => {
  const updateStateAndCache = (
    setFn: (updater: any) => void,
    cacheKey: string,
    itemKey: string
  ) => {
    setFn((prev: any) => {
      // Eğer zaten varsa güncelle
      const existsIndex = prev.findIndex((r: any) => r[itemKey]?.ids?.trakt === id);
      let updated;
      if (existsIndex >= 0) {
        updated = [...prev];
        updated[existsIndex] = { ...updated[existsIndex], rating };
      } else {
        // Yoksa ekle
        updated = [...prev, { rating, [itemKey]: { ids: { trakt: id } } }];
      }
      safeStorageSet(cacheKey, JSON.stringify(updated));
      return updated;
    });
  };

  if (type === 'show') updateStateAndCache(setUserRatingsShows, CACHE_KEYS.userRatingsShows, 'show');
  else if (type === 'movie') updateStateAndCache(setUserRatingsMovies, CACHE_KEYS.userRatingsMovies, 'movie');
  else if (type === 'episode') updateStateAndCache(setUserRatingsEpisodes, CACHE_KEYS.userRatingsEpisodes, 'episode');
};

export const removeLocalRating = (id: number, type: 'show' | 'movie' | 'episode') => {
  const removeStateAndCache = (
    setFn: (updater: any) => void,
    cacheKey: string,
    itemKey: string
  ) => {
    setFn((prev: any) => {
      const updated = prev.filter((r: any) => r[itemKey]?.ids?.trakt !== id);
      safeStorageSet(cacheKey, JSON.stringify(updated));
      return updated;
    });
  };

  if (type === 'show') removeStateAndCache(setUserRatingsShows, CACHE_KEYS.userRatingsShows, 'show');
  else if (type === 'movie') removeStateAndCache(setUserRatingsMovies, CACHE_KEYS.userRatingsMovies, 'movie');
  else if (type === 'episode') removeStateAndCache(setUserRatingsEpisodes, CACHE_KEYS.userRatingsEpisodes, 'episode');
};

// ─────────────────────────────────────────────────────────────────────────
// PUANLAMA + AKIŞA ANINDA YAYIN
//
// ESKİ DAVRANIŞ: ekranlar `addRating`i (ham Trakt katmanı) DOĞRUDAN çağırıyordu
// — 6 ayrı çağrı noktası, hiçbiri Akış'tan haberdar değil. Bir puan verildiğinde
// akışa düşmesi için uygulamanın kapanıp yeniden açılması gerekiyordu.
//
// `rateMedia`, dizi/film puanlaması için TEK giriş noktasıdır: Trakt'a yazar ve
// aynı damgayla Akış'a yayınlar. BÖLÜM puanları bilinçli olarak kapsam dışı —
// Akış şeması yalnızca dizi/film puanı taşıyor (bkz. Worker handleFeedSync,
// /sync/ratings/{shows,movies}); bölüm puanı için `addRating` doğrudan
// çağrılmaya devam eder.
// ─────────────────────────────────────────────────────────────────────────
export const rateMedia = async (id: number, type: 'show' | 'movie', rating: number) => {
  // Damga Trakt'a ve Akış'a AYNI gönderilir — bir sonraki tam senkron aynı
  // dedup anahtarını üretsin diye (bkz. mutations/progress.ts başlığı).
  const ratedAt = nowStamp();
  const result = await addRating(id, type, rating, undefined, undefined, ratedAt);

  // Başlık/poster kütüphane dilimlerinden çözülür — çağıranların imzasını
  // Akış yüzünden değiştirmemek için (bkz. services/library/mediaMeta.ts).
  const meta = resolveMediaMeta(id, type);
  if (meta.title) {
    publishActivities([
      {
        activityType: 'rated',
        showId: id,
        mediaType: type,
        showTitle: meta.title,
        tmdbId: meta.tmdbId,
        rating,
        activityAt: ratedAt,
      },
    ]);
  }

  return result;
};

// Puan kaldırıldığında akıştaki kart da düşmeli — aksi halde kullanıcı
// sildiği bir puanı akışında görmeye devam ederdi. Yalnızca YEREL akış
// temizlenir; Supabase satırını bir sonraki tam senkron geri alma mantığıyla
// siler (bkz. mutations/progress.ts'teki aynı gerekçe).
export const unrateMedia = async (id: number, type: 'show' | 'movie') => {
  const result = await removeRating(id, type);
  retractLocalActivity((a) => a.activityType === 'rated' && a.showId === id && a.mediaType === type);
  return result;
};
