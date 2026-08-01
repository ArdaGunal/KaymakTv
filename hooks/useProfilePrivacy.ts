import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getProfilePrivacy } from '../services/api/users';

/**
 * Trakt'ın hesap düzeyindeki Gizli/Açık Hesap ayarı (`user.private`) —
 * **SALT OKUNUR**.
 *
 * ⛔ BURAYA BİR `toggle`/`setPrivate` EKLEMEYİN (bkz. docs/HISTORY.md Madde 134):
 * Trakt'ın public API'sinde `/users/settings` için yalnızca `GET` vardır; yazma
 * (`PUT`) first-party bir uç noktadır ve üçüncü parti anahtarla her zaman
 * `401 invalid_token` döner. Eskiden burada iyimser (optimistic) bir `toggle`
 * vardı ve kullanıcıya çalışıyormuş gibi görünüyordu — gerçekte Trakt'a HİÇ
 * yazmıyordu (Madde 122'de eklenmiş, hiçbir zaman uçtan uca doğrulanmamıştı).
 * Kullanıcı artık Ayarlar'dan durumunu GÖRÜYOR ve değiştirmek için trakt.tv'ye
 * yönlendiriliyor.
 *
 * KaymakTV'nin kendi Supabase tabanlı akış gizliliğinden
 * (publishWatches/publishRatings — `features/feed/hooks/useFeedPrivacy.ts`)
 * TAMAMEN BAĞIMSIZDIR; o ayarlar bizim kendi backend'imizde olduğu için
 * değiştirilebilir durumda kalmaya devam ediyor.
 */
export function useProfilePrivacy() {
  const { accessToken, isGuest } = useAuth();
  const [isPrivate, setIsPrivate] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!accessToken || isGuest) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const current = await getProfilePrivacy();
        if (!cancelled) setIsPrivate(current);
      } catch (error) {
        console.warn('[useProfilePrivacy] Gizlilik durumu okunamadı:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, isGuest]);

  return { isPrivate, isLoading };
}
