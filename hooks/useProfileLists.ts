import { useState, useEffect, useCallback } from 'react';
import { getCustomListItems } from '../services/traktApi';
import { getShowPoster, getMoviePoster } from '../services/tmdbApi';

export interface EnrichedList {
  id: number | string;
  title: string;
  itemCount: number;
  coverImageUrl: string | null;
}

/**
 * Profil sayfasındaki listeleri kapak görselleriyle birlikte çeker.
 * Her listenin ilk öğesinin posteri Promise.all ile paralel yüklenir.
 */
export function useProfileLists(
  customLists: any[],
  isLibraryLoading: boolean
): { lists: EnrichedList[]; isLoading: boolean } {
  const [lists, setLists] = useState<EnrichedList[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const enrichLists = useCallback(async () => {
    if (!customLists || customLists.length === 0) {
      setLists([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      // Tüm listeler için ilk öğeyi paralel çek (waterfall yok)
      const enriched = await Promise.all(
        customLists.map(async (item: any) => {
          const listId = item.ids?.trakt;
          const base: EnrichedList = {
            id: listId,
            title: item.name,
            itemCount: item.item_count ?? 0,
            coverImageUrl: null,
          };

          if (!listId) return base;

          try {
            const items = await getCustomListItems(listId);
            const first = items?.[0];
            if (!first) return base;

            const tmdbId = first.show?.ids?.tmdb || first.movie?.ids?.tmdb;
            if (!tmdbId) return base;

            const isMovie = !!first.movie;
            const url = isMovie
              ? await getMoviePoster(tmdbId)
              : await getShowPoster(tmdbId);

            return { ...base, coverImageUrl: url };
          } catch {
            return base;
          }
        })
      );

      setLists(enriched);
    } catch (err) {
      console.error('[useProfileLists] enrichLists error:', err);
      setLists(
        customLists.map((item: any) => ({
          id: item.ids?.trakt,
          title: item.name,
          itemCount: item.item_count ?? 0,
          coverImageUrl: null,
        }))
      );
    } finally {
      setIsLoading(false);
    }
  }, [customLists]);

  useEffect(() => {
    if (!isLibraryLoading) {
      enrichLists();
    }
  }, [isLibraryLoading, enrichLists]);

  return { lists, isLoading };
}
