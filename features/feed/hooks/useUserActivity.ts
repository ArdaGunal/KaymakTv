import { useEffect, useState } from 'react';
import { fetchUserFeedActivities } from '../services/feedApi';
import { FeedActivity } from '../types';

export function useUserActivity(traktSlug: string | null) {
  const [data, setData] = useState<FeedActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!traktSlug) {
      setData([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    fetchUserFeedActivities(traktSlug)
      .then((activities) => {
        if (!cancelled) setData(activities);
      })
      .catch((error) => {
        console.warn('[Profile] Aktiviteler yüklenemedi:', error);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [traktSlug]);

  return { data, isLoading };
}
