import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Metriklerin (counter/histogram/gauge) diskteki (AsyncStorage) düşük
 * seviye kalıcılık katmanı. `utils/metrics.ts` bu modülün üzerine anlamlı
 * isimlerle (mutation.*, api.latency.* vb.) ince bir katman kurar — bu
 * dosya yalnızca "saat başına bir kova, en fazla 24 kova" mekaniğinden
 * ve diske yazmadan sorumludur.
 *
 * Tasarım kararları:
 * - Ham değerler (her API isteğinin tam süresi gibi) SINIRSIZ biriktirilmez —
 *   sabit sınırlı (100ms/500ms/1s/5s/30s) kovalara dağıtılır. Bir güçlü
 *   kullanıcı günde binlerce istek atsa bile depolama sabit kalır.
 * - Yazmalar HER kayıtta değil, 3 saniyelik bir debounce ile toplu (coalesced)
 * yapılır — art arda hızlı gelen onlarca `recordHistogram` çağrısı (örn.
 * Faz 4'teki requestQueue patlaması) AsyncStorage'ı spam'lemesin diye.
 * - Kamuya açık fonksiyonlar SENKRONDUR (void döner) — `errorLog.ts`'teki
 *   `logError` ile aynı "fire-and-forget" deseni: telemetri hiçbir zaman
 *   çağıran akışı bloklamamalı/bozmamalı.
 */

const METRICS_KEY = '@kaymak_metrics_v1';
const MAX_HOURS = 24;
const FLUSH_DEBOUNCE_MS = 3000;

// Prometheus tarzı sabit histogram kovaları (spesifikasyondaki eşikler).
export const BUCKET_BOUNDS_MS = [100, 500, 1000, 5000, 30000, Infinity] as const;

export interface HistogramState {
  count: number;
  sum: number;
  min: number;
  max: number;
  buckets: number[]; // BUCKET_BOUNDS_MS ile paralel, kova başına sayaç
}

export interface HourBucket {
  hour: number; // Math.floor(ts / 3_600_000)
  counters: Record<string, number>;
  histograms: Record<string, HistogramState>;
  gauges: Record<string, number>;
}

let buckets: HourBucket[] = [];
let hydrated = false;
let hydrationPromise: Promise<void> | null = null;
let writeQueue: Promise<void> = Promise.resolve();
let flushScheduled = false;

const currentHour = () => Math.floor(Date.now() / 3_600_000);

const hydrate = (): Promise<void> => {
  if (hydrated) return Promise.resolve();
  if (!hydrationPromise) {
    hydrationPromise = AsyncStorage.getItem(METRICS_KEY)
      .then((raw) => {
        buckets = raw ? JSON.parse(raw) : [];
      })
      .catch(() => {
        buckets = [];
      })
      .finally(() => {
        hydrated = true;
      });
  }
  return hydrationPromise;
};
// Modül import edilir edilmez hydration başlar — ilk birkaç `record*` çağrısı
// (hydration bitmeden gelirse) aşağıdaki `withBucket` içinde sıraya girer,
// veri kaybı olmaz.
hydrate();

const pruneOldBuckets = () => {
  buckets.sort((a, b) => a.hour - b.hour);
  const cutoff = currentHour() - MAX_HOURS + 1;
  buckets = buckets.filter((b) => b.hour >= cutoff);
};

const getOrCreateHourBucket = (): HourBucket => {
  const hour = currentHour();
  let bucket = buckets.find((b) => b.hour === hour);
  if (!bucket) {
    bucket = { hour, counters: {}, histograms: {}, gauges: {} };
    buckets.push(bucket);
    pruneOldBuckets();
  }
  return bucket;
};

const scheduleFlush = () => {
  if (flushScheduled) return;
  flushScheduled = true;
  writeQueue = writeQueue.then(async () => {
    await new Promise((resolve) => setTimeout(resolve, FLUSH_DEBOUNCE_MS));
    flushScheduled = false;
    try {
      await AsyncStorage.setItem(METRICS_KEY, JSON.stringify(buckets));
    } catch {
      // Metrik kaybı kritik değil — sessizce yoksay, bir sonraki kayıt tekrar dener.
    }
  });
};

const withBucket = (mutator: (bucket: HourBucket) => void): void => {
  const apply = () => {
    mutator(getOrCreateHourBucket());
    scheduleFlush();
  };
  if (hydrated) {
    apply();
    return;
  }
  // Hydration devam ediyor: aynı `hydrationPromise`'a zincirlenen `.then`
  // çağrıları JS microtask kuyruğunda EKLENME sırasına göre çalışır, yani
  // hydration bitmeden gelen kayıtlar sırayla (kayıpsız) uygulanır.
  hydrate().then(apply);
};

export const recordCounter = (name: string, delta = 1): void => {
  withBucket((bucket) => {
    bucket.counters[name] = (bucket.counters[name] || 0) + delta;
  });
};

export const recordHistogram = (name: string, valueMs: number): void => {
  withBucket((bucket) => {
    let hist = bucket.histograms[name];
    if (!hist) {
      hist = { count: 0, sum: 0, min: valueMs, max: valueMs, buckets: new Array(BUCKET_BOUNDS_MS.length).fill(0) };
      bucket.histograms[name] = hist;
    }
    hist.count += 1;
    hist.sum += valueMs;
    hist.min = Math.min(hist.min, valueMs);
    hist.max = Math.max(hist.max, valueMs);
    const idx = BUCKET_BOUNDS_MS.findIndex((bound) => valueMs <= bound);
    hist.buckets[idx === -1 ? BUCKET_BOUNDS_MS.length - 1 : idx] += 1;
  });
};

export const setGauge = (name: string, value: number): void => {
  withBucket((bucket) => {
    bucket.gauges[name] = value;
  });
};

/** Son (en fazla) 24 saatlik kova listesini döndürür — dashboard/export için. */
export const getMetricsSnapshot = async (): Promise<HourBucket[]> => {
  await hydrate();
  pruneOldBuckets();
  return buckets;
};

export const clearMetrics = async (): Promise<void> => {
  buckets = [];
  hydrated = true;
  try {
    await AsyncStorage.removeItem(METRICS_KEY);
  } catch {
    // yoksay
  }
};
