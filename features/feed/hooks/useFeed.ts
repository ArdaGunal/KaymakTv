/**
 * useFeed — Akış (Feed) ekranının veri hook'u.
 *
 * ESKİ DAVRANIŞ: akış verisi bu hook'un İÇİNDE `useState` ile tutuluyordu —
 * yani yalnızca bu bileşen ağacından değiştirilebiliyordu. Gerçek zamanlı bir
 * sosyal akışta veri UI DIŞINDAN da değişir (kullanıcı bir bölüm işaretler →
 * mutasyon katmanı; başkası bir şey izler → Realtime WebSocket). Bu yüzden
 * ham aktiviteler artık paylaşılan `feedStore`'da; bu hook onları okuyup
 * sunucu senkronunu, SAYFALAMAYI ve maraton gruplamasını yönetir.
 *
 * Akış, takip edilenlerin YANI SIRA kullanıcının KENDİ aktivitelerini de
 * gösterir (bkz. services/feedApi.ts getVisibleUserIds).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../context/AuthContext';
import { fetchFeedActivities, deleteActivitiesBulk, invalidateUserFeedActivitiesCache } from '../services/feedApi';
import { useFeedStore } from '../store/feedStore';
import { useFeedRealtime } from './useFeedRealtime';
import { useMyTraktSlug } from './useMyTraktSlug';
import { groupMarathonActivities } from '../utils/groupMarathonActivities';
import { resolveRawActivityIds } from '../utils/resolveRawActivityIds';
import { FeedItem } from '../types';

export interface UseFeedResult {
  data: FeedItem[];
  isLoading: boolean;
  isRefreshing: boolean;
  hasError: boolean;
  /** Sonsuz kaydırma: alt sayfa yükleniyor mu (footer spinner). */
  isLoadingMore: boolean;
  /** Sunucuda daha eski kayıt var mı ("hepsi bu kadar" mesajı için). */
  hasMore: boolean;
  /** Kullanıcı listeyi görmemişken gelen yeni aktivite sayısı ("N yeni gönderi"). */
  unseenCount: number;
  markSeen: () => void;
  refresh: () => Promise<void>;
  /** Listenin sonuna yaklaşıldığında çağrılır. */
  loadMore: () => void;
  /** Bir aktiviteyi (yalnızca kendi kartın — CardMenu bunu isOwnActivity'e
   *  göre zaten filtreler) kalıcı olarak siler. Worker `/feed/delete` hard
   *  delete + tombstone yapıyor (bkz. deleteActivitiesBulk) — burada yeni bir
   *  silme mekanizması İCAT EDİLMİYOR, yalnızca `useUserActivity.ts`'in
   *  Profil tarafında zaten yaptığını Akış'ın canlı `feedStore`'una bağlıyor. */
  deleteActivity: (item: FeedItem) => Promise<void>;
}

