import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMovieSummary, getRelatedMovies, getMediaComments } from '../services/traktApi';
import { getMovieBackdrop, getMovieTrailer, getMoviePoster, getTmdbCast } from '../services/tmdbApi';
import { invalidateMovieDetailCache } from '../services/library/mutations/invalidation';

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

  const fetchDetails = useCallback(async (isMountedRef?: { current: boolean }) => {
    if (!traktIdNum) return;
    const alive = () => !isMountedRef || isMountedRef.current;

    // Görseller ekranı BLOKLAMAZ: dizi detayındaki desenle aynı — arka planda
    // çekilir, geldiğinde belirir. (Eskiden spinner 3 TMDB isteğini bekliyordu.)
    const fetchImagesInBackground = (finalTmdbId: number) => {
      Promise.all([
        getMovieBackdrop(finalTmdbId),
        getMovieTrailer(finalTmdbId),
        getMoviePoster(finalTmdbId),
      ]).then(([bd, tr, pst]) => {
        if (alive()) setImages({ backdrop: bd, trailerId: tr, poster: pst });
      }).catch(() => {});
    };

    // Yorumlar da bloklamaz (önbelleğe alınmadıkları için her açılışta tazelenir).
    const fetchCommentsInBackground = () => {
      getMediaComments(traktIdNum, 'movie').then((commRes) => {
        if (alive()) setMediaData(prev => ({ ...prev, comments: commRes.data || [] }));
      }).catch(() => {});
    };

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

      if (summary) {
        // CACHE HIT: sayfa anında açılır; yorumlar arka planda gelir.
        fetchCommentsInBackground();
      } else {
        // CACHE MISS: tmdbId genelde URL'den (liste kartından) zaten biliniyor —
        // eskiden cast isteği Trakt verisi bittikten SONRA atılıyordu (fazladan
        // bir round-trip = filmlerin dizilere göre yavaş hissettirmesinin
        // sebebiydi). Artık tmdbId hazırsa cast isteği Trakt batch'iyle PARALEL başlar.
        const eagerCastPromise = safeTmdbId
          ? getTmdbCast(safeTmdbId, 'movie').catch(() => [])
          : null;

        const results = await Promise.allSettled([
          getMovieSummary(traktIdNum),
          getRelatedMovies(traktIdNum),
          getMediaComments(traktIdNum, 'movie')
        ]);

        summary = results[0].status === 'fulfilled' ? results[0].value : null;
        related = results[1].status === 'fulfilled' ? results[1].value : [];
        const comments = results[2].status === 'fulfilled' ? results[2].value?.data || [] : [];

        if (alive()) setMediaData(prev => ({ ...prev, comments }));

        if (eagerCastPromise) {
          cast = await eagerCastPromise;
        } else {
          // tmdbId URL'de yoktu — ancak şimdi Trakt özetinden öğrenildi.
          const finalTmdbId = summary?.ids?.tmdb;
          if (finalTmdbId) {
            try {
              cast = await getTmdbCast(finalTmdbId, 'movie');
            } catch (e) {
              cast = [];
            }
          } else {
            cast = [];
          }
        }

        const slimRelated = related.map((r: any) => ({
          title: r.title,
          ids: { trakt: r.ids?.trakt, tmdb: r.ids?.tmdb, slug: r.ids?.slug }
        }));

        // Önbelleğe yazma artık ekranın açılmasını BEKLETMİYOR (fire-and-forget).
        AsyncStorage.setItem(cacheKey, JSON.stringify({
          timestamp: Date.now(),
          data: { summary, cast, related: slimRelated }
        })).catch(async () => {
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
        });
      }

      const mappedRelated = (related || []).map((item: any) => ({
        id: item.ids?.trakt,
        rawTraktId: item.ids?.trakt,
        tmdbId: item.ids?.tmdb,
        title: item.title
      }));

      if (alive()) {
        setMediaData(prev => ({ ...prev, summary, cast: cast || [], related: mappedRelated }));
      }

      const finalTmdbId = safeTmdbId || summary?.ids?.tmdb;
      if (finalTmdbId) {
        fetchImagesInBackground(finalTmdbId);
      }
    } catch (error) {
      console.error('Hata:', error);
    } finally {
      if (alive()) setIsLoading(false);
    }
  }, [traktIdNum, safeTmdbId]);

  useEffect(() => {
    const isMountedRef = { current: true };
    fetchDetails(isMountedRef);
    return () => { isMountedRef.current = false; };
  }, [fetchDetails]);

  // ESKİ DAVRANIŞ: doğrudan fetchDetails() çağırıyordu — fetchDetails de önce
  // diskteki önbelleği kontrol ettiğinden (TTL: 24 saat), TTL dolmadıysa bu
  // bir no-op'tu (aynı bayat veri geri dönüyordu). Artık önce disk önbelleği
  // açıkça temizleniyor, böylece fetchDetails() gerçek bir ağ isteği atmak
  // zorunda kalıyor — bkz. hooks/useShowDetail.ts'teki aynı düzeltme.
  const refreshData = async () => {
    await invalidateMovieDetailCache(traktIdNum);
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
