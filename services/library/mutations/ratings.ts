// 🎯 PUAN YALNIZ BİZDE (kullanıcı kararı, 2026-11-05, M575)
// Verilen ya da silinen puan yalnız `user_ratings`'e yazılır, Trakt'a hiçbir istek gitmez.
// Trakt'taki eski puanlar yalnız ilk aktarımda içeri alınır (`FARK_AILELERI` onları koşmaz).
// Bu dosya Trakt'a dokunursa `tests/arayuz/yazim-kapisi.test.mjs` kalır.
import * as libraryApi from '../../api/library';
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

/**
 * Dizi/film puanının TEK giriş noktası: bize yazar, Akış'a anında yayınlar.
 * Düşerse hata çağırana gider, iyimser ekran geri alınır.
 *
 * `ipucu` (M477): çağıran ekranın bildiği başlık/tmdb. Kütüphanede OLMAYAN yapım
 * puanlanınca `resolveMediaMeta` boş döner; kütüphane kaydı varsa o kazanır.
 */
export const rateMedia = async (
  id: number,
  type: 'show' | 'movie',
  rating: number,
  ipucu?: { title?: string; tmdbId?: number }
) => {
  await (type === 'show' ? libraryApi.rateShow(id, rating) : libraryApi.rateMovie(id, rating));

  // Başlık/poster kütüphane dilimlerinden çözülür (bkz. services/library/mediaMeta.ts).
  const kutuphane = resolveMediaMeta(id, type);
  const meta = { title: kutuphane.title || ipucu?.title || '', tmdbId: kutuphane.tmdbId ?? ipucu?.tmdbId };
  if (meta.title) {
    publishActivities([
      {
        activityType: 'rated',
        showId: id,
        mediaType: type,
        showTitle: meta.title,
        tmdbId: meta.tmdbId,
        rating,
        activityAt: nowStamp(),
      },
    ]);
  }
};

/** Akış kartını sunucuda `062` tetiği siler; burada yalnız yerel akış temizlenir. */
export const unrateMedia = async (id: number, type: 'show' | 'movie') => {
  await (type === 'show' ? libraryApi.unrateShow(id) : libraryApi.unrateMovie(id));
  retractLocalActivity((a) => a.activityType === 'rated' && a.showId === id && a.mediaType === type);
};

// 🔑 BÖLÜM PUANI: akışa yayın yok (şema dizi/film puanı taşıyor). İmza yalnız `epTraktId`:
// `useShowDetailHandlers.handleRateEpisode` sezon/bölüm numarası taşımıyor, Worker kimliği
// doğrudan çözüyor (`resolveTraktLocator` → `{ episodeId }`).
export const rateEpisodeMedia = (epTraktId: number, rating: number) =>
  libraryApi.rateEpisodeById(epTraktId, rating);

export const unrateEpisodeMedia = (epTraktId: number) =>
  libraryApi.unrateEpisodeById(epTraktId);
