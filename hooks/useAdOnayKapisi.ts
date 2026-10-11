import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { getMyProfile } from '../features/feed/services/profile';

/**
 * M492 · İsim ekranı kapısı — korumalı düzende (`app/(protected)/_layout.tsx`) çalışır.
 *
 * Kullanıcı kararı (2026-10-12): «isim koymadan girememesi lazım» · «her ikisinde de
 * gösterilsin» (Trakt + Google). Worker hesap açarken adı otomatik türetiyor; kullanıcı
 * onu görüp onaylayana (ya da değiştirene) kadar `adOnaylandi === false` döner ve bu kapı
 * isim ekranına (`app/(public)/profil-olustur.tsx`) yönlendirir. Kurallardan önce açılmış
 * KURAL DIŞI adlı eski hesaplar da `063`'te onaysız bırakıldığı için buraya düşer.
 *
 * 🔒 Kimseyi KİLİTLEMEZ: ağ hatası, eski Worker (alan yok → `true`) ya da 063 uygulanmamış
 * olması → yönlendirme yok. Misafirde çalışmaz. `getMyProfile` tek uçuşlu (M461) —
 * profil ekranıyla aynı anda çağrılsa da tek istek.
 */
export function useAdOnayKapisi(): void {
  const { accessToken, isGuest } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!accessToken || isGuest) return;
    let iptal = false;
    getMyProfile(accessToken)
      .then((p) => {
        if (!iptal && p.adOnaylandi === false) router.replace('/(public)/profil-olustur');
      })
      .catch((error) => console.warn('[AdOnay] Profil okunamadı, kapı atlandı:', error));
    return () => {
      iptal = true;
    };
  }, [accessToken, isGuest, router]);
}
