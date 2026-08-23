import axios from 'axios';
import * as SecureStore from '../../../utils/secureStorage';
import { recordApiLatency, recordMutationResult } from '../../../utils/metrics';
import { logError } from '../../../utils/errorLog';
import { FeedMediaType } from '../types';
import {
  deleteActivitiesBulk,
  invalidateFeedCache,
  invalidateMediaReviewsCache,
  invalidateUserFeedActivitiesCache,
} from './feedApi';

/**
 * İNCELEME (Review) — istemci yazma katmanı.
 *
 * ⚠️ v2 (Trakt'tan kopuş): inceleme artık YALNIZCA bizim veritabanımıza
 * yazılır. Trakt'a hiçbir şey gitmez (bkz. docs/design/REVIEWS_PLAN.md v2 §1).
 *
 * v1'DEN NE GİTTİ:
 *  - `traktOk` kısmi-başarısızlık sinyali — tek yazma hedefi kaldığı için
 *    "Trakt'ta var ama bizde yok" diye bir ara durum artık mümkün DEĞİL.
 *  - `deleteFeedItemsRouted` (tipe göre silme yönlendiricisi) — silme artık
 *    tüm aktivite tipleri için tek yol: `/feed/delete`.
 *  - `invalidateUserCommentsCache` çağrısı — o önbellek Trakt'ın kendi yorum
 *    listesinindi; inceleme akışı ona artık hiç dokunmuyor.
 *
 * `services/api/comments.ts` ile karıştırılmasın: orası Trakt yorumlarını
 * OKUMA servisi (dizi sayfasındaki "Trakt topluluğu" bloğu).
 */

const KAYMAK_WORKER_URL = process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL || '';

export interface PublishableReview {
  body: string;
  spoiler: boolean;
  /** Yapım ZORUNLU — 'posted'tan farklı olarak inceleme daima bir yapım hakkındadır. */
  showId: number;
  mediaType: FeedMediaType;
  showTitle: string;
  /**
   * ZORUNLU. Worker `tmdbId` yoksa isteği baştan reddeder ve DB'de de CHECK
   * var (019) — Trakt'tan bağımsızlaşmanın tek dayanağı bu alan
   * (bkz. docs/design/REVIEWS_PLAN.md §2.2). Çağıran, tmdbId çözülene kadar
   * "İnceleme Yaz" butonunu pasif tutmalı.
   */
  tmdbId: number;
  /**
   * "S01E02" — verilirse bu bir BÖLÜM incelemesidir. Worker biçimi doğruluyor
   * ve `mediaType !== 'show'` ise reddediyor.
   *
   * Bölüm incelemeleri ana akışa DÜŞMEZ: `020` migration'ındaki `in_feed`
   * türetilmiş kolonu bunları akış sorgusundan otomatik eliyor.
   */
  episodeNumber?: string;
}

export type ReviewResult =
  | { ok: true; activityId: string; updated: boolean }
  | { ok: false; message: string };

/** Yayın/silme sonrası bayat kalabilecek önbellekleri tek yerden temizler. */
function invalidateAfterReviewChange(
  showId: number | undefined,
  mediaType: FeedMediaType | undefined,
  traktSlug?: string | null,
  episodeNumber?: string
): void {
  // Yapım bilgisi yoksa (yalnızca akış kartından silmede olabilir) o sayfanın
  // önbelleği atlanır — kendi TTL'iyle (60sn) zaten tazelenir.
  if (showId && mediaType) invalidateMediaReviewsCache(showId, mediaType, episodeNumber);
  invalidateFeedCache();
  if (traktSlug) invalidateUserFeedActivitiesCache(traktSlug);
}

/**
 * İncelemeyi yayınlar (yoksa oluşturur, varsa günceller).
 *
 * ATEŞLE-VE-UNUT DEĞİL: kullanıcı compose ekranında sonucu BEKLİYOR, bu yüzden
 * başarı/başarısızlık geri döndürülür — çağıran (WriteReviewSheet) hata
 * durumunda sheet'i AÇIK bırakıp metni korur (bkz. oradaki "tünel problemi"
 * notu).
 */
