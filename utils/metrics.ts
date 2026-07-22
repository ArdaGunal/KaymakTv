import * as metricsStore from './metricsStore';
import { BUCKET_BOUNDS_MS, HistogramState, HourBucket } from './metricsStore';

/**
 * Uygulama genelinde kullanılan, anlamlı isimli telemetri API'si.
 * Ham counter/histogram/gauge mekaniği `utils/metricsStore.ts`'te; bu dosya
 * yalnızca "hangi metrik hangi isimle kaydedilir" sözleşmesini ve dashboard/
 * dışa aktarım için gereken toplulaştırma (aggregation) mantığını taşır.
 */

export const recordMutationResult = (mutationName: string, success: boolean): void => {
  metricsStore.recordCounter(`mutation.${mutationName}.${success ? 'success' : 'fail'}`);
};

export const recordApiLatency = (endpointKey: string, durationMs: number): void => {
  metricsStore.recordHistogram(`api.latency.${endpointKey}`, durationMs);
};

// Faz 7 kapsamında henüz hiçbir ekrandan çağrılmıyor (bkz. docs/HISTORY.md) —
// gelecekte navigasyon süresi ölçülmek istendiğinde kullanılmaya hazır.
export const recordScreenTransition = (screenName: string, durationMs: number): void => {
  metricsStore.recordHistogram(`screen.transition.${screenName}`, durationMs);
};

export const setMemoryGauge = (name: string, value: number): void => {
  metricsStore.setGauge(`memory.${name}`, value);
};

export interface AggregatedHistogram {
  count: number;
  avg: number;
  min: number;
  max: number;
  /** p50/p95/p99: sabit kova sınırlarından DOĞRUSAL ENTERPOLASYONLA tahmin edilir
   * (Prometheus'un `histogram_quantile`'ıyla aynı yaklaşım) — ham değerler
   * saklanmadığından KESİN değildir, en son (sınırsız) kovaya düşen değerler
   * için `null` döner (üst sınır bilinmediğinden enterpolasyon yapılamaz). */
  p50: number | null;
  p95: number | null;
  p99: number | null;
}

const estimatePercentile = (hist: HistogramState, p: number): number | null => {
  if (hist.count === 0) return null;
  const targetRank = Math.ceil((p / 100) * hist.count);
  let cumulative = 0;
  let lowerBound = 0;
  for (let i = 0; i < hist.buckets.length; i++) {
    const bucketCount = hist.buckets[i];
    const upperBound = BUCKET_BOUNDS_MS[i];
    if (bucketCount > 0 && targetRank <= cumulative + bucketCount) {
      if (!Number.isFinite(upperBound)) {
        // Son ("30s+") kovaya düştü — üst sınır bilinmediğinden gerçek bir
        // enterpolasyon yapılamaz, elimizdeki en güvenilir alt sınırı döneriz.
        return lowerBound;
      }
      const positionInBucket = bucketCount === 0 ? 0 : (targetRank - cumulative) / bucketCount;
      return Math.round(lowerBound + positionInBucket * (upperBound - lowerBound));
    }
    cumulative += bucketCount;
    lowerBound = Number.isFinite(upperBound) ? upperBound : lowerBound;
  }
  return hist.max;
};

export const aggregateHistogram = (hist: HistogramState): AggregatedHistogram => ({
  count: hist.count,
  avg: hist.count > 0 ? Math.round(hist.sum / hist.count) : 0,
  min: hist.count > 0 ? hist.min : 0,
  max: hist.count > 0 ? hist.max : 0,
  p50: estimatePercentile(hist, 50),
  p95: estimatePercentile(hist, 95),
  p99: estimatePercentile(hist, 99),
});

const mergeCounters = (buckets: HourBucket[]): Record<string, number> => {
  const merged: Record<string, number> = {};
  for (const bucket of buckets) {
    for (const [name, value] of Object.entries(bucket.counters)) {
      merged[name] = (merged[name] || 0) + value;
    }
  }
  return merged;
};

const mergeHistograms = (buckets: HourBucket[]): Record<string, HistogramState> => {
  const merged: Record<string, HistogramState> = {};
  for (const bucket of buckets) {
    for (const [name, hist] of Object.entries(bucket.histograms)) {
      let target = merged[name];
      if (!target) {
        target = { count: 0, sum: 0, min: hist.min, max: hist.max, buckets: new Array(BUCKET_BOUNDS_MS.length).fill(0) };
        merged[name] = target;
      }
      target.count += hist.count;
      target.sum += hist.sum;
      target.min = Math.min(target.min, hist.min);
      target.max = Math.max(target.max, hist.max);
      hist.buckets.forEach((c, i) => { target.buckets[i] += c; });
    }
  }
  return merged;
};

/**
 * Son 24 saatlik metrikleri Ayarlar > Tanılama ekranındaki "Performans
 * Raporunu Kopyala" butonu için okunabilir bir JSON string'e dönüştürür.
 * Hem 24 saatlik TOPLAM özet hem de saat saat kırılım (hourly breakdown) içerir.
 */
export const exportMetricsReport = async (): Promise<string> => {
  const buckets = await metricsStore.getMetricsSnapshot();

  const totalCounters = mergeCounters(buckets);
  const totalHistograms = mergeHistograms(buckets);
  const aggregatedHistograms: Record<string, AggregatedHistogram> = {};
  for (const [name, hist] of Object.entries(totalHistograms)) {
    aggregatedHistograms[name] = aggregateHistogram(hist);
  }

  const latestGauges: Record<string, number> = {};
  // En güncel gauge değeri kazanır: kovalar saate göre ARTAN sıralı olduğundan
  // (metricsStore.pruneOldBuckets zaten sıralıyor) son yazan en yeni bucket'tır.
  for (const bucket of buckets) {
    Object.assign(latestGauges, bucket.gauges);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    windowHours: buckets.length,
    summary: {
      counters: totalCounters,
      histograms: aggregatedHistograms,
      gauges: latestGauges,
    },
    hourly: buckets.map((bucket) => ({
      hour: new Date(bucket.hour * 3_600_000).toISOString(),
      counters: bucket.counters,
      histograms: Object.fromEntries(
        Object.entries(bucket.histograms).map(([name, hist]) => [name, aggregateHistogram(hist)])
      ),
      gauges: bucket.gauges,
    })),
  };

  return JSON.stringify(report, null, 2);
};

export { clearMetrics } from './metricsStore';
