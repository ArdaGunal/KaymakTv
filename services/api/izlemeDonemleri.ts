// ==========================================================================
// AY AY İZLEME ÖZETİ — Worker `POST /library/donemler` (1.0.1 Dal 3–4 · `082`)
// ==========================================================================
// Her izleme olayı kendi ayına düşer (tekrarlar dahil); gruplama cihazın IANA saat diliminde
// (karar K5). Hesap sunucuda, bütün geçmiş telefona inmez.
// Ayrı dosya: `library.ts` zaten büyük ve bu uç kütüphane mağazasına yazmıyor, yalnız analiz okur.

import axios from 'axios';
import * as SecureStore from '../../utils/secureStorage';
import { geciciseBirKezDaha } from '../../utils/geciciseTekrarla';

const KAYMAK_WORKER_URL = process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL || '';
const SINIR_MS = 15_000;

export type IzlemeDonemi = {
  /** 'YYYY-MM', istenen saat dilimine göre. */
  donem: string;
  tur: 'episode' | 'movie';
  /** İzleme olayı sayısı (tekrarlar dahil). */
  izleme: number;
  /** Bilinen + tahmini dakika. */
  dakika: number;
  tahmini: number;
  bilinmeyen: number;
};

/** Cihazın IANA saat dilimi; çözülemezse `null` (sunucu UTC kullanır). */
export const cihazSaatDilimi = (): string | null => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
};

/** Salt okur; takılan ilk bağlantıda bir kez daha dener. Hata fırlatır — çağıran görünür hata gösterir. */
export const fetchIzlemeDonemleri = async (bas: Date, son: Date): Promise<IzlemeDonemi[]> => {
  if (!KAYMAK_WORKER_URL) throw new Error('EXPO_PUBLIC_KAYMAK_WORKER_URL tanımlı değil.');
  const token = await SecureStore.getItemAsync('traktAccessToken');
  const res = await geciciseBirKezDaha(() => axios.post(
    `${KAYMAK_WORKER_URL}/library/donemler`,
    { traktAccessToken: token, tz: cihazSaatDilimi(), bas: bas.toISOString(), son: son.toISOString() },
    { headers: { 'Content-Type': 'application/json' }, timeout: SINIR_MS },
  ));
  return Array.isArray(res.data?.donemler) ? res.data.donemler : [];
};
