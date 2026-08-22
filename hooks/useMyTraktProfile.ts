import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserProfile, getFollowers, getFollowing, TraktUserProfile } from '../services/api/social';
import { getMyProfile } from '../features/feed/services/profile';

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
//
// 🔴 2026-08-22 — AYNI HATA SINIFININ ÜÇÜNCÜ HÂLİ: Google-only kullanıcı
// (`create_new`, Madde 221) misafirle aynı durumda değil — elinde DOLU bir
// `accessToken` var, ama o bir Trakt token'ı DEĞİL (Kaymak oturum token'ı).
// Yukarıdaki misafir koruması onu geçiriyordu; `/users/me` 401 dönüyor,
// `profile` sonsuza dek `null` kalıyor ve profil ekranı GRİ YANIP SÖNEN bir
// iskelet gösteriyordu (kullanıcı canlı testte bildirdi). Y23 sayesinde artık
// çıkışa atılmıyor ama ekran da hiç dolmuyordu.
//
// Bu kullanıcının adı/fotoğrafı ZATEN BİZDE (`AuthContext.myUsername`/
// `myAvatarUrl`, Worker'ın `/account/profile/get`'inden gelir) — Trakt'a hiç
// gitmeden yerel bir profil sentezleniyor. Takipçi/takip sayıları 0: Trakt'sız
// kullanıcının Trakt sosyal grafiği YOK, bu bir hata değil GERÇEK durum.
export function useMyTraktProfile() {
  const { accessToken, isGuest, authProvider, myUsername, myAvatarUrl } = useAuth();
  const [profile, setProfile] = useState<TraktUserProfile | null>(null);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // `refetch` olarak da dışa aktarılıyor — Profili Düzenle ekranından
  // `router.back()` ile dönüldüğünde profil ekranının `useFocusEffect` ile
  // güncel veriyi çekebilmesi için (bkz. screens/ProfileMobile.tsx).
  // `isMounted` parametresi, mount-effect'in unmount/deps-değişimi sonrası
  // yarışan bir yanıtı sessizce yok saymasını sağlar — `refetch()` çağrıları
  // bu korumaya ihtiyaç duymadığı için `undefined` bırakır.
  const fetchProfile = useCallback(
    async (isMounted?: () => boolean) => {
      if (!accessToken || isGuest) {
        setIsLoading(false);
        return;
      }
      // Google-only: Trakt'a HİÇ gitme (bkz. başlık). Kaynak SUNUCU —
      // `AuthContext.myUsername`/`myAvatarUrl` yalnızca `create_new` anında
      // yazılıyor, yani BU özellikten ÖNCE açılmış hesapların diskinde hiç
      // yok (2026-08-22 testinde profil resmi bu yüzden gelmedi). Worker'ın
      // `/account/profile/get`'i her zaman güncel gerçeği veriyor; yerel
      // değerler yalnızca ağ düşerse devreye giren yedek.
      if (authProvider === 'google') {
        let username = myUsername ?? '';
        let avatarUrl = myAvatarUrl ?? null;
        try {
          const remote = await getMyProfile(accessToken);
          username = remote.username || username;
          avatarUrl = remote.avatarUrl ?? avatarUrl;
        } catch (error) {
          console.warn('[Profile] Kaymak profili okunamadı, yerel kopyaya düşülüyor:', error);
        }
        if (isMounted && !isMounted()) return;
        setProfile({
          username,
          private: false,
          name: username || null,
          vip: false,
          // Google-only kullanıcının Trakt slug'ı YOK — boş bırakmak doğru.
          ids: { slug: '' },
          images: avatarUrl ? { avatar: { full: avatarUrl } } : undefined,
        });
        // Trakt'sız kullanıcının Trakt sosyal grafiği YOK: 0 bir hata değil,
        // gerçek durum.
        setFollowersCount(0);
        setFollowingCount(0);
        setIsLoading(false);
        return;
      }
      try {
        const [myProfile, followers, following] = await Promise.all([
          getUserProfile('me'),
          getFollowers('me').catch(() => []),
          getFollowing('me').catch(() => []),
        ]);
        if (isMounted && !isMounted()) return;
        setProfile(myProfile);
        setFollowersCount(followers.length);
        setFollowingCount(following.length);
      } catch (error) {
        console.warn('[Profile] Trakt profili yüklenemedi:', error);
      } finally {
        if (!isMounted || isMounted()) setIsLoading(false);
      }
    },
    [accessToken, isGuest, authProvider, myUsername, myAvatarUrl]
  );

  useEffect(() => {
    let cancelled = false;
    fetchProfile(() => !cancelled);
    return () => {
      cancelled = true;
    };
  }, [fetchProfile]);

  return { profile, followersCount, followingCount, isLoading, refetch: fetchProfile };
}
