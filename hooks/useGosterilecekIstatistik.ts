import { useMemo } from 'react';
import { useLibrarySelector } from '../context/LibraryContext';
import { gosterilecekIstatistik, yerelIstatistik } from '../utils/yerelIstatistik';

/**
 * Profil kartları (mobil + web) ve «Detaylı Analiz»in ortak izleme özeti — aynı hesap üç yerde
 * kopya duruyordu (§C17.2). Sayım tekil, süre ve tekrar her izlemeyi kapsar; hiç izleme yoksa `null`.
 */
export function useGosterilecekIstatistik() {
  const { watchedShows, watchedMovies, showProgressMap } = useLibrarySelector((s) => ({
    watchedShows: s.watchedShows,
    watchedMovies: s.watchedMovies,
    showProgressMap: s.showProgressMap,
  }));
  return useMemo(
    () => gosterilecekIstatistik(yerelIstatistik(watchedShows, watchedMovies, showProgressMap)),
    [watchedShows, watchedMovies, showProgressMap],
  );
}
