import { useState, useEffect, useMemo } from 'react';
import { getShowSummary, getShowSeasons, getRelatedShows, getMediaComments } from '../services/traktApi';
import { getTmdbCast } from '../services/tmdbApi';
import { cacheManager } from '../utils/cacheManager';

interface MediaData {
  summary: any;
  seasons: any[];
  cast: any[];
  related: any[];
  comments: any[];
}

export const useShowDetail = (traktIdNum: number, tmdbId: string | string[] | undefined, showProgressMap: any) => {
  const [mediaData, setMediaData] = useState<MediaData>({
    summary: null,
    seasons: [],
    cast: [],
    related: [],
    comments: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let isMounted = true;
    if (!traktIdNum) return;

    const loadData = async () => {
      setIsLoading(true);
      const cacheKey = `@show_detail_v3_${traktIdNum}`;
      
      let cachedContent = await cacheManager.get<any>(cacheKey);
      let summary = null, seasons = null, cast = null, related = null;

      if (cachedContent) {
        summary = cachedContent.summary;
        seasons = cachedContent.seasons;
        cast = cachedContent.cast;
        related = cachedContent.related;
      }

      if (!summary) {
        // tmdbId genelde URL'den (liste kartından) zaten biliniyor — eskiden cast
        // isteği Trakt verisi bittikten SONRA atılıyordu (fazladan bir round-trip).
        // Artık tmdbId hazırsa cast isteği Trakt batch'iyle PARALEL başlar.
        const knownTmdbId = tmdbId ? Number(tmdbId) : null;
        const eagerCastPromise = knownTmdbId
          ? getTmdbCast(knownTmdbId, 'tv').catch(() => [])
          : null;

        const results = await Promise.allSettled([
          getShowSummary(traktIdNum),
          getShowSeasons(traktIdNum),
          getRelatedShows(traktIdNum),
          getMediaComments(traktIdNum, 'show')
        ]);

        summary = results[0].status === 'fulfilled' ? results[0].value : null;
        seasons = results[1].status === 'fulfilled' ? results[1].value : [];
        related = results[2].status === 'fulfilled' ? results[2].value : [];
        const comments = results[3].status === 'fulfilled' ? results[3].value?.data || [] : [];

        if (eagerCastPromise) {
          cast = await eagerCastPromise;
        } else {
          // tmdbId URL'de yoktu — ancak şimdi Trakt özetinden öğrenildi.
          const finalTmdbId = summary?.ids?.tmdb;
          if (finalTmdbId) {
            try {
              cast = await getTmdbCast(finalTmdbId, 'tv');
            } catch (e) {
              cast = [];
            }
          } else {
            cast = [];
          }
        }

        const slimSeasons = seasons
          .filter((s: any) => s.number >= 0 && s.episodes && s.episodes.length > 0)
          .map((s: any) => ({
          number: s.number,
          aired_episodes: s.aired_episodes || 0,
          episodes: (s.episodes || []).map((ep: any) => ({
            number: ep.number,
            title: ep.title,
            first_aired: ep.first_aired,
            ids: { trakt: ep?.ids?.trakt }
          }))
        }));
        
        // getTmdbCast already formats the cast into a slim version with profile pictures
        const slimCast = cast;
        
        const slimRelated = related.map((r: any) => ({
          title: r.title,
          ids: { trakt: r.ids?.trakt, tmdb: r.ids?.tmdb, slug: r.ids?.slug }
        }));

        // Önbelleğe yazma artık ekranın açılmasını BEKLETMİYOR (fire-and-forget).
        cacheManager.set(cacheKey, { summary, seasons: slimSeasons, cast: slimCast, related: slimRelated });

        if (isMounted) {
          setMediaData({ summary, seasons: slimSeasons, cast: slimCast, related: slimRelated, comments });
        }
      } else {
        // CACHE HIT: sayfa anında açılır. Yorumlar önbelleğe alınmadığı için
        // her zaman tazelenir ama artık ekranı BEKLETMİYOR (fire-and-forget) —
        // eskiden isLoading, yorumlar bitene kadar true kalıyordu.
        if (isMounted) {
          setMediaData(prev => ({ ...prev, summary, seasons, cast, related }));
        }
        getMediaComments(traktIdNum, 'show').then((commRes) => {
          if (isMounted && commRes?.data) {
            setMediaData(prev => ({ ...prev, comments: commRes.data }));
          }
        }).catch(() => {});
      }

      if (isMounted) setIsLoading(false);
    };

    loadData();
    return () => { isMounted = false; };
  }, [traktIdNum, tmdbId, refreshTrigger]);

  // Pre-calculate `isWatchedLocal` out of the render loop (Resolves find inside loop)
  const computedSeasons = useMemo(() => {
    if (!mediaData.seasons) return [];
    
    return mediaData.seasons.map((season: any) => {
      const seasonProgress = showProgressMap[traktIdNum]?.seasons?.find((s:any) => s.number === season.number);
      
      return {
        ...season,
        isSeasonWatchedLocal: seasonProgress ? seasonProgress.completed > 0 : false,
        episodes: season.episodes?.map((ep: any) => {
          const isWatchedLocal = seasonProgress?.episodes?.find((e:any) => e.number === ep.number)?.completed;
          return {
            ...ep,
            isWatchedLocal: !!isWatchedLocal
          };
        }) || []
      };
    });
  }, [mediaData.seasons, showProgressMap, traktIdNum]);

  const refreshComments = async () => {
    try {
      const commRes = await getMediaComments(traktIdNum, 'show');
      setMediaData(prev => ({ ...prev, comments: commRes?.data || [] }));
    } catch (e) {}
  };

  return {
    mediaData,
    computedSeasons,
    isLoading,
    refreshData: () => setRefreshTrigger(prev => prev + 1),
    refreshComments
  };
};