export async function publishReview(
  input: PublishableReview,
  myTraktSlug?: string | null
): Promise<ReviewResult> {
  if (!KAYMAK_WORKER_URL) {
    return { ok: false, message: 'Sunucu adresi tanımlı değil.' };
  }

  const token = await SecureStore.getItemAsync('traktAccessToken');
  if (!token) return { ok: false, message: 'Oturum bulunamadı.' };

  // Damga İSTEMCİDE üretilip Worker'a gönderiliyor. Gerekçe R6 (bkz.
  // docs/design/REVIEWS_PLAN.md): sunucu kendi zamanını yazarsa Realtime yankısı
  // akıştaki kartla eşleşmez ve aynı inceleme iki kart görünür.
  const activityAt = new Date().toISOString();

  const start = Date.now();
  try {
    const response = await axios.post(
      `${KAYMAK_WORKER_URL}/feed/review`,
      {
        traktAccessToken: token,
        body: input.body,
        spoiler: input.spoiler,
        showId: input.showId,
        mediaType: input.mediaType,
        showTitle: input.showTitle,
        tmdbId: input.tmdbId,
        episodeNumber: input.episodeNumber,
        activityAt,
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
    );

    if (!response.data?.success) {
      return { ok: false, message: response.data?.message || 'İnceleme paylaşılamadı.' };
    }

    // Worker'ın güncel sürümle deploy edildiğini doğrula — `feedPublish.ts`'teki
    // `published` alanı kontrolüyle AYNI sınıf koruma: eski bir Worker sürümü
    // isteği tanımayıp farklı bir işleyiciye düşürüp yine `success: true`
    // dönebilirdi (bkz. HISTORY Madde 146).
    const activityId = response.data?.activity?.id;
    if (typeof activityId !== 'string') {
      throw new Error(
        'İnceleme uç noktası yanıt vermedi — Worker güncel sürümle deploy edilmiş mi? (/feed/review)'
      );
    }

    invalidateAfterReviewChange(input.showId, input.mediaType, myTraktSlug, input.episodeNumber);
    recordMutationResult('publishReview', true);
    return { ok: true, activityId, updated: response.data?.updated === true };
  } catch (error: any) {
    recordMutationResult('publishReview', false);
    logError('feedReviews.publishReview', error);
    console.warn('[Feed] İnceleme paylaşılamadı:', error);
    return {
      ok: false,
      message: error?.response?.data?.message || error?.message || 'İnceleme paylaşılamadı.',
    };
  } finally {
    recordApiLatency('worker.feed.review', Date.now() - start);
  }
}

/**
 * İncelemeyi siler.
 *
 * ⚠️ v2: AYRI bir uç nokta YOK. İnceleme artık yalnızca bizde yaşadığı için
 * silme, diğer tüm aktivitelerle AYNI yoldan (`/feed/delete`) gider. Bu
 * fonksiyon yalnızca ince bir sarmalayıcı: `deleteActivitiesBulk`'a ek olarak
 * YAPIM BAZLI inceleme önbelleğini de geçersiz kılıyor (o önbelleği
 * `deleteActivitiesBulk` bilmez).
 */
export async function deleteReview(
  activityId: string,
  media: { showId?: number; mediaType?: FeedMediaType; episodeNumber?: string },
  myTraktSlug?: string | null
): Promise<{ ok: true } | { ok: false; message: string }> {
  const token = await SecureStore.getItemAsync('traktAccessToken');
  if (!token) return { ok: false, message: 'Oturum bulunamadı.' };

  try {
    await deleteActivitiesBulk(token, [activityId]);
    invalidateAfterReviewChange(media.showId, media.mediaType, myTraktSlug, media.episodeNumber);
    recordMutationResult('deleteReview', true);
    return { ok: true };
  } catch (error: any) {
    recordMutationResult('deleteReview', false);
    logError('feedReviews.deleteReview', error);
    console.warn('[Feed] İnceleme silinemedi:', error);
    return {
      ok: false,
      message: error?.response?.data?.message || error?.message || 'İnceleme silinemedi.',
    };
  }
}
