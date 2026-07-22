import {
  addToWatchlistTrakt,
  removeFromWatchlistTrakt,
  hideItemTrakt,
  removeFromHistoryTrakt,
  toggleLikedMedia,
  createCustomList,
  deleteCustomList,
  addMediaToCustomList,
  removeMediaFromCustomList
} from '../../traktApi';
import { fetchFreshData } from '../fetchers';
import {
  CACHE_KEYS,
  currentAccessToken,
  safeStorageSet,
  setWatchedShows,
  setWatchedMovies,
  setCustomLists,
  setFavShows,
  setFavMovies,
  setWatchlistShows,
  setWatchlistMovies,
  setShowProgressMap,
  persistShowProgressMap,
  setCalendarShows,
  setCalendarSeasonsMap,
} from '../utils';
import { useLibraryStore } from '../../../store/useLibraryStore';
import { logError } from '../../../utils/errorLog';
import { recordMutationResult } from '../../../utils/metrics';
import {
  DEFAULT_LIST_NAME,
  MAX_USER_LISTS,
  MAX_LIST_ITEMS,
  ListLimitError,
} from '../../../utils/listHelpers';

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
    recordMutationResult('toggleWatchlistStatus', true);
  } catch (err) {
    console.error('Toggle watchlist hatası, rollback yapılıyor:', err);
    logError('mutations.collections.toggleWatchlistStatus', err);
    recordMutationResult('toggleWatchlistStatus', false);
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
    recordMutationResult('toggleFavoriteStatus', true);
  } catch (err) {
    console.error('Toggle favorite hatası, rollback yapılıyor:', err);
    logError('mutations.collections.toggleFavoriteStatus', err);
    recordMutationResult('toggleFavoriteStatus', false);
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
    // NOT: burada eskiden accessToken yerine `null` geçiliyordu; fetchFreshData
    // token'ı `null` gördüğünde hiçbir şey yapmadan sessizce çıkıyor (bkz.
    // fetchers.ts). Sonuç: "Gizle" API isteği başarıyla gidiyordu ama arayüz
    // hiç yenilenmediği için öğe ilerleme/devam et listesinde görünmeye devam
    // ediyordu — sonraki doğal senkrona kadar.
    fetchFreshData(currentAccessToken, true);
    recordMutationResult('hideMediaFromProgress', true);
  } catch (err) {
    console.error('Hide media hatası:', err);
    logError('mutations.collections.hideMediaFromProgress', err);
    recordMutationResult('hideMediaFromProgress', false);
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
      persistShowProgressMap(newMap);
      return newMap;
    });

    // "Yaklaşanlar" (calendar) sekmesi, watchedShows/showProgressMap'ten TAMAMEN
    // AYRI kendi kopyasını (calendarShows/calendarSeasonsMap) tutan bir dilim —
    // yukarıdaki iki temizlik bu kopyaya hiç dokunmaz. ESKİ DAVRANIŞ: dizi bu
    // iki dilimden kaldırılsa bile calendarShows'daki kopyası olduğu gibi
    // kalıyor, kullanıcı "Geçmişten Sil"e bastığı bir dizi bir sonraki doğal
    // senkrona (10 dk TTL) kadar hâlâ "Yaklaşanlar"da görünmeye devam ediyordu.
    // Dizi HÂLÂ watchlist'teyse (Trakt'ın takvimi watchlist'i de kapsar) calendar
    // kopyası KASITLI OLARAK dokunulmadan bırakılır — o dizi hâlâ meşru bir
    // şekilde takip ediliyor demektir, yalnızca izleme geçmişi silinmiştir.
    const stillWatchlisted = (useLibraryStore.getState().watchlistShows || [])
      .some((p: any) => p.show?.ids?.trakt === id);

    if (!stillWatchlisted) {
      setCalendarShows((prev: any) => {
        const newCal = prev.filter((p: any) => p.show?.ids?.trakt !== id);
        safeStorageSet(CACHE_KEYS.calendarShows, JSON.stringify(newCal));
        return newCal;
      });
      setCalendarSeasonsMap((prev: any) => {
        if (!prev[id]) return prev;
        const newMap = { ...prev };
        delete newMap[id];
        safeStorageSet(CACHE_KEYS.calendarSeasonsMap, JSON.stringify(newMap));
        return newMap;
      });
    }
  } else {
    setWatchedMovies((prev: any) => {
      const newWatched = prev.filter((p: any) => p.movie?.ids?.trakt !== id);
      safeStorageSet(CACHE_KEYS.watchedMovies, JSON.stringify(newWatched));
      return newWatched;
    });
  }

  try {
    await removeFromHistoryTrakt(id, type);
    recordMutationResult('deleteMediaFromHistory', true);
  } catch (err) {
    console.error('Delete from history hatası:', err);
    logError('mutations.collections.deleteMediaFromHistory', err);
    recordMutationResult('deleteMediaFromHistory', false);
    fetchFreshData(null, true);
  }
};

