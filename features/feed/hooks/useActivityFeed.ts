/**
 * useActivityFeed — aktivite listelerinin ORTAK veri çekirdeği.
 *
 * NEDEN VAR: `useFeed` (Akış), `useUserActivity` (kendi profilim) ve
 * `usePublicProfileActivity` (başkasının profili) üçü de BİREBİR aynı işi
 * yapıyordu: ham `FeedActivity[]` çek → `groupMarathonActivities` ile grupla →
 * state'e yaz → yarış durumuna karşı `cancelled` bayrağı tut → hatayı
 * `console.warn` ile yut. Aynı mantığın üç kopyası, üç farklı yerde ayrı ayrı
 * bakım gerektiriyordu (nitekim `useFeed`'de `cancelled` koruması hiç YOKTU —
 * hızlı arka arkaya tazelemede eski yanıt yeninin üzerine yazabiliyordu).
 *
 * SESSİZ BAŞARISIZLIK DÜZELTMESİ (docs/AI_RULES.md): eskiden hata yalnızca
 * konsola yazılıp `data` boş bırakılıyordu — kullanıcı gerçek bir ağ/veritabanı
 * hatasında "Akışın Boş: takip ettiğin kişilerin aktiviteleri burada görünecek"
 * mesajını görüyordu, yani uygulama ona YANLIŞ bilgi veriyordu. Artık `error`
 * durumu dışarı veriliyor ve ekran bunu ayırt edip "tekrar dene" sunabiliyor.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { FeedActivity, FeedItem } from '../types';
import { groupMarathonActivities } from '../utils/groupMarathonActivities';

export interface UseActivityFeedResult {
  data: FeedItem[];
  setData: React.Dispatch<React.SetStateAction<FeedItem[]>>;
  isLoading: boolean;
  isRefreshing: boolean;
  /** Gerçek bir hata oluştuysa true — "veri yok" ile "yüklenemedi" ayrımı için. */
  hasError: boolean;
  /** Kullanıcı tetikli tazeleme (pull-to-refresh / "tekrar dene"). */
  refresh: () => Promise<void>;
}

/**
 * @param fetcher Ham aktiviteleri getiren fonksiyon. `null` ise hiç yüklenmez
 *   (misafir kullanıcı, slug henüz bilinmiyor vb.) ve liste boşaltılır.
 *   ÖNEMLİ: çağıran taraf bunu `useCallback` ile stabilize etmeli — bu hook
 *   `fetcher` değiştiğinde baştan yükler, yani her render'da yeni bir referans
 *   verilmesi sonsuz döngü anlamına gelir.
 * @param logLabel Konsol uyarılarında görünecek etiket (ör. "Feed").
 */
export function useActivityFeed(
  fetcher: ((force: boolean) => Promise<FeedActivity[]>) | null,
  logLabel: string
): UseActivityFeedResult {
  const [data, setData] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Yalnızca EN SON başlatılan yüklemenin sonucu state'e yazılabilir. Sayaç
  // (boolean bir bayrak yerine) şart: `refresh` art arda çağrılırsa aynı anda
  // birden fazla istek uçuşta olur ve önce BAŞLAYAN sonra BİTEBİLİR.
  const runIdRef = useRef(0);

  const run = useCallback(
    async (force: boolean) => {
      if (!fetcher) {
        setData([]);
        setHasError(false);
        setIsLoading(false);
        return;
      }

      const runId = ++runIdRef.current;
      try {
        const rawActivities = await fetcher(force);
        if (runId !== runIdRef.current) return; // Daha yeni bir yükleme başladı.
        // Gruplama BİLİNÇLİ OLARAK servis katmanında değil burada: sayfalama
        // eklendiğinde ham veri biriktirilip TEK seferde gruplanmalı, sayfa
        // başına değil (bkz. utils/groupMarathonActivities.ts başlığı).
        // `groupMarathonActivities` zaten YENİ bir dizi döndürür — eskiden üç
        // hook'ta da `[...grouped]` ile fazladan bir kopya alınıyordu, gereksizdi.
        setData(groupMarathonActivities(rawActivities));
        setHasError(false);
      } catch (error) {
        if (runId !== runIdRef.current) return;
        console.warn(`[${logLabel}] Aktiviteler yüklenemedi:`, error);
        setHasError(true);
      } finally {
        if (runId === runIdRef.current) setIsLoading(false);
      }
    },
    [fetcher, logLabel]
  );

  useEffect(() => {
    setIsLoading(true);
    run(false);
    // Unmount'ta sayacı ilerleterek uçuştaki yanıtın state'e yazmasını engelle.
    return () => {
      runIdRef.current++;
    };
  }, [run]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    // force: kullanıcı açıkça tazeleme istedi — servis katmanındaki kısa ömürlü
    // önbellek asla araya girmemeli.
    await run(true);
    setIsRefreshing(false);
  }, [run]);

  return { data, setData, isLoading, isRefreshing, hasError, refresh };
}
