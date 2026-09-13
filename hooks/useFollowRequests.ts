import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import {
  approveIncomingRequest,
  denyIncomingRequest,
  fetchIncomingRequests,
  GelenIstek,
  KaymakAramaHatasi,
} from '../services/api/kaymakSocial';
import { notify } from '../utils/confirmDialog';
import { useNotificationStore } from '../store/notificationStore';
import { logError } from '../utils/errorLog';

/**
 * Bana gelen takip istekleri — **BİZİM** graftan (Faz T · T3.3, M338).
 *
 * ⛔ ESKİDEN TRAKT'IN İSTEK KUYRUĞUNU OKUYORDU (`getFollowRequests`). Bizim
 * grafta atılan istekler orada HİÇ yoktu; Bildirimler ekranı bölümü boşken
 * gizlediği için kullanıcı "isteği attım ama kabul edilecek yer yok" durumuna
 * düştü (canlıda raporlandı, 2026-09-11).
 *
 * 🔑 Anahtar `userId` (Trakt'ın sayısal istek `id`'si DEĞİL) — bizde istek
 * `(requester_id, target_id)` bileşik anahtarlı, ayrı bir kimliği yok.
 *
 * `useProfilePrivacy.ts` ile AYNI desen: mount'ta guest/token korumalı fetch,
 * iyimser kaldırma + hata olursa rollback + `notify()`.
 */
export function useFollowRequests() {
  const { accessToken, isGuest } = useAuth();
  const { t } = useTranslation('common');
  const [requests, setRequests] = useState<GelenIstek[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!accessToken || isGuest) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchIncomingRequests();
        if (cancelled) return;
        setRequests(data);
        // Rozet, grafın sayımıyla bu listenin arasında kaymasın.
        useNotificationStore.getState().setIncomingRequestCount(data.length);
      } catch (error) {
        // 🔴 SESSİZ KAYIP OLMASIN (AI_RULES §2): bölüm boşken gizlendiği için
        // okunamayan bir liste "bekleyen istek yok" ile AYNI görünüyor.
        // Kullanıcıya gösterecek yer yok ama iz bırakılmalı.
        logError('useFollowRequests.fetch', error);
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
  // ÇAKIŞIR.
  const refetch = useCallback(async () => {
    if (!accessToken || isGuest) return;
    try {
      const data = await fetchIncomingRequests();
      setRequests(data);
      useNotificationStore.getState().setIncomingRequestCount(data.length);
    } catch (error) {
      logError('useFollowRequests.refetch', error);
    }
  }, [accessToken, isGuest]);

  const resolve = useCallback(
    async (userId: string, action: (userId: string) => Promise<void>) => {
      const previous = requests;
      setRequests((prev) => prev.filter((r) => r.userId !== userId));
      try {
        await action(userId);
        useNotificationStore.getState().setIncomingRequestCount(previous.length - 1);
      } catch (error) {
        // 🔑 `istek_yok` (409) HATA DEĞİL, SONUÇ: istek geri çekilmiş ya da
        // araya bir engelleme girmiş. Listeden düşmüş olması DOĞRU hâl —
        // geri alıp hata göstermek, kullanıcıya artık var olmayan bir isteği
        // yeniden sunmak olurdu.
        if (error instanceof KaymakAramaHatasi && error.tur === 'istek_yok') {
          useNotificationStore.getState().setIncomingRequestCount(previous.length - 1);
          return;
        }

        logError('useFollowRequests.resolve', error);
        setRequests(previous);
        notify(
          t('error', 'Hata'),
          t('actionFailedMessage', 'İşlem gerçekleştirilemedi. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.'),
        );
      }
    },
    [requests, t],
  );

  const accept = useCallback((userId: string) => resolve(userId, approveIncomingRequest), [resolve]);
  const reject = useCallback((userId: string) => resolve(userId, denyIncomingRequest), [resolve]);

  return { requests, isLoading, accept, reject, refetch };
}
