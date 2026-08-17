/**
 * useUserActivity — Profil sayfasının "Aktiviteler" sekmesi için veri hook'u
 *
 * Veri çekme/gruplama/yarış-koruması çekirdeği `useActivityFeed`'te paylaşılır
 * (Akış ve Public Profile ile AYNI kaynak) — bu hook onun üzerine yalnızca
 * SİLME yetkisini ekler.
 *
 * Silme (deleteItem/deleteItems): Optimistic UI — sunucu yanıtını beklemeden
 * state'ten kaldırılır, istek başarısız olursa önceki state'e geri dönülür
 * ve kullanıcı Alert ile bilgilendirilir (bkz. docs/AI_RULES.md § Sessiz
 * başarısızlık YASAKTIR).
 */

import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../context/AuthContext';
import { deleteActivitiesBulk, fetchUserFeedActivities, invalidateUserFeedActivitiesCache } from '../services/feedApi';
import { FeedItem } from '../types';
import { resolveRawActivityIds } from '../utils/resolveRawActivityIds';
import { useActivityFeed } from './useActivityFeed';

export function useUserActivity(traktSlug: string | null) {
  const { accessToken, isGuest } = useAuth();
  const { t } = useTranslation(['media', 'common']);

  const fetcher = useCallback(
    (force: boolean) => fetchUserFeedActivities(traktSlug as string, force),
    [traktSlug]
  );

  const { data, setData, isLoading, hasError, refresh } = useActivityFeed(
    traktSlug ? fetcher : null,
    'Profile'
  );

  const deleteItems = useCallback(
    async (items: FeedItem[]) => {
      if (items.length === 0) return;

      // Misafir kullanıcının Trakt token'ı yok — Worker kimlik doğrulaması
      // yapamaz, isteği hiç göndermeden engelle.
      if (!accessToken || isGuest) {
        Alert.alert(
          t('activityDeleteGuestTitle', 'Giriş Gerekli'),
          t('activityDeleteGuestText', 'Bu işlem için Trakt hesabınızla giriş yapmış olmanız gerekir.')
        );
        return;
      }

      const idsToRemove = new Set(items.map((item) => item.id));
      // Geri alma (rollback) için o anki liste. `setData` güncelleyicisinin
      // İÇİNDEN yakalamak cazip görünse de React güncelleyiciyi (StrictMode'da)
      // birden fazla kez çağırabilir — güncelleyiciler SAF kalmalı, yan etki
      // barındırmamalı. Bu yüzden `data` bağımlılıklardan okunuyor.
      const previousData = data;
      // Optimistic UI: sunucu yanıtını beklemeden anında ekrandan kaldır.
      setData((current) => current.filter((item) => !idsToRemove.has(item.id)));

      try {
        // v2: TEK silme yolu — bkz. useFeed.ts'teki aynı not.
        const rawIds = items.flatMap(resolveRawActivityIds);
        await deleteActivitiesBulk(accessToken, rawIds);
        // Silinenler bir sonraki mount'ta önbellekten (bkz. feedApi.ts
        // userFeedActivitiesCache) geri gelmesin diye — TTL dolana kadar
        // beklemeye gerek yok. Akış önbelleğini `deleteActivitiesBulk`
        // kendisi geçersiz kılıyor.
        if (traktSlug) invalidateUserFeedActivitiesCache(traktSlug);
      } catch (error) {
        console.warn('[Profile] Aktivite silinemedi:', error);
        // Sunucu başarısız oldu — optimistic değişikliği geri al.
        setData(previousData);
        Alert.alert(t('common:error'), t('activityDeleteError', 'Aktivite(ler) silinirken bir sorun oluştu. Lütfen tekrar deneyin.'));
      }
    },
    [accessToken, isGuest, data, setData, t, traktSlug]
  );

  const deleteItem = useCallback((item: FeedItem) => deleteItems([item]), [deleteItems]);

  return { data, isLoading, hasError, refresh, deleteItem, deleteItems };
}
