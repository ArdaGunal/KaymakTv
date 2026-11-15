import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { fetchIzlemeDonemleri, IzlemeDonemi } from '../services/api/izlemeDonemleri';
import { logError } from '../utils/errorLog';

export type DonemDurumu = 'yukleniyor' | 'hazir' | 'hata';

/** Son `aySayisi` ayın sınırları (cihazın yerel takvimi): bu ayın başından geriye, gelecek ayın başına kadar. */
export const donemAraligi = (aySayisi: number, simdi: Date = new Date()) => ({
  bas: new Date(simdi.getFullYear(), simdi.getMonth() - (aySayisi - 1), 1),
  son: new Date(simdi.getFullYear(), simdi.getMonth() + 1, 1),
});

/**
 * «Detaylı Analiz» aylık grafiğinin verisi — her izleme kendi ayında (1.0.1 Dal 4 · `082`).
 * Ekran odağa her geldiğinde tazelenir: yeni izleme, geri alma ve ay değişimi ekranda kalır.
 * Misafirde istek atılmaz. Hata görünür durum olarak döner (grafik «veri yok» diye yalan söylemez).
 */
export function useIzlemeDonemleri(aySayisi: number) {
  const { isGuest } = useAuth();
  const [donemler, setDonemler] = useState<IzlemeDonemi[]>([]);
  const [durum, setDurum] = useState<DonemDurumu>('yukleniyor');
  const istekNo = useRef(0);

  const yukle = useCallback(async () => {
    if (isGuest) { setDonemler([]); setDurum('hazir'); return; }
    const no = ++istekNo.current;
    const { bas, son } = donemAraligi(aySayisi);
    try {
      const satirlar = await fetchIzlemeDonemleri(bas, son);
      if (no !== istekNo.current) return; // eski yanıt yenisini ezmez
      setDonemler(satirlar);
      setDurum('hazir');
    } catch (e) {
      if (no !== istekNo.current) return;
      logError('hooks.useIzlemeDonemleri', e);
      setDurum('hata');
    }
  }, [isGuest, aySayisi]);

  useFocusEffect(useCallback(() => { void yukle(); }, [yukle]));

  return { donemler, durum };
}
