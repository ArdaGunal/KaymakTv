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
  // Yorumlar AYRI yükleme durumu taşır — bkz. aşağıdaki S12 notu.
  const [isLoadingComments, setIsLoadingComments] = useState(true);
  /**
   * 🔴 Y17: bu alan EKSİKTİ ve ekran hata durumunda SAHTE VERİ çiziyordu.
   *
   * `getEpisodeDetail` başarısız olduğunda `detail` null kalıyor, ekran ise
   * `episodeData?.title || t('episodeNum')` gibi fallback'lerle sayfayı
   * BAŞARIYLA AÇILMIŞ gibi çiziyordu: "Bölüm 5 · Henüz özet yok · Tarih yok".
   * Daha kötüsü `first_aired` boş kaldığı için "TBA" rozeti çıkıyor ve
   * "İzledim" butonu tamamen kayboluyordu — yani Trakt çöktüğü için
   * kullanıcıya "bu bölüm henüz yayınlanmadı" deniyordu. Boş ekrandan kötü:
   * uygulama YALAN söylüyordu.
   */
  const [hasError, setHasError] = useState(false);
  // Y22 (F15 cihaz testi, HISTORY Madde 194): devre kesici reddi de
  // `hasError`'a düşüyordu ve `LoadFailedState` gerçek ağ hatasıyla AYNI
  // genel mesajı gösteriyordu. Devre 5 art arda hatada 30sn boyunca isteği
  // ağa hiç göndermez (bkz. utils/circuitBreaker.ts) — kullanıcı internet
  // geri geldikten sonra "Tekrar Dene"ye bassa bile devre süresi dolana
  // kadar aynı hatayı görüyor ve "tekrar dene çalışmıyor" sanıyordu.
  const [isCircuitBreakerError, setIsCircuitBreakerError] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let isMounted = true;
    
    if (!showId || !season || !episode) {
      setIsLoading(false);
      return;
    }

    /**
     * ⚠️ S12 — YORUMLAR EKRANI BLOKLAMAZ.
     *
     * `useShowDetail`/`useMovieDetail`'de düzeltilen AYNI hata burada da vardı
     * ama o turda bu hook GÖZDEN KAÇMIŞTI: `getEpisodeComments` bloklayan
     * `Promise.allSettled` batch'inin içindeydi, yani bölümün DETAYI ve
     * GÖRSELİ Trakt'ın yorum ucunu bekliyordu.
     *
     * Trakt çökerse: boş listeye düşer, ekran açık kalır (Karar 10).
     */
    const loadCommentsInBackground = (traktIdNum: number, sNum: number, eNum: number) => {
      setIsLoadingComments(true);
      getEpisodeComments(traktIdNum, sNum, eNum)
        .then((comments) => {
          if (isMounted) setMediaData(prev => ({ ...prev, comments: comments || [] }));
        })
        .catch(() => {
          if (isMounted) setMediaData(prev => ({ ...prev, comments: [] }));
        })
        .finally(() => {
          if (isMounted) setIsLoadingComments(false);
        });
    };

    const loadData = async () => {
      setIsLoading(true);
      setHasError(false);
      setIsCircuitBreakerError(false);
      try {
        const traktIdNum = parseInt(showId as string, 10);
        const tmdbIdNum = showTmdbId ? parseInt(showTmdbId as string, 10) : NaN;
        const sNum = parseInt(season as string, 10);
        const eNum = parseInt(episode as string, 10);

        // Önbellek okumasıyla PARALEL başlat — hiçbir şeyi beklemez.
        loadCommentsInBackground(traktIdNum, sNum, eNum);

        // Fetch cast and backdrop from Show Cache — useShowDetail'in yazdığı
        // güncel anahtarla aynı olmalı, aksi halde burası hep boş döner.
        const cacheKey = `@show_detail_v3_${traktIdNum}`;
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

        // Yorumlar bu batch'te DEĞİL — bilinçli (S12, yukarıdaki not).
        const results = await Promise.allSettled([
          getEpisodeDetail(traktIdNum, sNum, eNum),
          !isNaN(tmdbIdNum) ? getEpisodeStill(tmdbIdNum, sNum, eNum) : Promise.resolve(null)
        ]);

        const detailRes = results[0].status === 'fulfilled' ? results[0].value : null;
        let stillRes = results[1].status === 'fulfilled' ? results[1].value : null;

        if (!stillRes) {
          stillRes = fallbackBackdrop;
        }

        // Bölümün KENDİ verisi gelmediyse bu bir hatadır. `stillUrl` ve `cast`

        // eksikliği hata DEĞİL — onlar süsleme, fallback'leri var.

        if (isMounted && !detailRes) {
          setHasError(true);
          if (results[0].status === 'rejected' && (results[0].reason as any)?.isCircuitBreakerRejection) {
            setIsCircuitBreakerError(true);
          }
        }


        if (isMounted) {
          // FONKSİYONEL GÜNCELLEME ŞART: yorumlar paralel yükleniyor ve bu
          // satırdan ÖNCE gelmiş olabilir; nesneyi komple değiştirmek onları
          // silerdi (useShowDetail'de yakalanan aynı yarış durumu).
          setMediaData(prev => ({
            ...prev,
            detail: detailRes,
            stillUrl: stillRes,
            cast: castData
          }));
        }
      } catch (e) {
        console.error('Error loading episode detail:', e);
        if (isMounted) {
          setHasError(true);
          if ((e as any)?.isCircuitBreakerRejection) setIsCircuitBreakerError(true);
        }
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

  return { mediaData, isLoading, isLoadingComments, hasError, isCircuitBreakerError, refreshData };
};
