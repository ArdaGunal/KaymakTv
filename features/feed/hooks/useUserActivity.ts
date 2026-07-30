/**
 * useUserActivity — Profil sayfasının "Aktiviteler" sekmesi için veri hook'u
 *
 * useFeed ile aynı gruplama mantığını kullanır: ham FeedActivity[] çekilir,
 * ardından groupMarathonActivities ile FeedItem[] döndürülür. Bu sayede
 * profil sayfası ile akış (feed) sayfası birebir aynı görünümü sunar.
 *
 * feedApi.ts kesinlikle gruplamaz; gruplama her zaman burada yapılır.
 *
 * Silme (deleteItem/deleteItems): Optimistic UI — sunucu yanıtını beklemeden
 * state'ten kaldırılır, istek başarısız olursa önceki state'e geri dönülür
 * ve kullanıcı Alert ile bilgilendirilir (bkz. docs/AI_RULES.md § Sessiz
 * başarısızlık YASAKTIR).
 */

import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../context/AuthContext';
import { deleteActivitiesBulk, fetchUserFeedActivities } from '../services/feedApi';
import { FeedItem, isMarathonActivity } from '../types';
import { groupMarathonActivities } from '../utils/groupMarathonActivities';

// Maraton kartı için TÜM gruplanan ham satırlar; tekil aktivite için kendi id'si.
function resolveRawActivityIds(item: FeedItem): string[] {
  return isMarathonActivity(item) ? item.originalActivityIds : [item.id];
}

export function useUserActivity(traktSlug: string | null) {
  const { accessToken, isGuest } = useAuth();
  const { t } = useTranslation(['media', 'common']);
  const [data, setData] = useState<FeedItem[]>([]);
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
      .then((rawActivities) => {
        if (!cancelled) {
          // useFeed ile birebir aynı: tüm veri geldikten sonra, ekrana
          // basmadan hemen önce grupla. Spread ile yeni referans garantile.
          const grouped = groupMarathonActivities(rawActivities);
          setData([...grouped]);
        }
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
      const previousData = data;
      // Optimistic UI: sunucu yanıtını beklemeden anında ekrandan kaldır.
      setData((current) => current.filter((item) => !idsToRemove.has(item.id)));

      try {
        const rawIds = items.flatMap(resolveRawActivityIds);
        await deleteActivitiesBulk(accessToken, rawIds);
      } catch (error) {
        console.warn('[Profile] Aktivite silinemedi:', error);
        // Sunucu başarısız oldu — optimistic değişikliği geri al.
        setData(previousData);
        Alert.alert(t('common:error'), t('activityDeleteError', 'Aktivite(ler) silinirken bir sorun oluştu. Lütfen tekrar deneyin.'));
      }
    },
    [accessToken, isGuest, data, t]
  );

  const deleteItem = useCallback((item: FeedItem) => deleteItems([item]), [deleteItems]);

  return { data, isLoading, deleteItem, deleteItems };
}
