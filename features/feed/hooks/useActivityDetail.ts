import { useEffect, useState } from 'react';
import { fetchActivityById } from '../services/feedApi';
import { FeedActivity } from '../types';

export interface UseActivityDetailResult {
  activity: FeedActivity | null;
  isLoading: boolean;
  /** Gerçek bir ağ/veritabanı hatası mı, yoksa aktivite gerçekten yok mu
   *  (silinmiş/hiç var olmamış) — `app/activity/[id].tsx` bilinçli olarak
   *  ikisini AYNI "bulunamadı" boş durumuna düşürüyor (bkz. o dosyadaki not),
   *  ama ayrım burada saklı kalıyor, ileride ayrıştırmak istenirse hazır. */
  hasError: boolean;
}

/** `app/activity/[id].tsx` (paylaşım linki) için tek-aktivite veri hook'u.
 *  `fetchActivityById` zaten var (bkz. feedApi.ts) — şu ana kadar yalnızca
 *  Realtime'ın satır tamamlama yolu kullanıyordu, burada DOĞRUDAN çağrılıyor. */
export function useActivityDetail(id: string | null): UseActivityDetailResult {
  const [activity, setActivity] = useState<FeedActivity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!id) {
      setActivity(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    fetchActivityById(id)
      .then((result) => {
        if (cancelled) return;
        setActivity(result);
        setHasError(false);
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn('[Activity] Aktivite yüklenemedi:', error);
        setActivity(null);
        setHasError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return { activity, isLoading, hasError };
}
