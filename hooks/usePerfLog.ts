import { useCallback, useEffect, useState } from 'react';
import { getPerfLog, clearPerfLog, PerfMark } from '../utils/perfLog';

export interface UsePerfLogResult {
  entries: PerfMark[];
  isLoading: boolean;
  isRefreshing: boolean;
  refresh: () => Promise<void>;
  clear: () => Promise<void>;
}

/** `hooks/useErrorLog.ts` ile BİREBİR aynı iskelet — yalnızca kaynağı
 * `utils/perfLog.ts`. İki günlük türü (hata/performans) kasıtlı olarak ayrı
 * dosyalarda tutulur (bkz. o dosyanın başlığı); bu hook Geliştirici
 * Paneli'nin Performans sekmesini besler. */
export function usePerfLog(): UsePerfLogResult {
  const [entries, setEntries] = useState<PerfMark[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async () => {
    const log = await getPerfLog();
    setEntries(log);
  }, []);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        await load();
      } finally {
        setIsLoading(false);
      }
    })();
  }, [load]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await load();
    } finally {
      setIsRefreshing(false);
    }
  }, [load]);

  const clear = useCallback(async () => {
    await clearPerfLog();
    setEntries([]);
  }, []);

  return { entries, isLoading, isRefreshing, refresh, clear };
}
