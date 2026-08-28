import { useEffect, useState } from 'react';
import { getTrendingShows } from '../services/api/shows';
import { getTrendingMovies } from '../services/api/movies';
import { getShowPoster, getMoviePoster } from '../services/tmdbApi';

// Karşılama ekranının hero arkaplanı için: trend gösterip trend film/dizi
// afişlerinden bir "poster duvarı" oluşturur. Trakt trending uçları misafir
// (kimliksiz) istekleri de kabul eder — bkz. traktClient.ts'teki not — bu
// yüzden giriş öncesi ekranda güvenle çağrılabilir. Tek seferlik bağlanma
// isteği (sonsuz döngü yok), Trakt/TMDB proxy'lerindeki rate limit'e girmez.
const POSTER_TARGET = 18;

export function useLandingPosterWall() {
  const [posters, setPosters] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [showsRes, moviesRes] = await Promise.allSettled([
          getTrendingShows(1, 12),
          getTrendingMovies(1, 12),
        ]);

        const shows = showsRes.status === 'fulfilled' ? showsRes.value : [];
        const movies = moviesRes.status === 'fulfilled' ? moviesRes.value : [];

        const showIds: number[] = (shows || [])
          .map((item: any) => item?.show?.ids?.tmdb)
          .filter((id: any): id is number => !!id);
        const movieIds: number[] = (movies || [])
          .map((item: any) => item?.movie?.ids?.tmdb)
          .filter((id: any): id is number => !!id);

        // Diziler ve filmleri birbirine serpiştir — art arda aynı tür gelmesin.
        const targets: { id: number; type: 'show' | 'movie' }[] = [];
        const max = Math.max(showIds.length, movieIds.length);
        for (let i = 0; i < max; i++) {
          if (showIds[i]) targets.push({ id: showIds[i], type: 'show' });
          if (movieIds[i]) targets.push({ id: movieIds[i], type: 'movie' });
        }

        const results = await Promise.allSettled(
          targets
            .slice(0, POSTER_TARGET)
            .map((t) => (t.type === 'show' ? getShowPoster(t.id) : getMoviePoster(t.id)))
        );

        const urls = results
          .map((r) => (r.status === 'fulfilled' ? r.value : null))
          .filter((url): url is string => !!url);

        if (!cancelled) setPosters(urls);
      } catch {
        // Poster duvarı sadece dekoratif — sessiz düşüş kabul edilebilir,
        // hero zaten posterse gerek kalmadan da gösterilebilir tasarlandı.
        if (!cancelled) setPosters([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return posters;
}
