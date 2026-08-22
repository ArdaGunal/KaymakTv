import axios from 'axios';
import * as SecureStore from '../../../utils/secureStorage';
import { getMyTraktSlug } from '../../../services/api/myIdentity';
import { isKaymakSessionToken } from '../../../services/api/traktClient';
import { getUserProfile } from '../../../services/api/social';
import { getMySupabaseUserId } from './userBlocks';
import { useFeedStore } from '../store/feedStore';
import { invalidateFeedCache, invalidateUserFeedActivitiesCache } from './feedApi';
import { FeedActivity, FeedMediaType } from '../types';
import { recordApiLatency, recordMutationResult } from '../../../utils/metrics';
import { logError } from '../../../utils/errorLog';

/**
 * ANINDA YAYIN — bir aktivite Trakt'a yazıldığı ANDA akışa düşer.
 *
 * ESKİ DAVRANIŞ: akışa bir şey düşmesinin TEK yolu, uygulama açılışında
 * çalışan `/feed/sync`ti. Kullanıcı bir bölüm izleyip işaretlediğinde
 * aktivitenin akışta görünmesi için uygulamadan çıkıp geri girmesi
 * gerekiyordu.
 *
 * Şimdi iki aşamalı:
 *   1. İYİMSER (optimistic): kart, ağ beklenmeden ANINDA yerel akışa eklenir
 *      — kullanıcı için gecikme sıfırdır.
 *   2. Worker'a POST /feed/publish: satır Supabase'e yazılır ve Realtime
 *      üzerinden takipçilerin ekranına düşer.
 * Yayın başarısız olursa iyimser kart geri alınır (sessizce kaybolmaz —
 * gerçekte yayınlanmamış bir şeyi "yayınlandı" göstermek yalan olurdu).
 *
 * ÇİFT KAYIT OLUŞMAZ: `activityAt` damgası Trakt'a `watched_at`/`rated_at`
 * olarak AÇIKÇA gönderilen damganın AYNISIDIR (bkz. services/api/users.ts).
 * Sonraki tam senkron Trakt'tan aynı damgayı okur, Worker aynı dedup
 * anahtarını üretir, satır "zaten var" sayılır.
 */

const KAYMAK_WORKER_URL = process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL || '';

/** Yayınlanacak tek bir aktivite — UI'dan bağımsız, saf veri. */
export interface PublishableActivity {
  activityType: 'watched_episode' | 'watched_movie' | 'rated';
  showId: number;
  mediaType: FeedMediaType;
  showTitle: string;
  tmdbId?: number;
  /** "S01E02" — yalnızca watched_episode. Worker bu biçimi zorunlu kılar. */
  episodeNumber?: string;
  /** 1-10 — yalnızca rated. */
  rating?: number;
  /** Trakt'a gönderilen damganın AYNISI olmalı. */
  activityAt: string;
}

