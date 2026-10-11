import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { notify } from '../../../utils/confirmDialog';
import { useAuth } from '../../../context/AuthContext';
import { deleteActivitiesBulk, invalidateUserFeedActivitiesCache } from '../services/feedApi';
import { useFeedStore } from '../store/feedStore';
import { resolveRawActivityIds } from '../utils/resolveRawActivityIds';
import { FeedItem } from '../types';

/**
 * Akış kartı silme — iyimser kaldırma, sunucu hatasında geri ekleme. `useFeed.ts`'ten
 * ayrıldı (C37, M489: o dosya 400 satır sınırına yaklaşmıştı); davranış aynı.
 */
export function useFeedDelete(): (item: FeedItem) => Promise<void> {
  const { accessToken, isGuest } = useAuth();
  const { t } = useTranslation(['media', 'common']);

  return useCallback(
    async (item: FeedItem) => {
      // Misafirin Trakt token'ı yok — pratikte CardMenu zaten yalnızca kendi
      // aktivitene "Sil" gösteriyor (misafirin kendi aktivitesi olamaz), ama
      // useUserActivity.ts'teki AYNI savunma burada da duruyor.
      if (!accessToken || isGuest) {
        notify(
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
        invalidateUserFeedActivitiesCache();
      } catch (error) {
        console.warn('[Feed] Aktivite silinemedi:', error);
        // Sunucu başarısız oldu — iyimser kaldırmayı geri al.
        removed.forEach((a) => useFeedStore.getState().upsertActivity(a, false));
        notify(
          t('common:error'),
          t('activityDeleteError', 'Aktivite(ler) silinirken bir sorun oluştu. Lütfen tekrar deneyin.')
        );
      }
    },
    [accessToken, isGuest, t]
  );
}
