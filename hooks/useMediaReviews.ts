import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getMyTraktSlug } from '../services/api/myIdentity';
import { fetchMediaReviews } from '../features/feed/services/feedApi';
import { getMySupabaseUserId } from '../features/feed/services/userBlocks';
import { setLike } from '../features/feed/services/feedSocial';
import { publishReview, deleteReview } from '../features/feed/services/feedReviews';
import { FeedActivity, FeedMediaType } from '../features/feed/types';

/**
 * Dizi/film detay sayfasının "KaymakTV İncelemeleri" bölümü.
 *
 * ⚠️ `hooks/useComments.ts` ile KARIŞTIRILMASIN — o, Trakt'ın kendi yorum
 * sistemini okur (`Trakt Topluluğu` bölümü) ve aynı ekranda BU hook'un
 * YANINDA çalışır. İkisi bilinçli olarak ayrı: birleşik bir liste, kimlik
 * uyuşmazlığı ve "bu yanıt nereye gidiyor?" belirsizliği üretirdi
 * (bkz. docs/design/REVIEWS_PLAN.md §4.2).
 *
 * UI/Logic ayrımı (docs/AI_RULES.md §1): ekranlar servis katmanını doğrudan
 * çağırmaz, yalnızca bu hook'u tüketir.
 */

