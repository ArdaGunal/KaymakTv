/**
 * useFeed — Akış (Feed) veri hook'u
 *
 * Mimari not:
 * feedApi.ts ham FeedActivity[] döndürür ve asla gruplamaz. Gruplama burada,
 * tüm veri alındıktan sonra yapılır. Bu sayede gelecekte infinite scroll /
 * pagination eklendiğinde ham veri akümüle edilip, render öncesi tek seferde
 * groupMarathonActivities'e verilebilir — bkz. features/feed/utils/groupMarathonActivities.ts
 *
 * React state güncelleme garantisi:
 * setData([...grouped]) ile yayılmış yeni bir dizi referansı her zaman
 * sağlanır. groupMarathonActivities zaten yeni bir dizi döndürse de, bu
 * spread fazladan güvenlik katmanı ekler ve React'in shallow equality
 * kontrolünün state güncellemesini atlamasını kesinlikle engeller.
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { FeedItem } from '../types';
import { fetchFeedActivities } from '../services/feedApi';
import { groupMarathonActivities } from '../utils/groupMarathonActivities';

export function useFeed() {
  const { accessToken, isGuest } = useAuth();
  const [data, setData] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async () => {
    // Misafir kullanıcının Trakt token'ı yok — takip listesi çekilemez,
    // hataya düşmek yerine sessizce boş feed göster.
    if (!accessToken || isGuest) {
      setData([]);
      return;
    }
    try {
      // 1. Ham aktiviteleri çek (feedApi gruplamaz, sadece veri getirir)
      const rawActivities = await fetchFeedActivities();

      // 2. Tüm veri yüklendikten sonra, ekrana basmadan hemen önce grupla.
      //    Pagination geldiğinde: ham dizi biriktirildikten sonra bu satır
      //    tek seferde çalışır — sayfa başına gruplama YAPILMAZ.
      const grouped = groupMarathonActivities(rawActivities);

      // 3. [...grouped] ile yeni referans garantile — React shallow equality
      //    kontrolünün güncellemeyi atlamasını kesinlikle engelle.
      setData([...grouped]);
    } catch (error) {
      console.warn('[Feed] Akış yüklenemedi:', error);
    }
  }, [accessToken, isGuest]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  return { data, isLoading, isRefreshing, refresh };
}
