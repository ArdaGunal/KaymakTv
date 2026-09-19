import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getMyProfile, setAccountPrivacy } from '../features/feed/services/profile';

/**
 * Hesap gizliliği — §C29 (M406), iki hesap türü için de BİZİM ayarımız.
 *
 * ⛔ ESKİDEN Trakt'ın `user.private`'ını OKUYORDU (`GET /users/settings`) ve
 * yazamıyordu: Trakt'ın public API'sinde bu ucun yalnız GET'i var (Madde 134).
 * Sonuç: ekran «Gizlilik ayarlarını Trakt.tv'de yönet» diyordu ve Google-only
 * hesap hiç gizli olamıyordu. Kullanıcı: *"tam bağımsızlık ilan ediyorsak bu
 * hesap gizleme her iki kullanıcı için de bizde olmalı."*
 *
 * Okuma `/account/profile/get` (`isPrivate`), yazma `/account/privacy`.
 * Açığa geçişte bekleyen istekler sunucuda otomatik onaylanır (kullanıcı
 * kararı A) — `onaylananIstek` ekranda bildirilsin diye döner.
 *
 * `accessToken`/`isGuest` koruması şart — bu hook ekranın «misafirse gizle»
 * kontrolünden ÖNCE çağrılıyor (hook kuralları), bkz. `useMyTraktProfile`.
 */
export function useProfilePrivacy() {
  const { accessToken, isGuest } = useAuth();
  const [isPrivate, setIsPrivate] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!accessToken || isGuest) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const profil = await getMyProfile(accessToken);
        if (!cancelled) setIsPrivate(profil.isPrivate);
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

  /**
   * İyimser: anahtar hemen döner, sunucu reddederse ESKİ değere geri alınır
   * ve hata fırlatılır — çağıran ekran kullanıcıya söyler (sessiz başarısızlık
   * yok, AI_RULES §2).
   */
  const setPrivacy = useCallback(
    async (yeni: boolean): Promise<{ onaylananIstek: number }> => {
      if (!accessToken || isGuest) throw new Error('Giriş gerekli.');
      const onceki = isPrivate;
      setIsPrivate(yeni);
      setIsSaving(true);
      try {
        const sonuc = await setAccountPrivacy(accessToken, yeni);
        setIsPrivate(sonuc.isPrivate);
        return { onaylananIstek: sonuc.onaylananIstek };
      } catch (error) {
        setIsPrivate(onceki);
        throw error;
      } finally {
        setIsSaving(false);
      }
    },
    [accessToken, isGuest, isPrivate]
  );

  return { isPrivate, isLoading, isSaving, setPrivacy };
}