/** Trakt'ın beklediği ve dedup anahtarına giren "S01E02" biçimi. */
export const formatEpisodeCode = (season: number, episode: number): string =>
  `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;

/** Yayınlanan aktivitenin damgası — Trakt'a da bunun AYNISI gönderilir. */
export const nowStamp = (): string => new Date().toISOString();

// Kendi kullanıcı bilgim (avatar/isim) — iyimser kartı çizebilmek için gerekli.
// Oturum boyunca değişmez, `getMyTraktSlug` ile aynı gerekçeyle önbelleklenir.
let cachedMe: FeedActivity['user'] | null = null;

async function resolveMe(): Promise<FeedActivity['user'] | null> {
  if (cachedMe) return cachedMe;

  // 🔴 Google-only kullanıcı (`create_new`, Madde 221): `getMyTraktSlug()`
  // null döner ve `getUserProfile('me')` 401 alır — aşağıdaki Trakt yolu bu
  // kullanıcı için ASLA çalışamaz. Canlı testte (2026-08-22) sonuç şuydu:
  // gönderi sunucuya kaydediliyor ama ekranda HİÇBİR ŞEY olmuyordu, kullanıcı
  // "paylaşmadı" sandı. Kimlik/ad/fotoğraf zaten bizde (Worker'ın
  // `/account/profile/get`'i → AuthContext → SecureStore), Trakt'a hiç
  // gitmeden iyimser kart çizilebilir.
  try {
    const token = await SecureStore.getItemAsync('traktAccessToken');
    if (isKaymakSessionToken(token)) {
      const myUserId = await getMySupabaseUserId().catch(() => null);
      if (!myUserId) return null;
      const [username, avatarUrl] = await Promise.all([
        SecureStore.getItemAsync('kaymakMyUsername'),
        SecureStore.getItemAsync('kaymakMyAvatarUrl'),
      ]);
      cachedMe = {
        // Trakt dalının aksine BURADA gerçek Supabase `users.id`'si var —
        // Google-only kimliğin zaten tek anahtarı o (bkz. userBlocks.ts).
        id: myUserId,
        // Bu kullanıcının Trakt slug'ı YOK; akışın "ben" eşleşmesi artık
        // `getVisibleUserIds`'te id üzerinden yapılıyor (bkz. feedApi.ts).
        traktSlug: '',
        username: username || 'Kaymak Kullanıcısı',
        avatarUrl: avatarUrl ?? null,
      };
      return cachedMe;
    }
  } catch (error) {
    console.warn('[Feed] Google-only kimliği çözülemedi (iyimser kart atlanıyor):', error);
    return null;
  }

  try {
    const [slug, profile] = await Promise.all([getMyTraktSlug(), getUserProfile('me')]);
    if (!slug) return null;
    cachedMe = {
      // `id` burada Supabase `users.id`si DEĞİL — onu client hiç bilmiyor.
      // İyimser kart yalnızca ekranda çizilmek için var; sunucu sürümü
      // Realtime/refresh ile geldiğinde gerçek id'li satırla değişiyor.
      id: `me-${slug}`,
      traktSlug: slug,
      username: profile?.username || slug,
      avatarUrl: profile?.images?.avatar?.full ?? null,
    };
    return cachedMe;
  } catch (error) {
    console.warn('[Feed] Kendi profilim çözülemedi (iyimser kart atlanıyor):', error);
    return null;
  }
}

/** Çıkışta ZORUNLU — bkz. myIdentity.clearMyTraktSlug ile aynı gerekçe. */
export function clearFeedPublishIdentity(): void {
  cachedMe = null;
}

/**
 * İyimser kartın geçici id'si — DETERMİNİSTİK.
 *
 * Aynı olayın hem iyimser (client) hem sunucu sürümünden AYNI değeri üretir.
 * Bu sayede Realtime'dan gerçek satır geldiğinde, hangi geçici kartın
 * değiştirileceği ARAMA/TAHMİN gerektirmeden bilinir — "acaba bu benim
 * kartım mı" diye alan alan karşılaştırma yapmaya gerek kalmaz.
 * `temp-` öneki gerçek UUID'lerle çakışmayı imkânsız kılar.
 */
export function tempActivityId(a: {
  activityType: string;
  // Opsiyonel: 'posted' tipi yapım seçilmeden paylaşılabilir (bkz.
  // 017_feed_posts.sql) — `?? ''` ile string'e düşer, benzersizliği zaten
  // activityAt (ms hassasiyetinde) sağlıyor.
  showId?: number;
  episodeNumber?: string | null;
  activityAt: string;
}): string {
  return `temp-${a.activityType}-${a.showId ?? ''}-${a.episodeNumber ?? ''}-${new Date(a.activityAt).getTime()}`;
}

function toOptimisticActivity(activity: PublishableActivity, me: FeedActivity['user']): FeedActivity {
  return {
    id: tempActivityId(activity),
    user: me,
    activityType: activity.activityType,
    showId: activity.showId,
    mediaType: activity.mediaType,
    tmdbId: activity.tmdbId,
    showTitle: activity.showTitle,
    showPosterUrl: null,
    episodeNumber: activity.episodeNumber,
    rating: activity.rating,
    activityAt: activity.activityAt,
    isPending: true,
    // Taze bir yayın — henüz kimse yorum/beğeni bırakmış olamaz. Sunucu
    // sürümü (gerçek sayaçlarla) Realtime yankısıyla bu geçici kartı değiştirir.
    likeCount: 0,
    commentCount: 0,
  };
}

/**
 * Aktiviteleri akışa yayınlar. ATEŞLE-VE-UNUT olarak çağrılmalıdır —
 * kullanıcının "izledim" akışını ASLA bloklamaz.
 */
export async function publishActivities(activities: PublishableActivity[]): Promise<void> {
  if (activities.length === 0) return;
  if (!KAYMAK_WORKER_URL) return;

  const token = await SecureStore.getItemAsync('traktAccessToken');
  if (!token) return; // Misafir/oturumsuz — yayınlanacak bir kimlik yok.

  const me = await resolveMe();
  const store = useFeedStore.getState();

  // 1) İYİMSER: kartlar anında ekranda.
  const optimistic = me ? activities.map((a) => toOptimisticActivity(a, me)) : [];
  optimistic.forEach((card) => store.upsertActivity(card, false));

  const start = Date.now();
  try {
    const response = await axios.post(
      `${KAYMAK_WORKER_URL}/feed/publish`,
      { traktAccessToken: token, activities },
      { headers: { 'Content-Type': 'application/json' }, timeout: 12000 }
    );

    if (!response.data?.success) {
      throw new Error(response.data?.message || 'Yayın reddedildi.');
    }

    // ⚠️ `success: true` TEK BAŞINA YETMEZ. Worker henüz `/feed/publish` ile
    // deploy edilmemişse istek eski sürümde geri bildirim işleyicisine düşüp
    // (bkz. Worker router'ındaki not) yine `{success: true}` döndürebiliyordu
    // — client de aktiviteyi yayınlanmış sanıp iyimser kartı ekranda
    // BIRAKIYORDU. Yayın yanıtına özgü `published` alanını şart koşmak bu
    // sınıf "yanlış başarı"yı kapatır: alan yoksa karşımızdaki uç nokta
    // yayın uç noktası değildir.
    if (typeof response.data?.published !== 'number') {
      throw new Error(
        'Yayın uç noktası yanıt vermedi — Worker güncel sürümle deploy edilmiş mi? (/feed/publish)'
      );
    }

    // Gizlilik ayarı kapalıysa Worker `published: 0` + `skipped` döner —
    // bu bir HATA DEĞİL ama kart da akışta kalmamalı, çünkü gerçekte
    // hiçbir yere yayınlanmadı.
    if (response.data.published === 0 && response.data?.skipped) {
      optimistic.forEach((card) => useFeedStore.getState().removeActivity(card.id));
      return;
    }

    // Sunucu sürümü (gerçek id + kanonik alanlar) bir sonraki tazelemede ya
    // da Realtime yankısıyla gelir; iyimser kart o zaman değiştirilir.
    // Önbellekleri geçersiz kıl ki bir sonraki okuma taze veriyi görsün.
    invalidateFeedCache();
    if (me) invalidateUserFeedActivitiesCache(me.traktSlug);
    recordMutationResult('publishFeedActivity', true);
  } catch (error) {
    // Yayınlanmamış bir şeyi ekranda bırakmak kullanıcıya YALAN olurdu.
    optimistic.forEach((card) => useFeedStore.getState().removeActivity(card.id));
    recordMutationResult('publishFeedActivity', false);
    logError('feedPublish.publishActivities', error);
    console.warn('[Feed] Aktivite yayınlanamadı:', error);
  } finally {
    recordApiLatency('worker.feed.publish', Date.now() - start);
  }
}

// ═════════════════════════════════════════════════════════════════════════
// Bağımsız Gönderi ("Fikir Paylaş") — bkz. supabase/schema/017_feed_posts.sql
// ═════════════════════════════════════════════════════════════════════════
// `publishActivities`'ten (yukarı) FARKLI olarak ATEŞLE-VE-UNUT DEĞİL: bu,
// kullanıcının bir compose ekranında AKTİF olarak beklediği bir eylem —
// başarısız/başarılı sonucu geri döndürülür ki modal doğru geri bildirimi
// gösterebilsin (bkz. useFeedComments.submitComment ile AYNI desen).

export interface PublishablePost {
  body: string;
  spoiler: boolean;
  /** OPSİYONEL — kullanıcı yapım seçmeden de genel bir gönderi paylaşabilir. */
  show?: {
    showId: number;
    mediaType: FeedMediaType;
    showTitle: string;
    tmdbId?: number;
  };
}

function toOptimisticPost(input: PublishablePost, me: FeedActivity['user'], activityAt: string): FeedActivity {
  return {
    id: tempActivityId({ activityType: 'posted', showId: input.show?.showId, activityAt }),
    user: me,
    activityType: 'posted',
    showId: input.show?.showId,
    mediaType: input.show?.mediaType,
    tmdbId: input.show?.tmdbId,
    showTitle: input.show?.showTitle,
    showPosterUrl: null,
    activityAt,
    note: input.body,
    noteSpoiler: input.spoiler,
    isPending: true,
    likeCount: 0,
    commentCount: 0,
  };
}

export async function publishPost(input: PublishablePost): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!KAYMAK_WORKER_URL) return { ok: false, message: 'Sunucu adresi tanımlı değil.' };

  const token = await SecureStore.getItemAsync('traktAccessToken');
  if (!token) return { ok: false, message: 'Oturum bulunamadı.' };

  // ⚠️ `me` YOKLUĞU ARTIK YAYINI ENGELLEMEZ (F4-T9'da bulundu, 2026-08-17).
  //
  // ESKİ DAVRANIŞ: `if (!me) return { ok: false, message: 'Kimliğin
  // doğrulanamadı, tekrar dene.' }`. Sorun şuydu: `resolveMe()` İKİ AĞ ÇAĞRISI
  // yapıyor (`getMyTraktSlug` + `getUserProfile`). Bağlantı yokken ikisi de
  // düşüyor, fonksiyon null dönüyor ve kullanıcı "Kimliğin doğrulanamadı"
  // görüyordu. Görünür geri bildirim VARDI ama YANLIŞ TEŞHİS koyuyordu —
  // sorun kimlikte değil ağdaydı; kullanıcı hesabının bozulduğunu sanıyor,
  // tekrar denemek yerine oturumunu kurcalıyordu.
  //
  // Kimliği zaten Worker token'dan çözüyor (`verifyAndUpsertUser`); `me`
  // BURADA yalnızca iyimser kartı çizmek için. Çizilemiyorsa kart atlanır,
  // gönderi yine de gönderilir ve gerçek hata kendi DOĞRU mesajıyla
  // aşağıdaki catch'ten döner ("Network Error" vb.).
  //
  // Yan fayda: geçici bir Trakt kesintisinde (ağ varken profil ucu düşerse)
  // kullanıcı artık gönderisini kaybetmiyor — eskiden bu da bloke ediyordu.
  const me = await resolveMe();

  // Yalnızca YEREL, geçici karta damga basmak için — 'posted' Trakt'la hiç
  // senkronize olmadığından (bkz. Worker handleFeedPost) sunucunun kendi
  // ürettiği damgayla piksel hassasiyetinde eşleşmesi gerekmiyor; Realtime/
  // yenileme geldiğinde gerçek satır bunun yerini alır.
  const activityAt = nowStamp();
  const store = useFeedStore.getState();
  const optimistic = me ? toOptimisticPost(input, me, activityAt) : null;
  if (optimistic) store.upsertActivity(optimistic, false);

  const start = Date.now();
  try {
    const response = await axios.post(
      `${KAYMAK_WORKER_URL}/feed/post`,
      {
        traktAccessToken: token,
        body: input.body,
        spoiler: input.spoiler,
        showId: input.show?.showId,
        mediaType: input.show?.mediaType,
        tmdbId: input.show?.tmdbId,
        showTitle: input.show?.showTitle,
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: 12000 }
    );

    if (!response.data?.success) {
      throw new Error(response.data?.message || 'Gönderi paylaşılamadı.');
    }

    invalidateFeedCache();
    // `me` çözülemediyse profil önbelleği atlanır — kendi TTL'iyle tazelenir.
    if (me) invalidateUserFeedActivitiesCache(me.traktSlug);
    recordMutationResult('publishPost', true);
    return { ok: true };
  } catch (error: any) {
    // Yayınlanmamış bir şeyi ekranda bırakmak kullanıcıya YALAN olurdu.
    if (optimistic) store.removeActivity(optimistic.id);
    recordMutationResult('publishPost', false);
    logError('feedPublish.publishPost', error);
    console.warn('[Feed] Gönderi paylaşılamadı:', error);
    return { ok: false, message: error?.response?.data?.message || error?.message || 'Gönderi paylaşılamadı.' };
  } finally {
    recordApiLatency('worker.feed.post', Date.now() - start);
  }
}

