import { useMemo } from 'react';
import { useLibrarySelector } from '../context/LibraryContext';

export type StatsTab = 'shows' | 'movies';

export interface ProfileStatsSummary {
  totalMinutes: number;
  episodesWatched: number;
  moviesWatched: number;
}

export interface ProfileStatsCompletion {
  started: number;
  finished: number;
}

/**
 * "Detaylı Analiz" ekranının tüm gerçek veri türetme mantığı burada toplanır.
 * Ekran/bileşenler yalnızca döndürülen sayıları biçimlendirip gösterir.
 */
export function useProfileStatistics(activeTab: StatsTab) {
  const { userStats, watchedShows, watchedMovies, watchlistMovies, showProgressMap } = useLibrarySelector((s) => ({
    userStats: s.userStats,
    watchedShows: s.watchedShows,
    watchedMovies: s.watchedMovies,
    watchlistMovies: s.watchlistMovies,
    showProgressMap: s.showProgressMap,
  }));

  const summary = useMemo<ProfileStatsSummary>(() => ({
    totalMinutes: (userStats?.episodes.minutes || 0) + (userStats?.movies.minutes || 0),
    episodesWatched: userStats?.episodes.watched || 0,
    moviesWatched: userStats?.movies.watched || 0,
  }), [userStats]);

  // Diziler: "başlanan" = kütüphanede izlenen dizi sayısı, "biten" = ilerleme
  // haritasında yayınlanan tüm bölümlere yetişmiş (completed >= aired) diziler.
  // Filmler: dizilerdeki "bölüm" kavramı olmadığından, izleme listesi + izlenen
  // havuzundan kaçının fiilen izlendiği oran olarak yorumlanır.
  const completion = useMemo<ProfileStatsCompletion>(() => {
    if (activeTab === 'shows') {
      const started = watchedShows?.length || 0;
      const finished = (watchedShows || []).filter((item: any) => {
        const id = item?.show?.ids?.trakt;
        const progress = id ? showProgressMap?.[id] : null;
        return !!progress && progress.aired > 0 && progress.completed >= progress.aired;
      }).length;
      return { started, finished };
    }

    const finished = watchedMovies?.length || 0;
    const started = finished + (watchlistMovies?.length || 0);
    return { started, finished };
  }, [activeTab, watchedShows, watchedMovies, watchlistMovies, showProgressMap]);

  return { summary, completion, hasStats: !!userStats };
}
