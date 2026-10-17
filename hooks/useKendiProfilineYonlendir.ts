import { useEffect } from 'react';
import { useRouter } from 'expo-router';

/**
 * Kimlik Faz 6 (M522) canlı bulgu: `/u/<KaymakNo>` kişinin KENDİ numarasıysa `/user/<ad>`
 * herkese açık profil ekranına düşüyor ve «Takip Et» gösteriyordu (ekran hep
 * `isOwnProfile={false}` çiziyor). Sunucu `kendisi` derse kişi kendi Profil sekmesine gider.
 */
export function useKendiProfilineYonlendir(kendisi: boolean | undefined) {
  const router = useRouter();
  useEffect(() => {
    if (kendisi) router.replace('/(protected)/(tabs)/profile');
  }, [kendisi, router]);
}