export interface UseMediaReviewsResult {
  reviews: FeedActivity[];
  isLoading: boolean;
  hasError: boolean;
  isSubmitting: boolean;
  /** Kendi incelemem (varsa) — "Yaz" mı "Düzenle" mi gösterileceğini belirler. */
  myReview: FeedActivity | null;
  /** Başkalarının incelemeleri — kendiminki listeden ayrı gösterilir. */
  otherReviews: FeedActivity[];
  /** `tmdbId` henüz çözülmedi — yazma butonunun GEÇİCİ olarak pasif olduğunu ayırt eder. */
  isTmdbIdPending: boolean;
  submitReview: (body: string, spoiler: boolean) => Promise<{ ok: true } | { ok: false; message: string }>;
  removeReview: () => Promise<{ ok: true } | { ok: false; message: string }>;
  toggleReviewLike: (activityId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

interface UseMediaReviewsOptions {
  mediaId: number;
  mediaType: FeedMediaType;
  mediaTitle: string;
  /**
   * ZORUNLU ama geç çözülebilir: `useShowDetail` tmdbId'yi URL'den bilmiyorsa
   * Trakt özetinden öğreniyor. Çözülene kadar `undefined` — bu sürede
   * `canSubmit` false olur ve UI "İnceleme Yaz" butonunu pasif tutar
   * (bkz. docs/design/REVIEWS_PLAN.md §1.2: tmdb_id olmadan satır yazılamaz).
   */
  tmdbId?: number;
  /**
   * "S01E02" — verilirse bölüm sayfasındayız: yalnızca O BÖLÜMÜN incelemeleri
   * listelenir ve yazılan inceleme de bölüme bağlanır (ana akışa düşmez).
   */
  episodeNumber?: string;
}

export function useMediaReviews({
  mediaId,
  mediaType,
  mediaTitle,
  tmdbId,
  episodeNumber,
}: UseMediaReviewsOptions): UseMediaReviewsResult & { canSubmit: boolean } {
  const { accessToken, isGuest } = useAuth();
  const [reviews, setReviews] = useState<FeedActivity[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Yarış koruması — `useActivityFeed.ts`/`useMyMediaComment.ts` ile aynı desen:
  // kullanıcı A dizisinden B'ye hızlıca geçtiğinde A'nın geç dönen yanıtı
  // B'nin listesini ezmemeli.
  const requestIdRef = useRef(0);

  const load = useCallback(
    async (force = false) => {
      const requestId = ++requestIdRef.current;
      if (!mediaId) {
        setReviews([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setHasError(false);
      try {
        // Misafirde `getMySupabaseUserId` null döner — liste yine de
        // gösterilmeli (okuma herkese açık, bkz. REVIEWS_PLAN §4.5). Bu yüzden
        // ikisi PARALEL ve kimlik hatası listeyi düşürmüyor.
        const [list, id] = await Promise.all([
          fetchMediaReviews(mediaId, mediaType, episodeNumber, force),
          getMySupabaseUserId().catch(() => null),
        ]);
        if (requestId !== requestIdRef.current) return;
        setReviews(list);
        setMyUserId(id);
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        // Sessizce boş liste göstermek YASAK (docs/AI_RULES.md §2) — "henüz
        // inceleme yok" ile "yüklenemedi" farklı şeyler, UI ikisini ayrı
        // gösterir ve ikincisinde "Tekrar Dene" sunar.
        console.warn('[Reviews] İncelemeler yüklenemedi:', error);
        setHasError(true);
      } finally {
        if (requestId === requestIdRef.current) setIsLoading(false);
      }
    },
    [mediaId, mediaType, episodeNumber]
  );

  useEffect(() => {
    load();
  }, [load]);

  const myReview = myUserId ? reviews.find((r) => r.user.id === myUserId) ?? null : null;
  const otherReviews = myUserId ? reviews.filter((r) => r.user.id !== myUserId) : reviews;

  // tmdbId henüz çözülmediyse yazma engellenir — Worker da, DB CHECK'i de
  // reddederdi; kullanıcıyı butona bastırıp hata göstermek yerine erkenden
  // pasif tutmak doğru olan (üç katmanlı doğrulama, FEED_SOCIAL_PLAN §3.5).
  const canSubmit = !isGuest && !!accessToken && !!tmdbId && !!mediaTitle;

  const submitReview = useCallback(
    async (body: string, spoiler: boolean): Promise<{ ok: true } | { ok: false; message: string }> => {
      if (isGuest) return { ok: false, message: 'Bu işlem için giriş yapmalısın.' };
      if (!tmdbId) return { ok: false, message: 'Yapım bilgisi henüz yüklenmedi, birazdan tekrar dene.' };

      setIsSubmitting(true);
      try {
        const mySlug = await getMyTraktSlug().catch(() => null);
        const result = await publishReview(
          { body, spoiler, showId: mediaId, mediaType, showTitle: mediaTitle, tmdbId, episodeNumber },
          mySlug
        );

        // v2: tek yazma hedefi kaldığı için "kısmen yazıldı" diye bir ara durum
        // YOK — `traktOk` sinyali de bu yüzden kalktı. Hata mesajı olduğu gibi
        // yukarı geçiyor; `WriteReviewSheet` sheet'i açık bırakıp metni koruyor.
        if (!result.ok) return { ok: false, message: result.message };

        // Sunucu satırını (gerçek id, sayaçlar, kullanıcı bilgisi) geri
        // okuyoruz — eksik alanlı sahte bir satır uydurmaktansa listeyi
        // tazelemek daha güvenilir (`useFeedComments.submitComment` ile aynı
        // gerekçe; inceleme sık yapılan bir eylem değil, maliyeti düşük).
        await load(true);
        return { ok: true };
      } finally {
        setIsSubmitting(false);
      }
    },
    [isGuest, tmdbId, mediaId, mediaType, mediaTitle, episodeNumber, load]
  );

  const removeReview = useCallback(async (): Promise<{ ok: true } | { ok: false; message: string }> => {
    if (!myReview) return { ok: false, message: 'Silinecek bir incelemen yok.' };

    setIsSubmitting(true);
    const previous = reviews;
    // İyimser: kart hemen kalksın. Başarısızlıkta geri alınır (akıştaki
    // silme deseniyle aynı).
    setReviews((list) => list.filter((r) => r.id !== myReview.id));
    try {
      const mySlug = await getMyTraktSlug().catch(() => null);
      const result = await deleteReview(
        myReview.id,
        { showId: mediaId, mediaType, episodeNumber },
        mySlug
      );
      if (!result.ok) {
        setReviews(previous);
        return result;
      }
      return { ok: true };
    } finally {
      setIsSubmitting(false);
    }
  }, [myReview, reviews, mediaId, mediaType, episodeNumber]);

  const toggleReviewLike = useCallback(
    async (activityId: string) => {
      if (!accessToken || isGuest) return;
      const target = reviews.find((r) => r.id === activityId);
      if (!target) return;

      const nextLiked = !target.isLikedByMe;
      const applyLocal = (liked: boolean, delta: number) =>
        setReviews((list) =>
          list.map((r) =>
            r.id === activityId
              ? { ...r, isLikedByMe: liked, likeCount: Math.max(0, r.likeCount + delta) }
              : r
          )
        );

      applyLocal(nextLiked, nextLiked ? 1 : -1);
      try {
        await setLike(accessToken, 'activity', activityId, nextLiked);
      } catch (error) {
        console.warn('[Reviews] Beğeni gönderilemedi:', error);
        applyLocal(!nextLiked, nextLiked ? -1 : 1); // geri al
      }
    },
    [accessToken, isGuest, reviews]
  );

  return {
    reviews,
    myReview,
    otherReviews,
    isLoading,
    hasError,
    isSubmitting,
    canSubmit,
    // MediaCommentsSection'ın "yükleniyor" notu İÇİN: `canSubmit=false`
    // birden fazla sebepten olabilir (misafir, token yok, tmdbId gecikmesi)
    // — yalnızca SONUNCUSU geçici, UI bu ikisini ayırt edebilmeli.
    isTmdbIdPending: !tmdbId,
    submitReview,
    removeReview,
    toggleReviewLike,
    refresh: () => load(true),
  };
}
