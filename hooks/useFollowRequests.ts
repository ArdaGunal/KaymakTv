import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { approveFollowRequest, denyFollowRequest, getFollowRequests, TraktFollowRequest } from '../services/api/social';
import { notify } from '../utils/confirmDialog';

/**
 * `useProfilePrivacy.ts` ile AYNI desen: mount'ta guest/token korumalı fetch,
 * optimistic kaldırma + hata olursa rollback + `notify()`.
 */
export function useFollowRequests() {
  const { accessToken, isGuest } = useAuth();
  const { t } = useTranslation('common');
  const [requests, setRequests] = useState<TraktFollowRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!accessToken || isGuest) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await getFollowRequests();
        if (!cancelled) setRequests(data);
      } catch (error) {
        console.warn('[useFollowRequests] Takip istekleri okunamadı:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, isGuest]);

  // Pull-to-refresh (bildirimler ekranı) için: `isLoading`'e DOKUNMAZ —
  // aksi hâlde her "aşağı çekme" jesti listeyi kısa süreliğine boşaltıp
  // iskelet gösterirdi, ki bu RefreshControl'ün kendi döner göstergesiyle
  // ÇAKIŞIR. Mount effect'iyle bilinçli olarak AYNI mantığı tekrar etmiyor —
  // burada `cancelled` koruması gerekmez çünkü çağıran taraf zaten mount
  // olmuş bir bileşen (RefreshControl'ün kendisi).
  const refetch = useCallback(async () => {
    if (!accessToken || isGuest) return;
    try {
      const data = await getFollowRequests();
      setRequests(data);
    } catch (error) {
      console.warn('[useFollowRequests] Yenileme başarısız:', error);
    }
  }, [accessToken, isGuest]);

  const resolve = useCallback(
    async (id: number, action: (id: number) => Promise<void>) => {
      const previous = requests;
      setRequests((prev) => prev.filter((r) => r.id !== id));
      try {
        await action(id);
      } catch (error) {
        console.warn('[useFollowRequests] İstek işlenemedi:', error);
        setRequests(previous);
        notify(t('error', 'Hata'), t('actionFailedMessage', 'İşlem gerçekleştirilemedi. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.'));
      }
    },
    [requests, t]
  );

  const accept = useCallback((id: number) => resolve(id, approveFollowRequest), [resolve]);
  const reject = useCallback((id: number) => resolve(id, denyFollowRequest), [resolve]);

  return { requests, isLoading, accept, reject, refetch };
}
