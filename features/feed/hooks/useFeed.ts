/**
 * useFeed — Akış (Feed) ekranının veri hook'u.
 *
 * ESKİ DAVRANIŞ: akış verisi bu hook'un İÇİNDE `useState` ile tutuluyordu —
 * yani yalnızca bu bileşen ağacından değiştirilebiliyordu. Gerçek zamanlı bir
 * sosyal akışta veri UI DIŞINDAN da değişir (kullanıcı bir bölüm işaretler →
 * mutasyon katmanı; başkası bir şey izler → Realtime WebSocket). Bu yüzden
 * ham aktiviteler artık paylaşılan `feedStore`'da; bu hook onları okuyup
 * sunucu senkronunu ve maraton gruplamasını yönetir.
 *
 * Akış, takip edilenlerin YANI SIRA kullanıcının KENDİ aktivitelerini de
 * gösterir (bkz. services/feedApi.ts fetchFeedActivities).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  /** Kullanıcı listeyi görmemişken gelen yeni aktivite sayısı ("N yeni gönderi"). */
  unseenCount: number;
  markSeen: () => void;
  refresh: () => Promise<void>;
}

export function useFeed(): UseFeedResult {
  const { accessToken, isGuest } = useAuth();
  const canLoad = !!accessToken && !isGuest;

  const activities = useFeedStore((s) => s.activities);
  const isHydrated = useFeedStore((s) => s.isHydrated);
  const unseenCount = useFeedStore((s) => s.unseenCount);
  const setActivities = useFeedStore((s) => s.setActivities);
  const markSeen = useFeedStore((s) => s.clearUnseen);

  const [isLoading, setIsLoading] = useState(!isHydrated);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Başkalarının aktiviteleri canlı düşsün diye.
  useFeedRealtime(canLoad);

  const load = useCallback(
    async (force: boolean) => {
      if (!canLoad) {
        setActivities([]);
        setIsLoading(false);
        return;
      }
      try {
        const fresh = await fetchFeedActivities(force);
        setActivities(fresh);
        setHasError(false);
      } catch (error) {
        console.warn('[Feed] Akış yüklenemedi:', error);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    },
    [canLoad, setActivities]
  );

  useEffect(() => {
    // Store'da zaten veri varsa (sekmeye geri dönüş) skeleton GÖSTERME —
    // eldeki veriyi göster, tazelemeyi arkada yap.
    if (!isHydrated) setIsLoading(true);
    load(false);
    // `isHydrated` bilinçli olarak bağımlılık DEĞİL: yükleme bittiğinde true
    // olur ve bu efekti sonsuz döngüye sokardı. Yalnızca ilk render'daki
    // değeri okumak yeterli.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await load(true);
    markSeen();
    setIsRefreshing(false);
  }, [load, markSeen]);

  // Maraton gruplaması BİLİNÇLİ OLARAK burada, store'da değil: gruplama tüm
  // ham veri toplandıktan SONRA, render öncesi tek seferde yapılmalı (bkz.
  // utils/groupMarathonActivities.ts başlığı). Yeni bir aktivite geldiğinde
  // yeniden hesaplanır — böylece "3 bölüm izledi" kartı kendiliğinden
  // "4 bölüm izledi"ye dönüşür.
  const data = useMemo(() => groupMarathonActivities(activities), [activities]);

  return { data, isLoading, isRefreshing, hasError, unseenCount, markSeen, refresh };
}
