import AsyncStorage from '@react-native-async-storage/async-storage';

const PERF_LOG_KEY = '@kaymak_perf_log_v1';
const MAX_ENTRIES = 60;

/** Bir ölçümün ait olduğu alan. 'network': Trakt isteği (bkz. traktClient.ts
 * interceptor'ı). 'startup': uygulama açılış aşaması (VersionGate, oturum
 * yükleme, toplam açılış — bkz. useVersionGate.ts / AuthContext.tsx / _layout.tsx). */
export type PerfCategory = 'network' | 'startup';

/** Geliştirici Paneli'nin ölçüm satırlarını (nokta rengi + süre rengi) VE
 * üstteki istatistik kartlarını sınıflandırdığı İKİ eşik — üç ayrı yerde
 * (satır rengi, "Orta"/"Kritik" kart sayaçları) ayrı ayrı "500"/"2000"
 * yazılmasın diye TEK kaynak burası. Bantlar AYRIKTIR (birbirini kapsamaz):
 * yeşil ≤500ms, turuncu (500ms, 2000ms], kırmızı >2000ms. */
export const SLOW_THRESHOLD_MS = 500;
export const CRITICAL_THRESHOLD_MS = 2000;

/** Geliştirici Paneli'ndeki mini süre çubuğunun (DurationBar) "dolu" saydığı
 * üst sınır — TEK kaynak burası, bileşen kendi başına bir tavan icat etmez.
 * Listedeki EN YAVAŞ isteğe göre ORANTILI ölçeklemek YERİNE sabit bir tavan
 * seçildi: aksi halde tek bir 30sn'lik zaman aşımı, diğer TÜM çubukları
 * görünmez kılacak kadar küçültürdü (liste her değiştiğinde de anlamı
 * kayardı). 3000ms, kritik eşiğin (2000ms) hemen ötesinde bir nefes payı
 * bırakır: kritik istekler bile bar'ı her zaman tam doldurmaz.
 */
export const BAR_MAX_MS = 3000;

export interface PerfMark {
  timestamp: number;
  /** İnsan tarafından okunabilir ölçüm adı (ör. `/sync/watched/shows`,
   * 'Oturum Başlatma'). Ham veri kasıtlı — yeni bir endpoint/aşama eklemek
   * için burada bir eşleme tablosu güncellemek GEREKMEZ. */
  name: string;
  category: PerfCategory;
  durationMs: number;
  /** HTTP durum kodu — yalnızca `category: 'network'` için dolu (Trakt
   * yanıt VERDİYSE, bkz. traktClient.ts). Yanıtsız ağ hataları (timeout/DNS)
   * zaten hiç `recordPerfMark` çağırmıyor (bkz. `recordApiLatency` ile AYNI
   * kural) — yani bir 'network' satırında bu alan varsa her zaman gerçek bir
   * sunucu yanıtını temsil eder, "bilinmiyor" durumu yoktur. 'startup'
   * ölçümlerinde HİÇ yoktur (HTTP isteği değildir). */
  statusCode?: number;
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
export const recordPerfMark = (
  name: string,
  category: PerfCategory,
  durationMs: number,
  statusCode?: number
): void => {
  const entry: PerfMark = {
    timestamp: Date.now(),
    name,
    category,
    durationMs: Math.round(durationMs),
    ...(statusCode ? { statusCode } : {}),
  };

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
