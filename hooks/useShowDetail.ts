import { useState, useEffect, useMemo } from 'react';
import { getShowSummary, getShowSeasons, getShowCast, getRelatedShows, getMediaComments } from '../services/traktApi';
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
      const cacheKey = `@show_detail_v2_${traktIdNum}`;
      
      let cachedContent = await cacheManager.get<any>(cacheKey);
      let summary = null, seasons = null, cast = null, related = null;

      if (cachedContent) {
        summary = cachedContent.summary;
        seasons = cachedContent.seasons;
        cast = cachedContent.cast;
        related = cachedContent.related;
      }

      if (!summary) {
        const results = await Promise.allSettled([
          getShowSummary(traktIdNum),
          getShowSeasons(traktIdNum),
          getShowCast(traktIdNum),
          getRelatedShows(traktIdNum),
          getMediaComments(traktIdNum, 'show')
        ]);
        
        summary = results[0].status === 'fulfilled' ? results[0].value : null;
        seasons = results[1].status === 'fulfilled' ? results[1].value : [];
        cast = results[2].status === 'fulfilled' ? results[2].value?.cast || [] : [];
        related = results[3].status === 'fulfilled' ? results[3].value : [];
        
        const comments = results[4].status === 'fulfilled' ? results[4].value?.data || [] : [];
        
        const slimSeasons = seasons.map((s: any) => ({
          number: s.number,
          aired_episodes: s.aired_episodes || 0,
          episodes: (s.episodes || []).map((ep: any) => ({
            number: ep.number,
            title: ep.title,
            first_aired: ep.first_aired,
            ids: { trakt: ep?.ids?.trakt }
          }))
        }));
        
        const slimCast = cast.map((c: any) => ({
          characters: c.characters,
          person: {
            name: c.person?.name,
            ids: { trakt: c.person?.ids?.trakt }
          }
        }));
        
        const slimRelated = related.map((r: any) => ({
          title: r.title,
          ids: { trakt: r.ids?.trakt, tmdb: r.ids?.tmdb, slug: r.ids?.slug }
        }));

        await cacheManager.set(cacheKey, { summary, seasons: slimSeasons, cast: slimCast, related: slimRelated });
        
        if (isMounted) {
          setMediaData({ summary, seasons: slimSeasons, cast: slimCast, related: slimRelated, comments });
        }
      } else {
        // Cached verileri set et
        if (isMounted) {
          setMediaData(prev => ({ ...prev, summary, seasons, cast, related }));
        }
        // Comments önbelleğe alınmadığı için her zaman fetch edilir.
        try {
          const commRes = await getMediaComments(traktIdNum, 'show');
          if (isMounted && commRes?.data) {
            setMediaData(prev => ({ ...prev, comments: commRes.data }));
          }
        } catch (e) {}
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
