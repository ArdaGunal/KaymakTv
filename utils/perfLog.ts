import AsyncStorage from '@react-native-async-storage/async-storage';

const PERF_LOG_KEY = '@kaymak_perf_log_v1';
const MAX_ENTRIES = 60;

/** Bir ölçümün ait olduğu alan. 'network': Trakt isteği (bkz. traktClient.ts
 * interceptor'ı). 'startup': uygulama açılış aşaması (VersionGate, oturum
 * yükleme, toplam açılış — bkz. useVersionGate.ts / AuthContext.tsx / _layout.tsx). */
export type PerfCategory = 'network' | 'startup';

/** Geliştirici Paneli'nin "Yavaş" saydığı eşik — hem satır rengi hem de
 * üstteki "Yavaş (>500ms)" istatistik kartı BU sabitten türetilir, iki
 * yerde ayrı ayrı "500" yazılmaz. */
export const SLOW_THRESHOLD_MS = 500;

export interface PerfMark {
  timestamp: number;
  /** İnsan tarafından okunabilir ölçüm adı (ör. `/sync/watched/shows`,
   * 'Oturum Başlatma'). Ham veri kasıtlı — yeni bir endpoint/aşama eklemek
   * için burada bir eşleme tablosu güncellemek GEREKMEZ. */
  name: string;
  category: PerfCategory;
  durationMs: number;
}

// errorLog.ts'teki SIRALI yazma kuyruğuyla AYNI desen: art arda hızlı gelen
// ölçümler (ör. bir senkron turunda onlarca ağ isteği) birbirinin
// read-modify-write'ının üstüne yazıp önceki kayıtları kaybetmesin diye.
let writeQueue: Promise<void> = Promise.resolve();

/**
 * Kalıcı, sabit boyutlu (ring buffer, en fazla 60 kayıt) HAM performans
 * günlüğü. `utils/metrics.ts`teki saatlik histogram TOPLULAŞTIRMASININ
 * (yalnızca ortalama/p95 verir, hangi TEKİL çağrının ne kadar sürdüğünü
 * kaybeder) yanında, Geliştirici Paneli'nin "son N ölçüm" listesini
 * göstermesi için ayrı bir kayıt tutar. Yazma fire-and-forget'tir — ana
 * akışı asla bloklamaz/bozmaz (bkz. errorLog.ts'teki aynı gerekçe).
 */
export const recordPerfMark = (name: string, category: PerfCategory, durationMs: number): void => {
  const entry: PerfMark = { timestamp: Date.now(), name, category, durationMs: Math.round(durationMs) };

  writeQueue = writeQueue.then(async () => {
    try {
      const raw = await AsyncStorage.getItem(PERF_LOG_KEY);
      const existing: PerfMark[] = raw ? JSON.parse(raw) : [];
      const updated = [entry, ...existing].slice(0, MAX_ENTRIES);
      await AsyncStorage.setItem(PERF_LOG_KEY, JSON.stringify(updated));
    } catch {
      // Performans günlüğünün kendisi başarısız olursa sessizce yutulur —
      // bu bir teşhis aracıdır, ana akışı asla etkilememeli.
    }
  });
};

/** En yeniden eskiye, son kaydedilen ölçümler (Geliştirici Paneli için). */
export const getPerfLog = async (): Promise<PerfMark[]> => {
  try {
    const raw = await AsyncStorage.getItem(PERF_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const clearPerfLog = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(PERF_LOG_KEY);
  } catch {
    // yoksay
  }
};
