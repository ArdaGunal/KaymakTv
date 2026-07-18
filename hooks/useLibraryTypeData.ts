import { useCallback, useEffect, useState } from 'react';
import {
  getWatchedShows,
  getWatchedMovies,
  getCustomLists,
  getLikedShows,
  getLikedMovies,
} from '../services/traktApi';

export type LibraryType = 'shows' | 'movies' | 'favShows' | 'favMovies' | 'lists';

export interface LibraryItem {
  id: number | undefined;
  title: string | undefined;
  tmdbId: number | undefined;
}

function mapMediaItems(items: any[], itemType: 'show' | 'movie'): LibraryItem[] {
  return items.map((item: any) => ({
    id: itemType === 'show' ? item.show?.ids?.trakt : item.movie?.ids?.trakt,
    title: itemType === 'show' ? item.show?.title : item.movie?.title,
    tmdbId: itemType === 'show' ? item.show?.ids?.tmdb : item.movie?.ids?.tmdb,
  }));
}

const TITLE_KEYS: Record<LibraryType, string> = {
  shows: 'shows',
  movies: 'movies',
  favShows: 'favShows',
  favMovies: 'favMovies',
  lists: 'lists',
};

export function getLibraryTitleKey(type: string | string[] | undefined): string {
  if (typeof type === 'string' && type in TITLE_KEYS) {
    return TITLE_KEYS[type as LibraryType];
  }
  return 'library';
}

// Shared by app/(protected)/library/[type].web.tsx and screens/LibraryMobile.tsx so
// both platforms fetch the exact same Trakt data through the exact same functions.
export function useLibraryTypeData(type: string | string[] | undefined, accessToken: string | null | undefined) {
  const [data, setData] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let newItems: LibraryItem[] = [];

      if (type === 'shows') {
        const res = await getWatchedShows();
        const sorted = [...res].sort((a: any, b: any) => new Date(b.last_watched_at).getTime() - new Date(a.last_watched_at).getTime());
        newItems = mapMediaItems(sorted, 'show');
      } else if (type === 'movies') {
        const res = await getWatchedMovies();
        const sorted = [...res].sort((a: any, b: any) => new Date(b.last_watched_at).getTime() - new Date(a.last_watched_at).getTime());
        newItems = mapMediaItems(sorted, 'movie');
      } else if (type === 'favShows') {
        const res = await getLikedShows();
        newItems = mapMediaItems(res, 'show');
      } else if (type === 'favMovies') {
        const res = await getLikedMovies();
        newItems = mapMediaItems(res, 'movie');
      } else if (type === 'lists') {
        const res = await getCustomLists();
        newItems = res.map((item: any) => ({
          id: item.ids?.trakt,
          title: item.name,
          tmdbId: undefined,
        }));
      }

      setData(newItems);
    } catch (error) {
      console.log('Kütüphane verisi çekme hatası:', error);
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    if (accessToken) {
      fetchData();
    }
  }, [accessToken, type, fetchData]);

  return { data, loading };
}
