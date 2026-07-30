import { useState, useEffect } from 'react';
import { getUserWatchedShows, getUserWatchedMovies } from '../../../services/api/social';

export function usePublicProfileLibrary(slug: string | null) {
  const [shows, setShows] = useState<any[]>([]);
  const [movies, setMovies] = useState<any[]>([]);
  const [isLoadingShows, setIsLoadingShows] = useState(false);
  const [isLoadingMovies, setIsLoadingMovies] = useState(false);

  useEffect(() => {
    if (!slug) {
      setShows([]);
      return;
    }

    let cancelled = false;
    setIsLoadingShows(true);

    (async () => {
      try {
        const data = await getUserWatchedShows(slug);
        if (!cancelled) setShows(data);
      } catch (error) {
        console.warn('[PublicProfileLibrary] Diziler yüklenemedi:', error);
      } finally {
        if (!cancelled) setIsLoadingShows(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!slug) {
      setMovies([]);
      return;
    }

    let cancelled = false;
    setIsLoadingMovies(true);

    (async () => {
      try {
        const data = await getUserWatchedMovies(slug);
        if (!cancelled) setMovies(data);
      } catch (error) {
        console.warn('[PublicProfileLibrary] Filmler yüklenemedi:', error);
      } finally {
        if (!cancelled) setIsLoadingMovies(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return { shows, movies, isLoadingShows, isLoadingMovies };
}
