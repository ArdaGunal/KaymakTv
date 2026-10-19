import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBenimProfilimStore, type ProfilBaglami } from '../store/benimProfilimStore';

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
// ══════════════════════════════════════════════════════════════════════════
// ⚡ HIZ-01 Paket 2 (M544) — VERİ ARTIK PAYLAŞILAN STORE'DA
// ══════════════════════════════════════════════════════════════════════════
// Çekme mantığı (Google-only / Trakt'lı dalları, sayılar, KaymakNo) AYNEN
// `store/benimProfilimStore.ts`'e taşındı. Bu kanca yalnız bağlar: diskteki son
// bilinen profil anında görünür, ağ arkada TEK uçuşla tazeler. Dönüş biçimi
// değişmedi — tüketiciler (profil, düzenle, akış kutusu…) dokunulmadı.
export function useMyTraktProfile() {
  const { accessToken, isGuest, authProvider, myUsername, myAvatarUrl, updateMyProfile } = useAuth();
  const veri = useBenimProfilimStore((s) => s.veri);
  const isLoading = useBenimProfilimStore((s) => s.isLoading);

  // AuthContext her çizimde yeni fonksiyon veriyor — bağımlılığa girerse sürekli yeniden çekilirdi.
  const baglamRef = useRef<ProfilBaglami>(null as unknown as ProfilBaglami);
  baglamRef.current = {
    accessToken: accessToken ?? null,
    isGuest: !!isGuest,
    authProvider: authProvider ?? null,
    myUsername: myUsername ?? null,
    myAvatarUrl: myAvatarUrl ?? null,
    updateMyProfile,
  };

  useEffect(() => {
    void useBenimProfilimStore.getState().tazele(baglamRef.current);
  }, [accessToken, isGuest, authProvider, myUsername, myAvatarUrl]);

  // `refetch` — Profili Düzenle'den dönüş / kaydetme / çekmeli yenileme: ZORLA taze.
  const refetch = useCallback(
    () => useBenimProfilimStore.getState().tazele(baglamRef.current, true),
    [],
  );

  // Odak tazelemesi: bayatsa (`TAZE_SURE_MS`) tazeler — açılışta bağlanma turu ile odak turu
  // üst üste İKİ ağ turu yapmasın (M544, Faz 3). Uygulama içi düzenleme zaten `refetch` ile zorlar.
  const tazeleGerekirse = useCallback(
    () => useBenimProfilimStore.getState().tazele(baglamRef.current),
    [],
  );

  return {
    tazeleGerekirse,
    profile: veri?.profile ?? null,
    followersCount: veri?.followersCount ?? 0,
    followingCount: veri?.followingCount ?? 0,
    // Misafirde/oturumsuzda iskelet dönmesin (eski davranış: token yoksa isLoading=false).
    isLoading: !accessToken || isGuest ? false : isLoading && !veri,
    kaymakNo: veri?.kaymakNo ?? null,
    refetch,
  };
}
