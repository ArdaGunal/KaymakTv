import { useState, useEffect, useMemo } from 'react';
import { getShowSummary, getShowSeasons, getRelatedShows, getMediaComments } from '../services/traktApi';
import { getTmdbCast } from '../services/tmdbApi';
import { cacheManager } from '../utils/cacheManager';
import { invalidateShowDetailCache } from '../services/library/mutations/invalidation';

interface MediaData {
  summary: any;
  seasons: any[];
  cast: any[];
  related: any[];
  comments: any[];
}

// showProgress: TÜM showProgressMap DEĞİL, yalnızca BU dizinin ilerleme
// nesnesi (çağıran taraf granüler bir Zustand selector'ıyla — örn.
// useLibrarySelector(s => s.showProgressMap[traktIdNum]) — besler). Bu sayede
// kütüphanedeki BAŞKA bir dizinin ilerlemesi (örn. arka plan senkronu)
// değiştiğinde bu nesnenin referansı SABİT kalır ve aşağıdaki useMemo
// gereksiz yere tekrar çalışmaz.
export const useShowDetail = (traktIdNum: number, tmdbId: string | string[] | undefined, showProgress: any) => {
  const [mediaData, setMediaData] = useState<MediaData>({
    summary: null,
    seasons: [],
    cast: [],
    related: [],
    comments: []
  });
  const [isLoading, setIsLoading] = useState(true);
  // Yorumlar AYRI bir yükleme durumu taşır — bkz. aşağıdaki S12 notu. Ekranın
  // geri kalanı açıldıktan sonra Trakt bloğu kendi spinner'ıyla gelebilsin diye.
  const [isLoadingComments, setIsLoadingComments] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let isMounted = true;
    if (!traktIdNum) return;

    /**
     * ⚠️ S12 — YORUMLAR EKRANI BLOKLAMAZ.
     *
     * ESKİ DAVRANIŞ (hata): `getMediaComments`, önbellek-ıska yolundaki
     * `Promise.allSettled([summary, seasons, related, comments])` batch'inin
     * İÇİNDEYDİ. `allSettled` HEPSİNİN bitmesini beklediği için, Trakt'ın
     * yorum uç noktası yavaşladığında dizinin ÖZETİ, SEZONLARI ve tüm ekran
     * onu bekliyordu — kendi Supabase verimiz hazır olsa bile.
     *
     * Önbellek-İSABET yolu bunu zaten doğru yapıyordu (fire-and-forget); iki
     * yol arasındaki bu tutarsızlık düzeltildi. Artık yorumlar HER İKİ yolda da
     * bağımsız yükleniyor ve istek en başta, önbellek okumasıyla PARALEL
     * başlıyor.
     *
     * Trakt tamamen çökerse: `catch` boş listeye düşer, ekran açık kalır
     * (bkz. docs/REVIEWS_PLAN.md §4.1).
     */
    const loadCommentsInBackground = () => {
      setIsLoadingComments(true);
      getMediaComments(traktIdNum, 'show')
        .then((commRes) => {
          if (isMounted) setMediaData(prev => ({ ...prev, comments: commRes?.data || [] }));
        })
        .catch(() => {
          // Sessizce boş liste — Trakt bloğu gizlenir, sayfa çalışmaya devam
          // eder (kullanıcı kararı: "Trakt bloğu yoksa sessizce gizlensin").
          if (isMounted) setMediaData(prev => ({ ...prev, comments: [] }));
        })
        .finally(() => {
          if (isMounted) setIsLoadingComments(false);
        });
    };

    const loadData = async () => {
      setIsLoading(true);
      // Önbellek okumasıyla PARALEL başlat — hiçbir şeyi beklemez.
      loadCommentsInBackground();
      const cacheKey = `@show_detail_v3_${traktIdNum}`;
      
      let cachedContent = await cacheManager.get<any>(cacheKey);
      // `seasons`/`cast`/`related` her yolda (cache hit veya taze çekim) daima
      // gerçek bir diziyle doldurulur — hiçbir zaman kavramsal olarak "null"
      // değildir, bu yüzden `[]` başlangıç değeriyle `any[]` (nullable olmayan)
      // tiplendi; `MediaData` arayüzüyle de böylece birebir eşleşir.
      let summary: any = null;
      let seasons: any[] = [];
      let cast: any[] = [];
      let related: any[] = [];

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

        // Yorumlar bu batch'te DEĞİL — bilinçli (S12, yukarıdaki not).
        const results = await Promise.allSettled([
          getShowSummary(traktIdNum),
          getShowSeasons(traktIdNum),
          getRelatedShows(traktIdNum)
        ]);

        summary = results[0].status === 'fulfilled' ? results[0].value : null;
        seasons = results[1].status === 'fulfilled' ? results[1].value : [];
        related = results[2].status === 'fulfilled' ? results[2].value : [];

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
          // ⚠️ FONKSİYONEL GÜNCELLEME ŞART: yorumlar artık PARALEL yükleniyor ve
          // bu satırdan ÖNCE gelmiş olabilir. Nesneyi komple değiştirmek
          // (`setMediaData({...})`) o sırada gelmiş yorumları SİLERDİ — yarış
          // durumu. `prev` üzerinden yazınca yorumlar korunur.
          setMediaData(prev => ({ ...prev, summary, seasons: slimSeasons, cast: slimCast, related: slimRelated }));
        }
      } else {
        // CACHE HIT: sayfa anında açılır. Yorumlar zaten yukarıda,
        // `loadCommentsInBackground` ile paralel başlatıldı.
        if (isMounted) {
          setMediaData(prev => ({ ...prev, summary, seasons, cast, related }));
        }
      }

      if (isMounted) setIsLoading(false);
    };

    loadData();
    return () => { isMounted = false; };
  }, [traktIdNum, tmdbId, refreshTrigger]);

  // Pre-calculate `isWatchedLocal` out of the render loop (Resolves find inside loop).
  const computedSeasons = useMemo(() => {
    if (!mediaData.seasons) return [];

    // Sezon numarası → ilerleme nesnesi eşlemesi: eskiden HER sezon için
    // showProgress.seasons dizisinde .find() ile O(sezon_sayısı) taranıyordu.
    const seasonProgressByNumber = new Map<number, any>(
      (showProgress?.seasons || []).map((s: any) => [s.number, s])
    );

    return mediaData.seasons.map((season: any) => {
      const seasonProgress = seasonProgressByNumber.get(season.number);

      // Bölüm numarası → completed eşlemesi: eskiden sezonun HER bölümü için
      // seasonProgress.episodes dizisinde .find() ile O(bölüm_sayısı) taranıyordu
      // — büyük sezonlarda (örn. 500+ bölümlü animeler) bu gerçek bir O(n²)
      // darboğazıydı (bölüm sayısı × bölüm sayısı). Artık sezon başına bir kez
      // Map kurulup her bölüm O(1) okunuyor.
      const completedByEpisodeNumber = new Map<number, boolean>(
        (seasonProgress?.episodes || []).map((e: any) => [e.number, !!e.completed])
      );

      return {
        ...season,
        isSeasonWatchedLocal: seasonProgress ? seasonProgress.completed > 0 : false,
        // Ham ilerleme nesnesi de taşınır: SeasonAccordion'ın ihtiyaç duyduğu
        // ekstra alanlar (completed/aired sayısı vb.) için çağıran taraf artık
        // showProgressMap üzerinde AYRI bir .find() daha yapmak zorunda değil
        // (bkz. app/show/[id].tsx — season.seasonProgress doğrudan kullanılır).
        seasonProgress: seasonProgress || null,
        episodes: season.episodes?.map((ep: any) => ({
          ...ep,
          isWatchedLocal: completedByEpisodeNumber.get(ep.number) || false
        })) || []
      };
    });
  }, [mediaData.seasons, showProgress]);


  return {
    mediaData,
    computedSeasons,
    isLoading,
    isLoadingComments,
    // ESKİ DAVRANIŞ: yalnızca refreshTrigger'ı artırıyordu — loadData() diskteki
    // önbelleği (TTL dolmadıysa) hâlâ HIT sayıp aynı bayat veriyi döndürüyordu,
    // yani bu bir no-op'tu. Artık önce disk önbelleği açıkça temizleniyor,
    // böylece bir sonraki loadData() gerçek bir ağ isteği atmak zorunda kalıyor.
    // NOT: Ayrı bir `refreshComments` YOK. S12'den beri yorumlar her effect
    // çalışmasında `loadCommentsInBackground` ile zaten tazeleniyor, yani
    // `refreshData` onları da kapsıyor. (Eski `refreshComments`'ın tek
    // tüketicisi `MediaReviewsSection.onPublished`'di — inceleme Trakt'a DA
    // yazıldığı dönemde Trakt listesi bayatladığı için gerekiyordu; v2'de
    // Trakt'a yazmadığımız için o gerekçe düştü.)
    refreshData: async () => {
      await invalidateShowDetailCache(traktIdNum);
      setRefreshTrigger(prev => prev + 1);
    },
  };
};
