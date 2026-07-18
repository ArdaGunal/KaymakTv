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
