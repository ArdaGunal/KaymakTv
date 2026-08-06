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
import { useAuth } from '../../../context/AuthContext';
import { fetchFeedActivities } from '../services/feedApi';
import { useFeedStore } from '../store/feedStore';
import { useFeedRealtime } from './useFeedRealtime';
import { groupMarathonActivities } from '../utils/groupMarathonActivities';
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
}

export function useFeed(): UseFeedResult {
  const { accessToken, isGuest } = useAuth();
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
  };
}
