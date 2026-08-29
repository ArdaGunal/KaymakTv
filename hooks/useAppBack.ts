import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';

/**
 * Uygulamanın "ana" ekranı — geri gidilecek bir geçmiş kalmadığında oturumu
 * olan (Trakt'a bağlı VEYA misafir) kullanıcının düşeceği yer.
 */
export const APP_HOME_ROUTE = '/(protected)/(tabs)/explore';

/** Oturumu olmayan ziyaretçinin düşeceği yer: karşılama (vitrin) ekranı. */
export const LANDING_ROUTE = '/';

/**
 * TEK GERÇEK KAYNAK: "geri" davranışı.
 *
 * 🔴 NEDEN VAR (canlı testte bulundu — misafir modu, hem web hem mobil):
 * Dizi/film/bölüm detayları `(protected)` grubunun DIŞINDA, kök yığında
 * yaşıyor. Kullanıcı bu ekranlardan birine YIĞININ İLK EKRANI olarak
 * ulaştığında — web'de sayfayı yenilemek (F5), paylaşılan bir linki açmak,
 * yeni sekmede açmak; mobilde bir deep link/bildirimden girmek — geri
 * gidilecek hiçbir kayıt olmaz (`canGoBack() === false`). Eski fallback
 * `router.replace('/')` idi, yani kullanıcı KARŞILAMA (vitrin) EKRANINA
 * düşüyordu: misafir orada mahsur kalıyor, başka dizi/film incelemek için
 * baştan "Misafir Olarak Devam Et" demek zorunda kalıyordu.
 *
 * Doğru davranış: geçmiş varsa normal geri; yoksa oturumu olan kullanıcı
 * Keşfet'e, oturumu OLMAYAN ziyaretçi karşılama ekranına gider.
 *
 * `fallback` verilirse oturuma göre seçilen varsayılanı ezer (ör. profil
 * düzenleme ekranı Keşfet yerine Profil'e dönmek ister).
 */
export function useAppBack(fallback?: string) {
  const router = useRouter();
  const { accessToken, isGuest } = useAuth();

  return useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    const hasSession = !!accessToken || isGuest;
    const target = fallback ?? (hasSession ? APP_HOME_ROUTE : LANDING_ROUTE);
    router.replace(target as any);
  }, [router, accessToken, isGuest, fallback]);
}

/**
 * "Ana sayfa" (ev ikonu) davranışı — iç içe açılmış detay zincirini
 * (dizi → bölüm → dizi ...) tek dokunuşla kapatır.
 *
 * `dismissAll()` yığında kapatılacak bir şey YOKSA sessizce hiçbir şey
 * yapmıyordu; yani deep link ile açılmış bir detay sayfasında ev butonu
 * ÖLÜYDÜ (`useAppBack` ile aynı kök neden). Böyle bir durumda doğrudan
 * Keşfet'e gidiyoruz.
 */
export function useAppHome() {
  const router = useRouter();
  const { accessToken, isGuest } = useAuth();

  return useCallback(() => {
    if (router.canGoBack()) {
      router.dismissAll();
      return;
    }
    const hasSession = !!accessToken || isGuest;
    router.replace((hasSession ? APP_HOME_ROUTE : LANDING_ROUTE) as any);
  }, [router, accessToken, isGuest]);
}
