import { useEffect, useState } from 'react';
import { getShowBackdrop, getShowTrailer, getShowPoster } from '../services/tmdbApi';

/**
 * Dizi sayfasının TMDB görselleri (arka plan, afiş, fragman). M513'te
 * `app/show/[id].tsx`'ten taşındı (400 satır sınırı; veri çekme hook'ta).
 * Davranış aynı: üçü paralel, ekran kapandıysa yazılmaz, hata yalnız loglanır.
 */
export function useShowTmdbGorselleri(etkinTmdbId: string | number | null | undefined) {
  const [backdrop, setBackdrop] = useState<string | null>(null);
  const [poster, setPoster] = useState<string | null>(null);
  const [trailerId, setTrailerId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchTmdb = async () => {
      if (etkinTmdbId) {
        const tmdbIdNum = parseInt(String(etkinTmdbId), 10);
        try {
          const [bd, tr, pst] = await Promise.all([
            getShowBackdrop(tmdbIdNum),
            getShowTrailer(tmdbIdNum),
            getShowPoster(tmdbIdNum)
          ]);
          if (isMounted) {
            setBackdrop(bd);
            setTrailerId(tr);
            setPoster(pst);
          }
        } catch (error) {
          console.error('TMDB veri çekme hatası (show detail):', error);
        }
      }
    };
    fetchTmdb();
    return () => { isMounted = false; };
  }, [etkinTmdbId]);

  return { backdrop, poster, trailerId };
}
