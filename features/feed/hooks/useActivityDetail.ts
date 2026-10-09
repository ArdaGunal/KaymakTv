import { useCallback, useEffect, useState } from 'react';
import { fetchActivityById } from '../services/feedApi';
import { useFeedStore } from '../store/feedStore';
import { FeedActivity } from '../types';

export interface UseActivityDetailResult {
  activity: FeedActivity | null;
  isLoading: boolean;
  /** Gerçek bir ağ/veritabanı hatası mı, yoksa aktivite gerçekten yok mu
   *  (silinmiş/hiç var olmamış) — `app/activity/[id].tsx` ikisini bilinçli
   *  olarak AYNI «bulunamadı» boş durumuna düşürüyor; ayrım burada saklı. */
  hasError: boolean;
  /** Yerel kopyaya kısmi yama (beğeni, yorum sayısı, alıntı) — store'da
   *  olmayan aktivite için (paylaşım linki, profil listesi) şart. */
  patchLocal: (patch: Partial<FeedActivity>) => void;
}

/**
 * Detay sayfasının (C2) tek-aktivite verisi.
 *
 * Akıştan gelindiyse aktivite feedStore'da ZATEN var → ilk kare ağ beklemeden
 * çizilir ve store'daki canlı değişiklikler (Realtime beğeni/yorum sayısı,
 * kartta yapılan beğeni) sayfaya kendiliğinden yansır. Arkada sunucudan taze
 * satır (`isLikedByMe` dahil) çekilir; store'da olmayan aktivite (paylaşım
 * linki, profil) yalnız bu yerel kopyadan çizilir.
 */
export function useActivityDetail(id: string | null): UseActivityDetailResult {
  const fromStore = useFeedStore((s) => (id ? s.activities.find((a) => a.id === id) : undefined));
  const [fetched, setFetched] = useState<FeedActivity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!id) {
      setFetched(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    fetchActivityById(id, { withLikes: true })
      .then((result) => {
        if (cancelled) return;
        setFetched(result);
        setHasError(false);
        // Store'daki kopya da tazelensin (ör. bu arada gelen yorum sayısı).
        if (result) useFeedStore.getState().patchActivity(result.id, result);
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn('[Activity] Aktivite yüklenemedi:', error);
        setFetched(null);
        setHasError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const patchLocal = useCallback((patch: Partial<FeedActivity>) => {
    setFetched((cur) => (cur ? { ...cur, ...patch } : cur));
  }, []);

  // Store kopyası canlıdır (kartla ortak) → varsa o kazanır.
  const activity = fromStore ?? fetched;
  return { activity, isLoading: isLoading && !activity, hasError, patchLocal };
}
