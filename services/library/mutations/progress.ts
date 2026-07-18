import {
  addEpisodeToHistory,
  addSeasonToHistory,
  addEpisodesBulkToHistory,
  removeEpisodeFromHistoryTrakt,
  removeSeasonFromHistoryTrakt,
  addMovieToHistory,
  addToWatchlistTrakt,
  getShowProgress,
} from '../../traktApi';
import { fetchFreshData } from '../fetchers';
import {
  CACHE_KEYS,
  safeStorageSet,
  setWatchedMovies,
  setWatchlistMovies,
  setShowProgressMap,
} from '../utils';

export const markEpisodeAsWatched = async (showId: number, season: number, episode: number) => {
  let previousState: any = null;

  console.log(`[OPTIMISTIC UI] Bölüm UI'da işaretleniyor: Show ${showId}, S${season}E${episode}`);

  setShowProgressMap((prev: any) => {
    previousState = prev[showId];

    const currentProgress = prev[showId];
    if (!currentProgress || !currentProgress.next_episode) return prev;

    const optimisticProgress = {
      ...currentProgress,
      next_episode: {
        ...currentProgress.next_episode,
        number: currentProgress.next_episode.number + 1,
        title: 'Kaydediliyor...',
      },
    };

    return { ...prev, [showId]: optimisticProgress };
  });

  try {
    console.log(`[API REQUEST] Trakt'a gönderiliyor...`);
    await addEpisodeToHistory(showId, season, episode);
    console.log(`[API SUCCESS] Trakt ile senkronize edildi. Gerçek veri çekiliyor...`);

    let newProgress = await getShowProgress(showId);

    const staleSeason = newProgress?.seasons?.find((s:any) => s.number === season);
    const staleEp = staleSeason?.episodes?.find((e:any) => e.number === episode);

    if (staleEp && !staleEp.completed) {
      console.warn(`[STALE DATA] Trakt progress henüz güncellenmedi (S${season}E${episode} completed=false). Lokal yama uygulanıyor...`);
      staleEp.completed = true;
      if (newProgress.next_episode) {
        newProgress.next_episode = {
          ...newProgress.next_episode,
          number: episode + 1,
          title: 'Sıradaki Bölüm Aranıyor...'
        };
      }
    }

    setShowProgressMap((prev: any) => {
      const updated = { ...prev, [showId]: newProgress };
      safeStorageSet(CACHE_KEYS.showProgressMap, JSON.stringify(updated));
      return updated;
    });

    return newProgress;
  } catch (error) {
    console.error(`[API ERROR] İşlem başarısız, eski haline (Rollback) dönülüyor!`, error);
    if (previousState !== null) {
      setShowProgressMap((prev: any) => ({ ...prev, [showId]: previousState }));
    }
    throw error;
  }
};

export const unwatchEpisode = async (showId: number, season: number, episode: number) => {
  let previousState: any = null;

  console.log(`[OPTIMISTIC UI] Bölüm UI'da Kaldırılıyor: Show ${showId}, S${season}E${episode}`);

  setShowProgressMap((prev: any) => {
    previousState = prev[showId];

    const currentProgress = prev[showId];
    if (!currentProgress || !currentProgress.next_episode) return prev;

    const optimisticProgress = {
      ...currentProgress,
      next_episode: {
        ...currentProgress.next_episode,
        number: Math.max(1, episode),
        title: 'Geri Alınıyor...',
      },
    };

    return { ...prev, [showId]: optimisticProgress };
  });

  try {
    console.log(`[API REQUEST] Trakt'tan Bölüm Siliniyor...`);
    await removeEpisodeFromHistoryTrakt(showId, season, episode);
    console.log(`[API SUCCESS] Trakt üzerinden silindi. Gerçek veri çekiliyor...`);

    let newProgress = await getShowProgress(showId);

    const staleSeason = newProgress?.seasons?.find((s:any) => s.number === season);
    const staleEp = staleSeason?.episodes?.find((e:any) => e.number === episode);

    if (staleEp && staleEp.completed) {
      console.warn(`[STALE DATA] Trakt progress henüz güncellenmedi (S${season}E${episode} completed=true). Lokal yama uygulanıyor...`);
      staleEp.completed = false;

      newProgress.next_episode = {
        season: season,
        number: episode,
        title: staleEp.title,
        ids: staleEp.ids
      };
    }

    let currentCompletedCount = newProgress.completed;
    if (staleEp && staleEp.completed !== undefined) {
       currentCompletedCount = Math.max(0, currentCompletedCount - 1);
    }

    if (currentCompletedCount === 0) {
        console.log(`[WATCHLIST RECOVERY] Dizi hiç izlenmemiş duruma düştü, Watchlist'e geri ekleniyor...`);
        await addToWatchlistTrakt(showId, 'show');
        fetchFreshData(null, true);
    }

    setShowProgressMap((prev: any) => {
      const updated = { ...prev, [showId]: newProgress };
      safeStorageSet(CACHE_KEYS.showProgressMap, JSON.stringify(updated));
      return updated;
    });

    return newProgress;
  } catch (error) {
    console.error(`[API ERROR] İşlem başarısız, eski haline (Rollback) dönülüyor!`, error);
    if (previousState !== null) {
      setShowProgressMap((prev: any) => {
        const updated = { ...prev, [showId]: previousState };
        safeStorageSet(CACHE_KEYS.showProgressMap, JSON.stringify(updated));
        return updated;
      });
    }
    throw error;
  }
};

