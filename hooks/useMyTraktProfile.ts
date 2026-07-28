import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserProfile, getFollowers, getFollowing, TraktUserProfile } from '../services/api/social';

// Profil ekranındaki sosyal başlık (avatar, isim, takipçi/takip edilen
// sayıları) için — "me" kısaltması Trakt'ın kendi konvansiyonu (bkz.
// services/api/users.ts'teki mevcut /users/me/* çağrıları), ayrı bir
// kullanıcı adı bilinmesine gerek yok.
//
// `accessToken`/`isGuest` KORUMASI ŞART: bu hook hem `ProfileMobile.tsx` hem
// `profile.web.tsx`'te render gövdesindeki "misafirse giriş daveti göster"
// kontrolünden ÖNCE çağrılıyor (React hook kuralları gereği koşulsuz en üstte
// olmak zorunda) — eskiden bu koruma hiç yoktu, `[]` bağımlılıklı efekt
// mount'ta KOŞULSUZ ateşleniyordu. Sonuç: bir misafir Profil sekmesini
// açtığında token'sız bir `/users/me` isteği gidiyor, Trakt 401 döndürüyor,
// `traktClient.ts` refresh token da bulamayınca (misafirde zaten yok)
// `notifySessionExpired()` çağırıyor — bu da `AuthContext`'te `isGuest`'i
// `false`'a çekip misafiri doğrudan giriş ekranına fırlatıyordu (canlı hata
// günlüğünde `traktClient.401.noRefreshToken` olarak yakalandı). `useFeedPrivacy.ts`
// bunu zaten doğru yapıyordu; aynı desen buraya da taşındı.
export function useMyTraktProfile() {
  const { accessToken, isGuest } = useAuth();
  const [profile, setProfile] = useState<TraktUserProfile | null>(null);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!accessToken || isGuest) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const [myProfile, followers, following] = await Promise.all([
          getUserProfile('me'),
          getFollowers('me').catch(() => []),
          getFollowing('me').catch(() => []),
        ]);
        if (cancelled) return;
        setProfile(myProfile);
        setFollowersCount(followers.length);
        setFollowingCount(following.length);
      } catch (error) {
        console.warn('[Profile] Trakt profili yüklenemedi:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accessToken, isGuest]);

  return { profile, followersCount, followingCount, isLoading };
}
