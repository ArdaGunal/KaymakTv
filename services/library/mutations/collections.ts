import {
  addToWatchlistTrakt,
  removeFromWatchlistTrakt,
  hideItemTrakt,
  removeFromHistoryTrakt,
  toggleLikedMedia,
  createCustomList,
  addMediaToCustomList,
  removeMediaFromCustomList
} from '../../traktApi';
import { fetchFreshData } from '../fetchers';
import {
  CACHE_KEYS,
  safeStorageSet,
  setWatchedShows,
  setWatchedMovies,
  setCustomLists,
  setFavShows,
  setFavMovies,
  setWatchlistShows,
  setWatchlistMovies,
  setShowProgressMap,
} from '../utils';

export const toggleWatchlistStatus = async (id: number, type: 'show' | 'movie', isCurrentlyWatchlisted: boolean, mediaData: any) => {
  let previousWatchlistShows: any[] | null = null;
  let previousWatchlistMovies: any[] | null = null;

  if (type === 'show') {
    setWatchlistShows((prev: any) => {
      previousWatchlistShows = prev;
      const newWatchlist = isCurrentlyWatchlisted
        ? prev.filter((p: any) => p.show?.ids?.trakt !== id)
        : [{ listed_at: new Date().toISOString(), show: mediaData }, ...prev];
      safeStorageSet(CACHE_KEYS.watchlistShows, JSON.stringify(newWatchlist));
      return newWatchlist;
    });
  } else {
    setWatchlistMovies((prev: any) => {
      previousWatchlistMovies = prev;
      const newWatchlist = isCurrentlyWatchlisted
        ? prev.filter((p: any) => p.movie?.ids?.trakt !== id)
        : [{ listed_at: new Date().toISOString(), movie: mediaData }, ...prev];
      safeStorageSet(CACHE_KEYS.watchlistMovies, JSON.stringify(newWatchlist));
      return newWatchlist;
    });
  }

  try {
    if (isCurrentlyWatchlisted) {
      await removeFromWatchlistTrakt(id, type);
    } else {
      await addToWatchlistTrakt(id, type);
    }
  } catch (err) {
    console.error('Toggle watchlist hatası, rollback yapılıyor:', err);
    if (type === 'show' && previousWatchlistShows !== null) {
      setWatchlistShows(previousWatchlistShows);
      safeStorageSet(CACHE_KEYS.watchlistShows, JSON.stringify(previousWatchlistShows));
    } else if (type === 'movie' && previousWatchlistMovies !== null) {
      setWatchlistMovies(previousWatchlistMovies);
      safeStorageSet(CACHE_KEYS.watchlistMovies, JSON.stringify(previousWatchlistMovies));
    }
    throw err;
  }
};

export const toggleFavoriteStatus = async (id: number, type: 'show' | 'movie', isCurrentlyFavorited: boolean, mediaData: any) => {
  let previousFavShows: any[] | null = null;
  let previousFavMovies: any[] | null = null;

  if (type === 'show') {
    setFavShows((prev: any) => {
      previousFavShows = prev;
      const newFavs = isCurrentlyFavorited
        ? prev.filter((p: any) => p.show?.ids?.trakt !== id)
        : [{ listed_at: new Date().toISOString(), show: mediaData }, ...prev];
      safeStorageSet(CACHE_KEYS.favShows, JSON.stringify(newFavs));
      return newFavs;
    });
  } else {
    setFavMovies((prev: any) => {
      previousFavMovies = prev;
      const newFavs = isCurrentlyFavorited
        ? prev.filter((p: any) => p.movie?.ids?.trakt !== id)
        : [{ listed_at: new Date().toISOString(), movie: mediaData }, ...prev];
      safeStorageSet(CACHE_KEYS.favMovies, JSON.stringify(newFavs));
      return newFavs;
    });
  }

  try {
    // Trakt API'ye özel listeye ekleme/çıkarma isteğini gönder
    await toggleLikedMedia(id, type, !isCurrentlyFavorited);
  } catch (err) {
    console.error('Toggle favorite hatası, rollback yapılıyor:', err);
    if (type === 'show' && previousFavShows !== null) {
      setFavShows(previousFavShows);
      safeStorageSet(CACHE_KEYS.favShows, JSON.stringify(previousFavShows));
    } else if (type === 'movie' && previousFavMovies !== null) {
      setFavMovies(previousFavMovies);
      safeStorageSet(CACHE_KEYS.favMovies, JSON.stringify(previousFavMovies));
    }
    throw err;
  }
};

export const hideMediaFromProgress = async (id: number, type: 'show' | 'movie') => {
  try {
    await hideItemTrakt(id, type);
    fetchFreshData(null, true);
  } catch (err) {
    console.error('Hide media hatası:', err);
  }
};

export const deleteMediaFromHistory = async (id: number, type: 'show' | 'movie') => {
  if (type === 'show') {
    setWatchedShows((prev: any) => {
      const newWatched = prev.filter((p: any) => p.show?.ids?.trakt !== id);
      safeStorageSet(CACHE_KEYS.watchedShows, JSON.stringify(newWatched));
      return newWatched;
    });
    setShowProgressMap((prev: any) => {
      const newMap = { ...prev };
      delete newMap[id];
      safeStorageSet(CACHE_KEYS.showProgressMap, JSON.stringify(newMap));
      return newMap;
    });
  } else {
    setWatchedMovies((prev: any) => {
      const newWatched = prev.filter((p: any) => p.movie?.ids?.trakt !== id);
      safeStorageSet(CACHE_KEYS.watchedMovies, JSON.stringify(newWatched));
      return newWatched;
    });
  }

  try {
    await removeFromHistoryTrakt(id, type);
  } catch (err) {
    console.error('Delete from history hatası:', err);
    fetchFreshData(null, true);
  }
};

export const createNewList = async (name: string, description?: string) => {
  try {
    const newList = await createCustomList(name, description);
    setCustomLists((prev: any) => {
      const updated = [newList, ...prev];
      safeStorageSet(CACHE_KEYS.customLists, JSON.stringify(updated));
      return updated;
    });
    return newList;
  } catch (err) {
    console.error('Liste oluşturma hatası:', err);
    throw err;
  }
};

export const toggleMediaInList = async (listId: number, mediaId: number, type: 'show' | 'movie', isAdding: boolean) => {
  try {
    if (isAdding) {
      await addMediaToCustomList(listId, mediaId, type);
    } else {
      await removeMediaFromCustomList(listId, mediaId, type);
    }

    setCustomLists((prev: any) => {
      const updated = prev.map((list: any) => {
        if (list.ids.trakt === listId) {
          return {
            ...list,
            item_count: isAdding ? (list.item_count || 0) + 1 : Math.max(0, (list.item_count || 0) - 1)
          };
        }
        return list;
      });
      safeStorageSet(CACHE_KEYS.customLists, JSON.stringify(updated));
      return updated;
    });
  } catch (err) {
    console.error('Liste medyası ekle/çıkar hatası:', err);
  }
};