export function useFeed(): UseFeedResult {
  const { accessToken, isGuest } = useAuth();
  const myTraktSlug = useMyTraktSlug();
  const { t } = useTranslation(['media', 'common']);
  const canLoad = !!accessToken && !isGuest;

  const activities = useFeedStore((s) => s.activities);
  const isHydrated = useFeedStore((s) => s.isHydrated);
  const unseenCount = useFeedStore((s) => s.unseenCount);
  const hasMore = useFeedStore((s) => s.hasMore);
  const isLoadingMore = useFeedStore((s) => s.isLoadingMore);
  const markSeen = useFeedStore((s) => s.clearUnseen);

  const [isLoading, setIsLoading] = useState(!isHydrated);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Uçuştaki sayfa isteği. ŞART: `onEndReached` hızlı kaydırmada arka arkaya
  // birden çok kez tetiklenir; korumasız bırakılırsa AYNI imleçle birden fazla
  // istek gider ve aynı sayfa iki kez eklenmeye çalışılırdı.
  const isFetchingRef = useRef(false);

  // Başkalarının aktiviteleri canlı düşsün diye.
  useFeedRealtime(canLoad);

  const loadFirstPage = useCallback(
    async (force: boolean) => {
      if (!canLoad) {
        useFeedStore.getState().setFirstPage({ items: [], nextCursor: null, hasMore: false });
        setIsLoading(false);
        return;
      }
      isFetchingRef.current = true;
      try {
        const page = await fetchFeedActivities(null, force);
        useFeedStore.getState().setFirstPage(page);
        setHasError(false);
      } catch (error) {
        console.warn('[Feed] Akış yüklenemedi:', error);
        setHasError(true);
      } finally {
        isFetchingRef.current = false;
        setIsLoading(false);
      }
    },
    [canLoad]
  );

  useEffect(() => {
    // Store'da zaten veri varsa (sekmeye geri dönüş) skeleton GÖSTERME —
    // eldeki veriyi göster, tazelemeyi arkada yap.
    if (!useFeedStore.getState().isHydrated) setIsLoading(true);
    loadFirstPage(false);
  }, [loadFirstPage]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    // Pull-to-refresh her zaman 1. SAYFAYI baştan çeker (imleç sıfırlanır) —
    // kullanıcı "en yeniyi göster" demek istiyor, kaldığı yeri değil.
    await loadFirstPage(true);
    markSeen();
    setIsRefreshing(false);
  }, [loadFirstPage, markSeen]);

  const loadMore = useCallback(() => {
    const state = useFeedStore.getState();
    // Dört koruma: oturum yok / uçuşta istek var / devamı yok / imleç yok.
    if (!canLoad || isFetchingRef.current || !state.hasMore || !state.nextCursor) return;

    isFetchingRef.current = true;
    state.setLoadingMore(true);
    fetchFeedActivities(state.nextCursor)
      .then((page) => {
        useFeedStore.getState().appendPage(page);
        setHasError(false);
      })
      .catch((error) => {
        console.warn('[Feed] Sonraki sayfa yüklenemedi:', error);
        // Liste dolu olduğu için tam ekran hata GÖSTERİLMEZ — kullanıcı eldeki
        // içeriği okumaya devam eder, tekrar kaydırınca yeniden denenir.
        useFeedStore.getState().setLoadingMore(false);
      })
      .finally(() => {
        isFetchingRef.current = false;
        useFeedStore.getState().setLoadingMore(false);
      });
  }, [canLoad]);

  // Maraton gruplaması BİLİNÇLİ OLARAK burada, store'da değil: gruplama tüm
  // ham veri toplandıktan SONRA, render öncesi tek seferde yapılmalı (bkz.
  // utils/groupMarathonActivities.ts başlığı). Yeni bir sayfa eklendiğinde
  // yeniden hesaplanır — böylece sayfa sınırına denk gelen bir maraton
  // (aynı dizinin bölümleri iki sayfaya bölünmüş) TEK kartta birleşir.
  const data = useMemo(() => groupMarathonActivities(activities), [activities]);

  const deleteActivity = useCallback(
    async (item: FeedItem) => {
      // Misafirin Trakt token'ı yok — pratikte CardMenu zaten yalnızca kendi
      // aktivitene "Sil" gösteriyor (misafirin kendi aktivitesi olamaz), ama
      // useUserActivity.ts'teki AYNI savunma burada da duruyor.
      if (!accessToken || isGuest) {
        Alert.alert(
          t('activityDeleteGuestTitle', 'Giriş Gerekli'),
          t('activityDeleteGuestText', 'Bu işlem için Trakt hesabınızla giriş yapmış olmanız gerekir.')
        );
        return;
      }

      const rawIds = resolveRawActivityIds(item);
      // Geri alma (rollback) için ham FeedActivity nesnelerini sakla —
      // `removeActivity` yalnızca id alır, geri eklemek TAM nesne gerektirir.
      const removed = useFeedStore.getState().activities.filter((a) => rawIds.includes(a.id));
      removed.forEach((a) => useFeedStore.getState().removeActivity(a.id));

      try {
        // v2: TEK silme yolu. Eskiden burada tipe göre bir yönlendirme vardı
        // (`deleteFeedItemsRouted`) çünkü incelemenin Trakt'tan da silinmesi
        // gerekiyordu. Trakt'a yazmayı bıraktığımız için o ayrım kalktı —
        // inceleme dahil her aktivite aynı uçtan siliniyor.
        await deleteActivitiesBulk(accessToken, rawIds);
        // Profil › Aktiviteler ayrı bir fetch+önbellek kullanıyor (bkz.
        // useUserActivity.ts) — Akış'tan silinince o da güncel kalsın diye
        // AYNI çapraz-senkron deseni (docs/HISTORY.md Madde 159'daki
        // retractLocalActivity ile birebir aynı gerekçe).
        if (myTraktSlug) invalidateUserFeedActivitiesCache(myTraktSlug);
      } catch (error) {
        console.warn('[Feed] Aktivite silinemedi:', error);
        // Sunucu başarısız oldu — iyimser kaldırmayı geri al.
        removed.forEach((a) => useFeedStore.getState().upsertActivity(a, false));
        Alert.alert(
          t('common:error'),
          t('activityDeleteError', 'Aktivite(ler) silinirken bir sorun oluştu. Lütfen tekrar deneyin.')
        );
      }
    },
    [accessToken, isGuest, myTraktSlug, t]
  );

  return {
    data,
    isLoading,
    isRefreshing,
    hasError,
    isLoadingMore,
    hasMore,
    unseenCount,
    markSeen,
    refresh,
    loadMore,
    deleteActivity,
  };
}
