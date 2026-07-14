import { useState, useEffect } from 'react';
import { getEpisodeDetail, getEpisodeComments } from '../services/traktApi';
import { getEpisodeStill } from '../services/tmdbApi';
import { cacheManager } from '../utils/cacheManager';

interface EpisodeMediaData {
  detail: any;
  comments: any[];
  stillUrl: string | null;
  cast: any[];
}

export const useEpisodeDetail = (
  showId: string | string[] | undefined,
  showTmdbId: string | string[] | undefined,
  season: string | string[] | undefined,
  episode: string | string[] | undefined
) => {
  const [mediaData, setMediaData] = useState<EpisodeMediaData>({
    detail: null,
    comments: [],
    stillUrl: null,
    cast: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let isMounted = true;
    
    if (!showId || !season || !episode) {
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      try {
        const traktIdNum = parseInt(showId as string, 10);
        const tmdbIdNum = parseInt(showTmdbId as string, 10);
        const sNum = parseInt(season as string, 10);
        const eNum = parseInt(episode as string, 10);

        // Fetch cast and backdrop from Show Cache (v2)
        const cacheKey = `@show_detail_v2_${traktIdNum}`;
        const cachedShowContent = await cacheManager.get<any>(cacheKey);
        
        let castData: any[] = [];
        let fallbackBackdrop = null;
        
        if (cachedShowContent) {
          if (cachedShowContent.cast) {
            castData = cachedShowContent.cast.slice(0, 5);
          }
          if (cachedShowContent.summary?.images?.backdrop) {
            fallbackBackdrop = cachedShowContent.summary.images.backdrop;
          }
        }

        const results = await Promise.allSettled([
          getEpisodeDetail(traktIdNum, sNum, eNum),
          getEpisodeComments(traktIdNum, sNum, eNum),
          getEpisodeStill(tmdbIdNum, sNum, eNum)
        ]);

        const detailRes = results[0].status === 'fulfilled' ? results[0].value : null;
        const commentsRes = results[1].status === 'fulfilled' ? results[1].value : [];
        let stillRes = results[2].status === 'fulfilled' ? results[2].value : null;

        if (!stillRes) {
          stillRes = fallbackBackdrop;
        }

        if (isMounted) {
          setMediaData({
            detail: detailRes,
            comments: commentsRes || [],
            stillUrl: stillRes,
            cast: castData
          });
        }
      } catch (e) {
        console.error('Error loading episode detail:', e);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadData();
    
    return () => { isMounted = false; };
  }, [showId, showTmdbId, season, episode, refreshTrigger]);

  const refreshData = () => setRefreshTrigger(prev => prev + 1);

  return { mediaData, isLoading, refreshData };
};
