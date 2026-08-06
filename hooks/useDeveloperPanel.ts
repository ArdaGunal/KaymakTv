import { useCallback, useMemo } from 'react';
import { usePerfLog } from './usePerfLog';
import { useErrorLog } from './useErrorLog';
import { SLOW_THRESHOLD_MS, type PerfCategory, type PerfMark } from '../utils/perfLog';
import type { LoggedError } from '../utils/errorLog';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DevPanelStats {
  totalMeasurements: number;
  slowCount: number;
  errorCount24h: number;
  warningCount24h: number;
}

export interface CategorySummary {
  category: PerfCategory;
  avgMs: number;
  count: number;
}

export interface UseDeveloperPanelResult {
  perfEntries: PerfMark[];
  errorEntries: LoggedError[];
  stats: DevPanelStats;
  /** Görülen kategoriler + ortalama süreleri — üstteki filtre çipleri için
   * (bkz. ekran görüntüsündeki "network ø545ms" gibi çipler). Kategori hiç
   * görülmediyse listede hiç yer almaz (boş bir çip gösterilmez). */
  categorySummaries: CategorySummary[];
  isLoading: boolean;
  isRefreshing: boolean;
  refresh: () => Promise<void>;
  clearPerf: () => Promise<void>;
  clearErrors: () => Promise<void>;
}

/**
 * Geliştirici Paneli'nin TEK veri kaynağı — `usePerfLog` (ham ölçümler) ve
 * `useErrorLog` (hata/uyarı günlüğü) birleştirilip panelin ihtiyaç duyduğu
 * özet istatistiklere (üstteki 4 kart) ve kategori kırılımına (filtre
 * çipleri) dönüştürülür. İkisi de bağımsız ring buffer'lar olduğundan bu
 * hook SAF bir birleştirme/hesaplama katmanıdır, kendi başına veri tutmaz.
 */
export function useDeveloperPanel(): UseDeveloperPanelResult {
  const perf = usePerfLog();
  const err = useErrorLog();

  const stats = useMemo<DevPanelStats>(() => {
    const dayAgo = Date.now() - DAY_MS;
    const recentErrors = err.entries.filter((e) => e.timestamp >= dayAgo);
    return {
      totalMeasurements: perf.entries.length,
      slowCount: perf.entries.filter((e) => e.durationMs > SLOW_THRESHOLD_MS).length,
      errorCount24h: recentErrors.filter((e) => e.level !== 'warn').length,
      warningCount24h: recentErrors.filter((e) => e.level === 'warn').length,
    };
  }, [perf.entries, err.entries]);

  const categorySummaries = useMemo<CategorySummary[]>(() => {
    const byCategory = new Map<PerfCategory, { sum: number; count: number }>();
    for (const entry of perf.entries) {
      const bucket = byCategory.get(entry.category) || { sum: 0, count: 0 };
      bucket.sum += entry.durationMs;
      bucket.count += 1;
      byCategory.set(entry.category, bucket);
    }
    // Görülme sırası SABİT DEĞİL (Map ekleme sırasına göre) — çiplerin her
    // yenilemede yer değiştirmemesi için 'network' önce, 'startup' sonra
    // (ekran görüntüsündeki sırayla aynı) sabit bir sıralama uygulanır.
    const order: PerfCategory[] = ['network', 'startup'];
    return order
      .filter((c) => byCategory.has(c))
      .map((category) => {
        const { sum, count } = byCategory.get(category)!;
        return { category, avgMs: Math.round(sum / count), count };
      });
  }, [perf.entries]);

  const isLoading = perf.isLoading || err.isLoading;
  const isRefreshing = perf.isRefreshing || err.isRefreshing;

  const refresh = useCallback(async () => {
    await Promise.all([perf.refresh(), err.refresh()]);
  }, [perf.refresh, err.refresh]);

  return {
    perfEntries: perf.entries,
    errorEntries: err.entries,
    stats,
    categorySummaries,
    isLoading,
    isRefreshing,
    refresh,
    clearPerf: perf.clear,
    clearErrors: err.clear,
  };
}
