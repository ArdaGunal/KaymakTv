import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getMyProfile, MyProfile } from '../features/feed/services/profile';
import { setMySupabaseUserId } from '../features/feed/services/userBlocks';

/**
 * Ayarlar > Profil bolumu icin kendi profilimi sunucudan okur
 * (kullanici adi + avatar + ⭐ bio).
 *
 * ==========================================================================
 * 🔴 SAGLAYICI KAPISI KALKTI (§C15, 2026-09-15)
 * ==========================================================================
 * Eski hali `authProvider !== 'google'` ise HICBIR SEY yapmiyordu ve adi
 * da `useMyGoogleProfile`idi. Gerekce dogruydu ama KAPSAMI yanlisti:
 * *"Trakt kullanicilarinin adi Trakt'tan senkronlaniyor, burada
 * gostermek/duzenletmek anlamsiz."* Bu **kullanici adi** icin gecerli —
 * **aciklama (bio) icin DEGIL.** Bio hicbir yerden senkronlanmiyor; T4'te
 * bizim tablomuzda dogdu (`043`). Sonuc: Trakt'li kullanici kendi
 * aciklamasini YAZAMIYORDU ve profilinde hala Trakt'in `about`'u
 * gorunuyordu.
 *
 * 🔑 Worker tarafi zaten sağlayıcıdan BAGIMSIZDI (dogrulandi 2026-09-15):
 * `/account/profile/get` ve POST'u `resolveCallerWithReason` ile kimlik
 * cozuyor, o da Trakt token'ini `verifyTraktCaller` ile karsiliyor; bio-only
 * yazma da gecerli bir istek. Tek engel ISTEMCIDEKI bu kapiydi.
 *
 * ⚠️ Kullanici adi satiri YINE Google-only kaliyor — bu kapi
 * `ProfileUsernameSection`da, satir duzeyinde (bkz. oradaki not).
 *
 * Yerel `AuthContext.myUsername` yerine SUNUCUDAN taze okuyor: cooldown
 * butonunun dogru gosterilmesi (`usernameUpdatedAt`) yerel onbellege
 * guvenilemeyecek kadar onemli bir UI kisiti — bkz. Worker'daki
 * `handleAccountProfileGet` basligi.
 */
export function useMyProfile() {
  const { accessToken, isGuest } = useAuth();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!accessToken || isGuest) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const current = await getMyProfile(accessToken);
        if (!cancelled) setProfile(current);
        // Kimliği diske yaz — `create_new` yalnızca İLK kayıtta bir kez
        // çalışıyor, bu uç ise her açılışta. Uygulamayı yeniden kuran ya da
        // başka bir cihazdan giren Google-only kullanıcı için kimliğin tek
        // kalıcı kaynağı burası (bkz. userBlocks.getMySupabaseUserId'nin
        // disk-öncelikli tasarımı). `cancelled` olsa bile yazılır: değer
        // ekrandan bağımsız, doğru ve değişmeyen bir kimlik.
        if (current.userId) void setMySupabaseUserId(current.userId);
      } catch (error) {
        console.warn('[useMyProfile] Profil okunamadı:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, isGuest]);

  return { profile, isLoading, setProfile };
}