export const createNewList = async (name: string, description?: string) => {
  // Trakt limiti: kullanıcıya en fazla MAX_USER_LISTS izin verilir (1 slot favori
  // listesine rezerve). Kontrol store'daki (favori zaten süzülmüş) sayı üzerinden
  // yapılır — ekstra ağ isteği gerektirmez.
  const currentUserLists = useLibraryStore.getState().customLists || [];
  if (currentUserLists.length >= MAX_USER_LISTS) {
    throw new ListLimitError('maxLists');
  }

  try {
    const newList = await createCustomList(name, description);
    setCustomLists((prev: any) => {
      const updated = [newList, ...prev];
      safeStorageSet(CACHE_KEYS.customLists, JSON.stringify(updated));
      return updated;
    });
    recordMutationResult('createNewList', true);
    return newList;
  } catch (err) {
    console.error('Liste oluşturma hatası:', err);
    logError('mutations.collections.createNewList', err);
    recordMutationResult('createNewList', false);
    throw err;
  }
};

// "Listeye ekle" akışının varsayılan hedefi. Varsa mevcut "Koleksiyonum"u döndürür,
// yoksa oluşturur (limit createNewList içinde uygulanır).
export const getOrCreateDefaultList = async () => {
  const lists = useLibraryStore.getState().customLists || [];
  const existing = lists.find((l: any) => l.name === DEFAULT_LIST_NAME);
  if (existing) return existing;
  return await createNewList(DEFAULT_LIST_NAME, 'Kaydettiğim içerikler.');
};

export const toggleMediaInList = async (listId: number, mediaId: number, type: 'show' | 'movie', isAdding: boolean) => {
  // Ekleme öncesi 250 öğe limitini uygula (Trakt liste başına sınır).
  if (isAdding) {
    const list = (useLibraryStore.getState().customLists || []).find((l: any) => l.ids?.trakt === listId);
    if (list && (list.item_count || 0) >= MAX_LIST_ITEMS) {
      throw new ListLimitError('maxItems');
    }
  }

  // İyimser güncelleme: item_count'u ANINDA değiştir, hata olursa geri al.
  let previousLists: any[] | null = null;
  setCustomLists((prev: any) => {
    previousLists = prev;
    const updated = prev.map((list: any) => {
      if (list.ids?.trakt === listId) {
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

  try {
    if (isAdding) {
      await addMediaToCustomList(listId, mediaId, type);
    } else {
      await removeMediaFromCustomList(listId, mediaId, type);
    }
    recordMutationResult('toggleMediaInList', true);
  } catch (err) {
    console.error('Liste medyası ekle/çıkar hatası, geri alınıyor:', err);
    logError('mutations.collections.toggleMediaInList', err);
    recordMutationResult('toggleMediaInList', false);
    if (previousLists !== null) {
      setCustomLists(previousLists);
      safeStorageSet(CACHE_KEYS.customLists, JSON.stringify(previousLists));
    }
    throw err;
  }
};

// Listeyi Trakt'tan siler ve store'dan iyimser olarak kaldırır.
export const deleteListById = async (listId: number | string) => {
  let previousLists: any[] | null = null;
  setCustomLists((prev: any) => {
    previousLists = prev;
    const updated = prev.filter((l: any) => String(l.ids?.trakt) !== String(listId));
    safeStorageSet(CACHE_KEYS.customLists, JSON.stringify(updated));
    return updated;
  });

  try {
    await deleteCustomList(listId);
    recordMutationResult('deleteListById', true);
  } catch (err) {
    console.error('Liste silme hatası, geri alınıyor:', err);
    logError('mutations.collections.deleteListById', err);
    recordMutationResult('deleteListById', false);
    if (previousLists !== null) {
      setCustomLists(previousLists);
      safeStorageSet(CACHE_KEYS.customLists, JSON.stringify(previousLists));
    }
    throw err;
  }
};
