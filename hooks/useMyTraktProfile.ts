import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserProfile, TraktUserProfile } from '../services/api/social';
import { fetchKaymakGraph } from '../services/api/kaymakSocial';
import { getMyProfile } from '../features/feed/services/profile';
import { logError } from '../utils/errorLog';

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
// gitmeden yerel bir profil sentezleniyor.
//
// ══════════════════════════════════════════════════════════════════════════
// 🪪 TAKİPÇİ/TAKİP SAYILARI ARTIK BİZİM GRAFTAN — İKİ SAĞLAYICI İÇİN DE (M338)
// ══════════════════════════════════════════════════════════════════════════
// ⛔ ESKİDEN Trakt'lı kullanıcıda `getFollowers('me')`/`getFollowing('me')`
// (Trakt) sayılıyordu, Google-only kullanıcıda ise sabit 0 yazılıyordu ("Trakt
// sosyal grafı YOK, 0 gerçek durum"). T3.3'ten sonra ikisi de YANLIŞ: takip
// grafının tek otoritesi bizim veritabanımız (karar §5.1). Eski hâliyle biri
// takip edildiğinde kendi "Takip Edilen" sayın hiç değişmezdi.
// Yan kazanç: Trakt'lı kullanıcıda profil açılışı Trakt'a 3 değil 1 istek atıyor
// (iki liste yalnızca `.length` için indiriliyordu).
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

      // Sayılar iki sağlayıcıda da AYNI kaynaktan. Düşerse önceki değer
      // KORUNUR (0'a çekilmez) — "0 takipçi" yalanı, "sayı güncellenemedi"den
      // kötü; ama sessiz de kalmıyor.
      const sayilariTazele = async () => {
        try {
          const graf = await fetchKaymakGraph();
          if (isMounted && !isMounted()) return;
          setFollowersCount(graf.followersCount);
          setFollowingCount(graf.followingCount);
        } catch (error) {
          logError('useMyTraktProfile.graf', error);
        }
      };

      // Google-only: Trakt'a HİÇ gitme (bkz. başlık). Kaynak SUNUCU —
      // `AuthContext.myUsername`/`myAvatarUrl` yalnızca `create_new` anında
      // yazılıyor, yani BU özellikten ÖNCE açılmış hesapların diskinde hiç
      // yok (2026-08-22 testinde profil resmi bu yüzden gelmedi). Worker'ın
      // `/account/profile/get`'i her zaman güncel gerçeği veriyor; yerel
      // değerler yalnızca ağ düşerse devreye giren yedek.
      if (authProvider === 'google') {
        let username = myUsername ?? '';
        let avatarUrl = myAvatarUrl ?? null;
        let bio: string | null = null;
        let displayName: string | null = null;
        try {
          const remote = await getMyProfile(accessToken);
          username = remote.username || username;
          // 🔑 Sunucu yanıt VERDİYSE onun fotoğrafı esastır — `null` "kaldırıldı"
          // demektir, yerel kopyaya düşülmez (§C24: kaldırma kalıcı olmalı).
          avatarUrl = remote.avatarUrl;
          bio = remote.bio;
          displayName = remote.displayName;
        } catch (error) {
          console.warn('[Profile] Kaymak profili okunamadı, yerel kopyaya düşülüyor:', error);
        }
        if (isMounted && !isMounted()) return;
        setProfile({
          username,
          private: false,
          // §C24 · `053` — görünen ad bizden. `null` → ekran @username'e düşer
          // (eskiden burada kullanıcı adı "ad" gibi tekrar ediliyordu).
          name: displayName,
          vip: false,
          // Google-only kullanıcının Trakt slug'ı YOK — boş bırakmak doğru.
          ids: { slug: '' },
          images: avatarUrl ? { avatar: { full: avatarUrl } } : undefined,
          // T4 · `043` — açıklama bizden. (§C15'ten sonra Trakt'lı dal da
          // aynısını yapıyor; aşağıya bak.)
          about: bio,
        });
        await sayilariTazele();
        if (!isMounted || isMounted()) setIsLoading(false);
        return;
      }
      // ══════════════════════════════════════════════════════════════════
      // 🪪 TRAKT'LI KULLANICI — açıklama artık BİZDEN (§C15, 2026-09-15)
      // ══════════════════════════════════════════════════════════════════
      // Bu dalın eski hâli yalnızca Trakt'ı okuyordu ve kendi yorumu bunu
      // itiraf ediyordu: *"Trakt'lı kullanıcıda hâlâ Trakt'ın `about`'u"*.
      // Ayarlar'da açıklama yazabilen ama kendi profilinde onu göremeyen bir
      // kullanıcı, yarım bir özellik demekti.
      //
      // 🔑 ÖNCELİK `usePublicProfileIdentity` İLE AYNI: bizim bio varsa o,
      // yoksa Trakt'ın `about`'u. İki ekranın aynı kişide FARKLI açıklama
      // göstermesi, düzeltmenin kendisinden kötü bir hata olurdu.
      //
      // ⏱️ Gecikme EKLEMİYOR: istek Trakt çağrısıyla PARALEL gidiyor ve
      // hedefi Trakt değil kendi Worker'ımız — başlıktaki "3 istek → 1"
      // kazanımı Trakt tarafında aynen duruyor.
      try {
        const [myProfile, kaymakProfil] = await Promise.all([
          getUserProfile('me'),
          // 🔴 DÜŞERSE `null`: Trakt'ın `about`'u KORUNUR. "Boş yanıt" ile
          // "yanıt yok" ayrı şeyler — boşla ezmek kullanıcının açıklamasını
          // ekrandan silerdi (M381'in dersi).
          getMyProfile(accessToken).catch((error) => {
            logError('useMyTraktProfile.kaymakBio', error);
            return null;
          }),
          sayilariTazele(),
        ]);
        if (isMounted && !isMounted()) return;
        // ══════════════════════════════════════════════════════════════
        // 🪪 §C24 · AD VE FOTOĞRAF DA BİZDEN (2026-09-18)
        // ══════════════════════════════════════════════════════════════
        // Kullanıcı: *"tamamen bizim sistemde olacak bu kısımlar."* Worker
        // Trakt'taki adı ve fotoğrafı ilk istekte BİR KEZ kopyalıyor — ve bu
        // `getMyProfile` çağrısının kendisi o istek, yani yanıt geldiğinde
        // kopya çoktan yazılmış oluyor. Bu yüzden Trakt'a GERİ DÜŞÜLMEZ:
        // kullanıcı fotoğrafını kaldırdıysa `null` gerçektir; Trakt'ınkini
        // göstermek kaldırmayı ekranda geri almak olurdu.
        //
        // 🔴 Bizim yanıt YOKSA (`null` — ağ düştü) Trakt'ın profili aynen
        // gösterilir: "yanıt yok" ≠ "boş yanıt" (M381'in dersi).
        //
        // `username` hâlâ Trakt'tan (`@` altındaki satır ve rotalar) — K2:
        // Trakt'lı hesapta kullanıcı adı değişmiyor, ikisi aynı.
        setProfile(
          kaymakProfil
            ? {
                ...myProfile,
                name: kaymakProfil.displayName,
                images: kaymakProfil.avatarUrl ? { avatar: { full: kaymakProfil.avatarUrl } } : undefined,
                about: kaymakProfil.bio ?? myProfile.about,
              }
            : myProfile
        );
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
