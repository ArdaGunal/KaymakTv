import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMovieSummary, getRelatedMovies, getMediaComments } from '../services/traktApi';
import { getMovieBackdrop, getMovieTrailer, getMoviePoster, getTmdbCast } from '../services/tmdbApi';

export function useMovieDetail(traktIdNum: number, tmdbIdStr: string | string[] | undefined) {
  const [mediaData, setMediaData] = useState<{
    summary: any;
    cast: any[];
    related: any[];
    comments: any[];
  }>({ summary: null, cast: [], related: [], comments: [] });
  
  const [images, setImages] = useState<{
    backdrop: string | null;
    poster: string | null;
    trailerId: string | null;
  }>({ backdrop: null, poster: null, trailerId: null });

  const [isLoading, setIsLoading] = useState(true);

  const tmdbIdNum = tmdbIdStr ? parseInt(tmdbIdStr as string, 10) : null;
  const safeTmdbId = tmdbIdNum && !isNaN(tmdbIdNum) ? tmdbIdNum : null;

  const fetchDetails = useCallback(async () => {
    if (!traktIdNum) return;
    try {
      setIsLoading(true);

      const cacheKey = `@movie_detail_v4_cache_${traktIdNum}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      
      let summary: any, cast: any[] = [], related: any[] = [];

      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < 1000 * 60 * 60 * 24) { // 24 saat cache
          summary = parsed.data.summary;
          cast = parsed.data.cast;
          related = parsed.data.related;
        }
      }

      if (!summary) {
        const results = await Promise.allSettled([
          getMovieSummary(traktIdNum),
          getRelatedMovies(traktIdNum),
          getMediaComments(traktIdNum, 'movie')
        ]);
        
        summary = results[0].status === 'fulfilled' ? results[0].value : null;
        related = results[1].status === 'fulfilled' ? results[1].value : [];
        const comments = results[2].status === 'fulfilled' ? results[2].value?.data || [] : [];
        
        setMediaData(prev => ({ ...prev, comments }));

        // TMDB Cast Fetching Logic
        const finalTmdbId = safeTmdbId ? safeTmdbId : summary?.ids?.tmdb;
        if (finalTmdbId) {
          try {
            cast = await getTmdbCast(finalTmdbId, 'movie');
          } catch (e) {
            cast = [];
          }
        } else {
          cast = [];
        }
        
        const slimRelated = related.map((r: any) => ({
          title: r.title,
          ids: { trakt: r.ids?.trakt, tmdb: r.ids?.tmdb, slug: r.ids?.slug }
        }));

        try {
          await AsyncStorage.setItem(cacheKey, JSON.stringify({
            timestamp: Date.now(),
            data: { summary, cast, related: slimRelated }
          }));
        } catch(cacheErr) {
          console.warn('[Cache Kaydetme Hatası] Kota doldu. Eski cacheler temizleniyor...');
          try {
            const allKeys = await AsyncStorage.getAllKeys();
            const cacheKeys = allKeys.filter(k => 
              k.startsWith('@show_detail_') || 
              k.startsWith('@episode_detail_') || 
              k.startsWith('@movie_detail_')
            );
            
            if (cacheKeys.length > 0) {
              await AsyncStorage.multiRemove(cacheKeys);
              await AsyncStorage.setItem(cacheKey, JSON.stringify({
                timestamp: Date.now(),
                data: { summary, cast, related: slimRelated }
              }));
            }
          } catch(e) {
            console.error('Önbellek temizlenirken hata:', e);
          }
        }
      }

      const mappedRelated = (related || []).map((item: any) => ({
        id: item.ids?.trakt,
        rawTraktId: item.ids?.trakt,
        tmdbId: item.ids?.tmdb,
        title: item.title
      }));

      setMediaData(prev => ({ ...prev, summary, cast: cast || [], related: mappedRelated }));

      if (safeTmdbId || summary?.ids?.tmdb) {
        const finalTmdbId = safeTmdbId || summary.ids.tmdb;
        const [bd, tr, pst] = await Promise.all([
          getMovieBackdrop(finalTmdbId),
          getMovieTrailer(finalTmdbId),
          getMoviePoster(finalTmdbId)
        ]);
        setImages({ backdrop: bd, trailerId: tr, poster: pst });
      }

      if (summary && !mediaData.comments.length) {
         try {
           const commRes = await getMediaComments(traktIdNum, 'movie');
           setMediaData(prev => ({ ...prev, comments: commRes.data || [] }));
         } catch(e) {}
      }
    } catch (error) {
      console.error('Hata:', error);
    } finally {
      setIsLoading(false);
    }
  }, [traktIdNum, safeTmdbId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const refreshData = () => {
    fetchDetails();
  };

  const refreshComments = async () => {
    try {
      const commRes = await getMediaComments(traktIdNum, 'movie');
      setMediaData(prev => ({ ...prev, comments: commRes.data || [] }));
    } catch(e) {}
  };

  return { mediaData, images, isLoading, refreshData, refreshComments };
}