/**
 * Geri alınan bir izlemeyi akıştan düşürür (kullanıcı "izlemedim" dedi).
 * Yalnızca YEREL akışı temizler — Supabase'deki satırı bir sonraki tam
 * senkron zaten geri alma (retraction) mantığıyla siler; bunun için ayrı bir
 * Worker uç noktası açmak, aynı işi iki farklı yerde yapmak olurdu.
 */
export function retractLocalActivity(predicate: (a: FeedActivity) => boolean): void {
  const { activities, removeActivity } = useFeedStore.getState();
  activities.filter(predicate).forEach((a) => removeActivity(a.id));
  invalidateFeedCache();
  // Geri alınan (un-watch/un-rate) aktivite HER ZAMAN kendi aktivitemdir (bkz.
  // çağıranlar: progress.ts/ratings.ts) — Profil › Aktiviteler'in kısa ömürlü
  // önbelleği de geçersiz kılınmazsa, oraya dönen kullanıcı geri alınmış
  // aktiviteyi TTL dolana kadar hâlâ orada görürdü (Akış zaten canlı
  // `feedStore`'dan okuduğu için anında düşüyor, Profil ayrı bir fetch+cache
  // kullanıyor — bkz. useUserActivity.ts). `cachedMe` henüz hiç çözülmediyse
  // (bu oturumda bir yayın/gönderi olmadıysa) sessizce atlanır — zararı yok,
  // önbellek kendi TTL'iyle zaten kısa sürede tazelenir.
  if (cachedMe) invalidateUserFeedActivitiesCache(cachedMe.traktSlug);
}
