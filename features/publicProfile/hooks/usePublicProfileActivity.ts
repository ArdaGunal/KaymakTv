/**
 * usePublicProfileActivity — Public Profile ekranı için SALT OKUNUR aktivite akışı.
 *
 * features/feed/hooks/useUserActivity.ts ile BİLİNÇLİ OLARAK ayrı tutuldu:
 * o hook kendi aktivitelerini SİLME yetkisi taşıyor (deleteItem/deleteItems,
 * useAuth().accessToken ile Worker'a silme isteği atma). Burada görüntülenen
 * kullanıcı "ben" değil — silme fonksiyonlarının bu hook'a hiç girmemesi,
 * ileride biri yanlışlıkla "başka birinin aktivitesini sil" butonu bağlarsa
 * bunun mümkün OLMAMASINI yapısal olarak garanti eder (bkz. Adım 1-2 sohbeti:
 * silme özelliği şu an zaten UI'da donduruldu, bu ayrım o kararla ilgisiz,
 * salt bir yetki/kapsam netliği tercihi).
 *
 * Gruplama mantığı (groupMarathonActivities) feed/profile ile birebir aynı —
 * tek doğruluk kaynağı korunuyor, burada YENİDEN YAZILMADI.
 */

import { useEffect, useState } from 'react';
import { fetchUserFeedActivities } from '../../feed/services/feedApi';
import { FeedItem } from '../../feed/types';
import { groupMarathonActivities } from '../../feed/utils/groupMarathonActivities';

export function usePublicProfileActivity(slug: string | null) {
  const [data, setData] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!slug) {
      setData([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    fetchUserFeedActivities(slug)
      .then((rawActivities) => {
        if (!cancelled) {
          // useUserActivity/useFeed ile birebir aynı: tüm veri geldikten
          // sonra, ekrana basmadan hemen önce grupla. Spread ile yeni
          // referans garantile (React shallow equality'yi atlamasın diye).
          const grouped = groupMarathonActivities(rawActivities);
          setData([...grouped]);
        }
      })
      .catch((error) => {
        console.warn('[PublicProfile] Aktiviteler yüklenemedi:', error);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return { data, isLoading };
}