export const unwatchSeason = async (showId: number, season: number) => {
  let previousState: any = null;

  console.log(`[OPTIMISTIC UI] Sezon UI'da Kaldırılıyor: Show ${showId}, S${season}`);

  setShowProgressMap((prev: any) => {
    previousState = prev[showId];

    const currentProgress = prev[showId];
    if (!currentProgress) return prev;

    const optimisticProgress = {
      ...currentProgress,
      next_episode: {
        season: season,
        number: 1,
        title: 'Sezon Geri Alınıyor...',
      },
    };

    return { ...prev, [showId]: optimisticProgress };
  });

  try {
    console.log(`[API REQUEST] Trakt'tan Sezon Siliniyor...`);
    await removeSeasonFromHistoryTrakt(showId, season);
    console.log(`[API SUCCESS] Trakt üzerinden silindi. Gerçek veri çekiliyor...`);

    let newProgress = await getShowProgress(showId);

    if (newProgress.completed === 0) {
        console.log(`[WATCHLIST RECOVERY] Dizi hiç izlenmemiş duruma düştü, Watchlist'e geri ekleniyor...`);
        await addToWatchlistTrakt(showId, 'show');
        fetchFreshData(null, true);
    }

    setShowProgressMap((prev: any) => {
      const updated = { ...prev, [showId]: newProgress };
      safeStorageSet(CACHE_KEYS.showProgressMap, JSON.stringify(updated));
      return updated;
    });

    return newProgress;
  } catch (error) {
    console.error(`[API ERROR] İşlem başarısız, eski haline (Rollback) dönülüyor!`, error);
    if (previousState !== null) {
      setShowProgressMap((prev: any) => {
        const updated = { ...prev, [showId]: previousState };
        safeStorageSet(CACHE_KEYS.showProgressMap, JSON.stringify(updated));
        return updated;
      });
    }
    throw error;
  }
};

export const rewatchEpisode = async (showId: number, season: number, episode: number) => {
  return markEpisodeAsWatched(showId, season, episode);
};

export const markSeasonAsWatched = async (showId: number, season: number) => {
  let previousState: any = null;
  console.log(`[OPTIMISTIC UI] Sezon UI'da işaretleniyor: Show ${showId}, S${season}`);

  setShowProgressMap((prev: any) => {
    previousState = prev[showId];

    const currentProgress = prev[showId];
    if (!currentProgress || !currentProgress.next_episode) return prev;

    const optimisticProgress = {
      ...currentProgress,
      next_episode: {
        ...currentProgress.next_episode,
        title: 'Kaydediliyor...',
      },
    };

    return { ...prev, [showId]: optimisticProgress };
  });

  try {
    console.log(`[API REQUEST] Trakt'a gönderiliyor (Sezon)...`);
    await addSeasonToHistory(showId, season);
    console.log(`[API SUCCESS] Trakt ile senkronize edildi. Gerçek veri çekiliyor...`);

    const newProgress = await getShowProgress(showId);

    setShowProgressMap((prev: any) => {
      const updated = { ...prev, [showId]: newProgress };
      safeStorageSet(CACHE_KEYS.showProgressMap, JSON.stringify(updated));
      return updated;
    });

    return newProgress;
  } catch (error) {
    console.error(`[API ERROR] Sezon işaretleme başarısız, eski haline dönülüyor!`, error);
    if (previousState !== null) {
      setShowProgressMap((prev: any) => ({ ...prev, [showId]: previousState }));
    }
    throw error;
  }
};

