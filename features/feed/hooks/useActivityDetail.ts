import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchActivityById } from '../services/feedApi';
import { useFeedStore } from '../store/feedStore';
import { FeedActivity } from '../types';
import { useOneGelince } from './useOneGelince';

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
 *
 * Moderasyon Faz 6 (MD06): sunucu satırı döndürmezse (silindi, moderatör gizledi, sahibi kapatıldı)
 * store kopyası da düşer — yoksa «store kazanır» kuralı gizlenen kartı göstermeye devam ederdi.
 * Sayfa açıkken öne gelişte / ağa dönüşte yeniden sorulur.
 */
export function useActivityDetail(id: string | null): UseActivityDetailResult {
  const fromStore = useFeedStore((s) => (id ? s.activities.find((a) => a.id === id) : undefined));
  const [fetched, setFetched] = useState<FeedActivity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [tur, setTur] = useState(0);
  const sonId = useRef<string | null>(null);

  useOneGelince(() => setTur((n) => n + 1), !!id);

  useEffect(() => {
    if (!id) {
      sonId.current = null;
      setFetched(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    // Aynı sayfada yeniden doğrulama turu mu (yeni bir id değil)? Turda iskelet gösterilmez.
    const dogrulamaTuru = sonId.current === id;
    sonId.current = id;
    if (!dogrulamaTuru) setIsLoading(true);
    fetchActivityById(id, { withLikes: true })
      .then((result) => {
        if (cancelled) return;
        setFetched(result);
        setHasError(false);
        // Store'daki kopya da tazelensin (ör. bu arada gelen yorum sayısı); sunucu döndürmediyse düşsün.
        if (result) useFeedStore.getState().patchActivity(result.id, result);
        else useFeedStore.getState().removeActivity(id);
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn('[Activity] Aktivite yüklenemedi:', error);
        // Doğrulama turunda ağ hatası eldeki kopyayı silmez.
        if (!dogrulamaTuru) setFetched(null);
        setHasError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, tur]);

  const patchLocal = useCallback((patch: Partial<FeedActivity>) => {
    setFetched((cur) => (cur ? { ...cur, ...patch } : cur));
  }, []);

  // Store kopyası canlıdır (kartla ortak) → varsa o kazanır.
  const activity = fromStore ?? fetched;
  return { activity, isLoading: isLoading && !activity, hasError, patchLocal };
}
