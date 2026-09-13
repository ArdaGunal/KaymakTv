/**
 * usePublicProfileActivity — Public Profile ekranı için SALT OKUNUR aktivite akışı.
 *
 * features/feed/hooks/useUserActivity.ts ile BİLİNÇLİ OLARAK ayrı tutuldu:
 * o hook kendi aktivitelerini SİLME yetkisi taşıyor (deleteItem/deleteItems,
 * useAuth().accessToken ile Worker'a silme isteği atma). Burada görüntülenen
 * kullanıcı "ben" değil — silme fonksiyonlarının bu hook'a hiç girmemesi,
 * ileride biri yanlışlıkla "başka birinin aktivitesini sil" butonu bağlarsa
 * bunun mümkün OLMAMASINI yapısal olarak garanti eder.
 *
 * 🪪 KİMLİK `users.id` (M339 · `BACKLOG` §F6). Eskiden Trakt slug'ıyla
 * süzülüyordu; Google-only kullanıcının profilinde aktivite sekmesi bu yüzden
 * hep BOŞ geliyordu. Çağıran değeri `usePublicProfileIdentity`'den alır.
 *
 * Veri çekme/gruplama/yarış-koruması çekirdeği `useActivityFeed`'te Akış ve
 * Profil ile PAYLAŞILIR — tek doğruluk kaynağı; bu ayrım yalnızca YETKİ
 * kapsamıyla ilgili, veri mantığını çoğaltmayı gerektirmiyor.
 */

import { useCallback } from 'react';
import { fetchUserFeedActivities } from '../../feed/services/feedApi';
import { useActivityFeed } from '../../feed/hooks/useActivityFeed';

export function usePublicProfileActivity(userId: string | null) {
  const fetcher = useCallback(
    (force: boolean) => fetchUserFeedActivities(userId as string, force),
    [userId]
  );

  const { data, isLoading, hasError, refresh } = useActivityFeed(userId ? fetcher : null, 'PublicProfile');

  return { data, isLoading, hasError, refresh };
}
