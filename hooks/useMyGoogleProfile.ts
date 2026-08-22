import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getMyProfile, MyProfile } from '../features/feed/services/profile';
import { setMySupabaseUserId } from '../features/feed/services/userBlocks';

/**
 * `account.tsx`'in "Kullanıcı Adı" satırı için — yalnızca `authProvider ===
 * 'google'` iken bir şey yapar (bkz. `EditProfileModal.tsx` başlığındaki
 * gerekçe: Trakt kullanıcılarının adı Trakt'tan senkronlanıyor, burada
 * göstermek/düzenletmek anlamsız). `useProfilePrivacy.ts`/`useFeedPrivacy.ts`
 * ile aynı kalıp — bağlanmada bir kez okur.
 *
 * Yerel `AuthContext.myUsername` yerine SUNUCUDAN taze okuyor: cooldown
 * butonunun doğru gösterilmesi (`usernameUpdatedAt`) yerel önbelleğe
 * güvenilemeyecek kadar önemli bir UI kısıtı — bkz. Worker'daki
 * `handleAccountProfileGet` başlığı.
 */
export function useMyGoogleProfile() {
  const { accessToken, authProvider } = useAuth();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!accessToken || authProvider !== 'google') {
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
        console.warn('[useMyGoogleProfile] Profil okunamadı:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, authProvider]);

  return { profile, isLoading, setProfile };
}
