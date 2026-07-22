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
  setWatchedShows,
  setWatchlistMovies,
  setShowProgressMap,
  persistShowProgressMap,
} from '../utils';
import { useTrackingStore } from '../../../store/tracking/useTrackingStore';
import { logError } from '../../../utils/errorLog';
import { recordMutationResult } from '../../../utils/metrics';

// Kullanıcı bir dizinin yeni bir bölümünü/sezonunu izlediğinde (tek bölüm,
// toplu bölüm veya sezon işaretleme — geri alma DEĞİL), o dizi artık "aktif
// izleniyor" sayılmalı: Diziler > İzleme sekmesindeki normal bir dizi gibi
// davranmalı.
//   1. Manuel "Bırakıldı" işareti varsa kaldırılır (Bırakıldı, tarihten/
//      ilerlemeden tamamen bağımsız, en yüksek öncelikli bir kova olduğu için
//      progress güncellemesi tek başına bunu geçersiz kılamaz — açıkça temizlemek gerekir).
//   2. `watchedShows`'taki `last_watched_at` "şimdi"ye çekilir — aksi halde
//      "Ara Verilenler" (45 günden eski) kovasındaki bir dizi, eski tarih
//      hâlâ orada dururken bölüm işaretlese bile pasif görünmeye devam ederdi.
//      (Henüz `watchedShows`'ta hiç yoksa — örn. yalnızca watchlist'ten gelen
//      bir dizi — dokunmuyoruz: trackingLogic zaten "son izleme bilinmiyor"
//      durumunu güvenli varsayılan olarak aktif sayıyor.)
const reactivateShowTracking = (showId: number) => {
  useTrackingStore.getState().clearDroppedStatus(showId);

  setWatchedShows((prev: any[]) => {
    const idx = (prev || []).findIndex((item: any) => item?.show?.ids?.trakt === showId);
    if (idx === -1) return prev;
    const updated = [...prev];
    updated[idx] = { ...updated[idx], last_watched_at: new Date().toISOString() };
    safeStorageSet(CACHE_KEYS.watchedShows, JSON.stringify(updated));
    return updated;
  });
};

export const markEpisodeAsWatched = async (showId: number, season: number, episode: number) => {
  let previousState: any = null;

  console.log(`[OPTIMISTIC UI] Bölüm UI'da işaretleniyor: Show ${showId}, S${season}E${episode}`);
  reactivateShowTracking(showId);

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
      persistShowProgressMap(updated);
      return updated;
    });

    recordMutationResult('markEpisodeAsWatched', true);
    return newProgress;
  } catch (error) {
    console.error(`[API ERROR] İşlem başarısız, eski haline (Rollback) dönülüyor!`, error);
    logError('mutations.progress.markEpisodeAsWatched', error);
    recordMutationResult('markEpisodeAsWatched', false);
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
      persistShowProgressMap(updated);
      return updated;
    });

    recordMutationResult('unwatchEpisode', true);
    return newProgress;
  } catch (error) {
    console.error(`[API ERROR] İşlem başarısız, eski haline (Rollback) dönülüyor!`, error);
    logError('mutations.progress.unwatchEpisode', error);
    recordMutationResult('unwatchEpisode', false);
    if (previousState !== null) {
      setShowProgressMap((prev: any) => {
        const updated = { ...prev, [showId]: previousState };
        persistShowProgressMap(updated);
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
      persistShowProgressMap(updated);
      return updated;
    });

    recordMutationResult('unwatchSeason', true);
    return newProgress;
  } catch (error) {
    console.error(`[API ERROR] İşlem başarısız, eski haline (Rollback) dönülüyor!`, error);
    logError('mutations.progress.unwatchSeason', error);
    recordMutationResult('unwatchSeason', false);
    if (previousState !== null) {
      setShowProgressMap((prev: any) => {
        const updated = { ...prev, [showId]: previousState };
        persistShowProgressMap(updated);
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
  reactivateShowTracking(showId);

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
      persistShowProgressMap(updated);
      return updated;
    });

    recordMutationResult('markSeasonAsWatched', true);
    return newProgress;
  } catch (error) {
    console.error(`[API ERROR] Sezon işaretleme başarısız, eski haline dönülüyor!`, error);
    logError('mutations.progress.markSeasonAsWatched', error);
    recordMutationResult('markSeasonAsWatched', false);
    if (previousState !== null) {
      setShowProgressMap((prev: any) => ({ ...prev, [showId]: previousState }));
    }
    throw error;
  }
};

// Trakt'ın /sync/history uç noktası her POST'ta yeni bir "izlenme" (play) ekler
// — aynı sezonu ikinci kez göndermek, önce geçmişi silmeden doğrudan "tekrar
// izlendi" anlamına gelir. Bu yüzden markSeasonAsWatched'ın aynısı, sadece
// niyeti (ve ayrı optimistic UI mesajını) netleştirmek için ayrı isimle.
export const rewatchSeason = async (showId: number, season: number) => {
  return markSeasonAsWatched(showId, season);
};

export const markEpisodesUpToAsWatched = async (showId: number, season: number, episodes: number[]) => {
  let previousState: any = null;
  console.log(`[OPTIMISTIC UI] Bölümler toplu UI'da işaretleniyor: Show ${showId}, S${season}`);
  reactivateShowTracking(showId);

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
      persistShowProgressMap(updated);
      return updated;
    });

    recordMutationResult('markEpisodesUpToAsWatched', true);
    return newProgress;
  } catch (error) {
    console.error(`[API ERROR] Toplu bölüm işaretleme başarısız, eski haline dönülüyor!`, error);
    logError('mutations.progress.markEpisodesUpToAsWatched', error);
    recordMutationResult('markEpisodesUpToAsWatched', false);
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
    recordMutationResult('markMovieAsWatched', true);
  } catch (error) {
    console.error(`[API ERROR] Film işaretleme başarısız, eski haline dönülüyor!`, error);
    logError('mutations.progress.markMovieAsWatched', error);
    recordMutationResult('markMovieAsWatched', false);
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
