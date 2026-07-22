import { useEffect, useMemo } from 'react';
import { useLibrarySelector } from '../context/LibraryContext';
import { useTrackingStore } from '../store/tracking/useTrackingStore';
import {
  categorizeMovies,
  MOVIE_CATEGORY_KEYS,
  type MovieCategoryKey,
} from '../store/tracking/movieTrackingLogic';
import type { LibraryItem } from './useLibraryTypeData';
import {
  emptyStatusIndex,
  useFilterResult,
  useMediaFilterState,
  type MediaStatusIndex,
  type UseLibraryFiltersResult,
} from './libraryFilterCore';

/**
 * Kütüphane "Filmler" ekranının lokal süzme hook'u — dizi tarafındaki
 * `useLibraryShowFilters` ile aynı iskelet, tek farkı kategori kaynağının
 * `categorizeMovies` olması (3 kategori: İzlenenler / İzlenecekler / Bırakılanlar).
 */
export type { MovieCategoryKey };
export { MOVIE_CATEGORY_KEYS };

const STATIC_LABELS = { unnamedMovie: '' };

const EMPTY_INDEX = emptyStatusIndex<MovieCategoryKey>();

/**
 * Kategori indeksi. `enabled` false iken kategorizasyon HİÇ çalıştırılmaz.
 */
function useMovieStatusIndex(enabled: boolean): MediaStatusIndex<MovieCategoryKey> {
  const { watchedMovies, watchlistMovies } = useLibrarySelector((s) => ({
    watchedMovies: s.watchedMovies,
    watchlistMovies: s.watchlistMovies,
  }));

  const droppedMovieIds = useTrackingStore((s) => s.droppedMovieIds);
  const hydrate = useTrackingStore((s) => s.hydrate);

  // "Bırakılanlar" filtresinin doğru çalışması için elle yapılan işaretlemelerin
  // diskten okunmuş olması şart; hydrate idempotent (tek sefer çalışır).
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return useMemo(() => {
    if (!enabled) return EMPTY_INDEX;

    const categories = categorizeMovies({
      watchedMovies: watchedMovies || [],
      watchlistMovies: watchlistMovies || [],
      droppedMovieIds,
      labels: STATIC_LABELS,
    });

    const statusOf = new Map<number, MovieCategoryKey>();
    for (const key of MOVIE_CATEGORY_KEYS) {
      for (const card of categories[key]) statusOf.set(card.id, key);
    }

    // Ekranın varsayılan listesi `watchedMovies` — yani İZLENENLER. "İzlenecekler"
    // ve izleme listesinden gelen "Bırakılanlar" o listede HİÇ bulunmaz; havuza
    // katılmasalardı bu iki seçenek hiçbir zaman sonuç döndüremezdi. (Filtre
    // kapalıyken havuza girmedikleri için ekranın varsayılan içeriği ve
    // "Toplam" sayısı değişmez.)
    const watchedIds = new Set<number>();
    for (const item of watchedMovies || []) {
      const id = item?.movie?.ids?.trakt;
      if (id != null) watchedIds.add(id);
    }

    const extraPool: LibraryItem[] = [];
    for (const key of MOVIE_CATEGORY_KEYS) {
      for (const card of categories[key]) {
        if (watchedIds.has(card.id)) continue;
        // Anahtar öneki kütüphane öğeleriyle ÇAKIŞMAMALI ('movie-…' onların).
        extraPool.push({ key: `mextra-${card.id}`, id: card.id, title: card.title, tmdbId: card.tmdbId });
      }
    }

    return { statusOf, extraPool };
  }, [enabled, watchedMovies, watchlistMovies, droppedMovieIds]);
}

export type UseLibraryMovieFiltersResult = UseLibraryFiltersResult<MovieCategoryKey>;

export function useLibraryMovieFilters(
  data: LibraryItem[],
  enabled: boolean
): UseLibraryMovieFiltersResult {
  const state = useMediaFilterState(MOVIE_CATEGORY_KEYS, enabled);
  const index = useMovieStatusIndex(enabled && state.activeStatuses.length > 0);
  return useFilterResult(data, enabled, state, index);
}
