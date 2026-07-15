import { useState, useEffect } from 'react';
import { getEpisodeTmdbCast } from '../services/tmdbApi';

export function useEpisodeCast(tmdbId: number | null | undefined, season: number, episode: number) {
  const [cast, setCast] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    if (!tmdbId || isNaN(season) || isNaN(episode)) return;

    const fetchCast = async () => {
      setIsLoading(true);
      try {
        const episodeCast = await getEpisodeTmdbCast(tmdbId, season, episode);
        if (isMounted) setCast(episodeCast);
      } catch (error) {
        console.error('Bölüm oyuncuları yüklenirken hata:', error);
        if (isMounted) setCast([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchCast();

    return () => {
      isMounted = false;
    };
  }, [tmdbId, season, episode]);

  // Future feature: Vote for the best actor in the episode
  const voteActor = async (actorId: number) => {
    // API logic to save user's vote
    console.log(`Oyuncu ${actorId} için oy verildi (yakında aktif edilecek)`);
    // update state, etc.
  };

  return {
    cast,
    isLoading,
    voteActor,
  };
}
