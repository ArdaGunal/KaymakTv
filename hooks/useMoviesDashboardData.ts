import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getDateGroup, isFutureDate } from '../utils/dateHelper';

// Bugüne göre kalan gün sayısı (gece yarısı bazlı)
const daysUntil = (dateObj: Date): number => {
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const targetDate = new Date(dateObj);
  targetDate.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((targetDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 ? diffDays : 0;
};

// Film ekranlarının (mobil + web) ORTAK veri harmanlama hook'u.
// Eskiden hem screens/MoviesMobile.tsx hem app/(protected)/(tabs)/movies.web.tsx
// bu mantığı "processData" adıyla kopya olarak taşıyordu.
export const useMoviesDashboardData = (
  watchlistMovies: any[],
  calendarMovies: any[],
  i18nLanguage: string
) => {
  const { t } = useTranslation('media');

  return useMemo(() => {
    // 1. Watchlist (İzleme Listesi) — gelecek tarihliler takvime taşınır
    const watchlistTemp: any[] = [];
    const farFutureTemp: any[] = [];

    for (const item of watchlistMovies) {
      const traktId = item?.movie?.ids?.trakt;
      if (!traktId) continue;
      const movie = item.movie;

      const releaseDateStr = movie.released;
      const isAired = releaseDateStr ? !isFutureDate(releaseDateStr) : true;

      const formattedObj = {
        id: traktId,
        tmdbId: movie?.ids?.tmdb,
        title: (movie?.title || t('unnamedMovie')).toUpperCase(),
        year: movie.year,
        releaseDate: releaseDateStr,
        image: null,
        tags: ['WATCHLIST'],
      };

      if (isAired) {
        watchlistTemp.push(formattedObj);
      } else {
        farFutureTemp.push({ ...formattedObj, first_aired: releaseDateStr, tags: [] });
      }
    }

    // 2. Takvim (Yaklaşanlar)
    const upcomingTemp: any[] = [];
    const seenMovies = new Set();

    for (const item of calendarMovies) {
      const traktId = item?.movie?.ids?.trakt;
      if (!traktId) continue;
      const movie = item.movie;

      if (seenMovies.has(traktId)) continue;
      seenMovies.add(traktId);

      if (!isFutureDate(movie.released)) continue;

      const dateObj = new Date(movie.released);

      upcomingTemp.push({
        id: traktId,
        title: (movie?.title || t('unnamedMovie')).toUpperCase(),
        year: movie.year,
        releaseDate: movie.released,
        image: null,
        tags: [],
        rawDate: dateObj.getTime(),
        dateGroup: getDateGroup(dateObj, t),
        countdownDays: daysUntil(dateObj),
        tmdbId: movie.ids.tmdb,
      });
    }

    // Uzak gelecek filmleri (watchlist'ten taşınanlar)
    for (const movie of farFutureTemp) {
      if (seenMovies.has(movie.id)) continue;
      seenMovies.add(movie.id);

      if (!isFutureDate(movie.first_aired)) continue;

      const dateObj = new Date(movie.first_aired);
      upcomingTemp.push({
        ...movie,
        rawDate: dateObj.getTime(),
        dateGroup: getDateGroup(dateObj, t),
        countdownDays: daysUntil(dateObj),
      });
    }

    upcomingTemp.sort((a, b) => a.rawDate - b.rawDate);

    return {
      watchlistMoviesList: watchlistTemp,
      upcomingMovies: upcomingTemp,
    };
  }, [watchlistMovies, calendarMovies, i18nLanguage]);
};
