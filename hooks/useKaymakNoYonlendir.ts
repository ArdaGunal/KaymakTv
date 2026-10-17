import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { kaymakNoCoz } from '../services/api/kaymakNoCozucu';

export type YonlendirmeDurumu = 'calisiyor' | 'yok' | 'gorulemez' | 'hata';

/**
 * Kimlik Faz 6 (M522) · D7 — `kaymaktv.com/u/<KaymakNo>`:
 *   girişsiz / misafir → giriş ekranı (D6: KaymakNo yalnız giriş yapmışa)
 *   girişli           → numara ada çevrilir → `/user/<ad>` (gizlilik kuralları orada)
 */
export function useKaymakNoYonlendir(no: string | undefined) {
  const { accessToken, isGuest, isLoading } = useAuth();
  const router = useRouter();
  const [durum, setDurum] = useState<YonlendirmeDurumu>('calisiyor');

  useEffect(() => {
    if (isLoading) return;
    if (!accessToken || isGuest) {
      router.replace('/(public)/settings');
      return;
    }
    if (!no) { setDurum('yok'); return; }
    let canli = true;
    kaymakNoCoz(accessToken, no)
      .then((sonuc) => {
        if (!canli) return;
        if (sonuc === 'yok' || sonuc === 'gorulemez') setDurum(sonuc);
        else router.replace(`/user/${encodeURIComponent(sonuc)}`);
      })
      .catch(() => canli && setDurum('hata'));
    return () => { canli = false; };
  }, [no, accessToken, isGuest, isLoading, router]);

  return durum;
}
