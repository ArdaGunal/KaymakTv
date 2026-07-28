import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { FeedActivity } from '../types';
import { fetchFeedActivities } from '../services/feedApi';

export function useFeed() {
  const { accessToken, isGuest } = useAuth();
  const [data, setData] = useState<FeedActivity[]>([]);
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
      const activities = await fetchFeedActivities();
      setData(activities);
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