export const markEpisodesUpToAsWatched = async (showId: number, season: number, episodes: number[]) => {
  let previousState: any = null;
  console.log(`[OPTIMISTIC UI] Bölümler toplu UI'da işaretleniyor: Show ${showId}, S${season}`);

  setShowProgressMap((prev: any) => {
    previousState = prev[showId];

    const currentProgress = prev[showId];
    if (!currentProgress || !currentProgress.next_episode) return prev;

    const optimisticProgress = {
      ...currentProgress,
      next_episode: {
        ...currentProgress.next_episode,
        title: 'Kaydediliyor...',
      },
    };

    return { ...prev, [showId]: optimisticProgress };
  });

  try {
    console.log(`[API REQUEST] Trakt'a gönderiliyor (Toplu Bölüm)...`);
    await addEpisodesBulkToHistory(showId, season, episodes);
    console.log(`[API SUCCESS] Trakt ile senkronize edildi. Gerçek veri çekiliyor...`);

    const newProgress = await getShowProgress(showId);

    setShowProgressMap((prev: any) => {
      const updated = { ...prev, [showId]: newProgress };
      safeStorageSet(CACHE_KEYS.showProgressMap, JSON.stringify(updated));
      return updated;
    });

    return newProgress;
  } catch (error) {
    console.error(`[API ERROR] Toplu bölüm işaretleme başarısız, eski haline dönülüyor!`, error);
    if (previousState !== null) {
      setShowProgressMap((prev: any) => ({ ...prev, [showId]: previousState }));
    }
    throw error;
  }
};

export const markMovieAsWatched = async (movieId: number) => {
  let previousWatchlist: any = null;
  let previousWatched: any = null;
  let movieItemToMove: any = null;

  console.log(`[OPTIMISTIC UI] Film UI'da anında işaretleniyor: Movie ${movieId}`);

  setWatchlistMovies((prev: any) => {
    previousWatchlist = prev;
    const item = prev.find((p: any) => p.movie.ids.trakt === movieId);
    if (item) {
      movieItemToMove = item;
      const newWatchlist = prev.filter((p: any) => p.movie.ids.trakt !== movieId);
      safeStorageSet(CACHE_KEYS.watchlistMovies, JSON.stringify(newWatchlist));
      return newWatchlist;
    }
    return prev;
  });

  setWatchedMovies((prev: any) => {
    previousWatched = prev;
    const exists = prev.find((p: any) => p.movie.ids.trakt === movieId);
    if (!exists && movieItemToMove) {
      const newWatched = [
        {
          plays: 1,
          last_watched_at: new Date().toISOString(),
          movie: movieItemToMove.movie
        },
        ...prev
      ];
      safeStorageSet(CACHE_KEYS.watchedMovies, JSON.stringify(newWatched));
      return newWatched;
    }
    return prev;
  });

  try {
    console.log(`[API REQUEST] Trakt'a gönderiliyor (Film)...`);
    await addMovieToHistory(movieId);
    console.log(`[API SUCCESS] Film Trakt ile senkronize edildi.`);
  } catch (error) {
    console.error(`[API ERROR] Film işaretleme başarısız, eski haline dönülüyor!`, error);
    if (previousWatchlist !== null) {
      setWatchlistMovies(previousWatchlist);
      safeStorageSet(CACHE_KEYS.watchlistMovies, JSON.stringify(previousWatchlist));
    }
    if (previousWatched !== null) {
      setWatchedMovies(previousWatched);
      safeStorageSet(CACHE_KEYS.watchedMovies, JSON.stringify(previousWatched));
    }
    throw error;
  }
};
