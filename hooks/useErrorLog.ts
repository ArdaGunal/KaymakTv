import { useCallback, useEffect, useState } from 'react';
import { getErrorLog, clearErrorLog, LoggedError } from '../utils/errorLog';

export interface UseErrorLogResult {
  entries: LoggedError[];
  isLoading: boolean;
  isRefreshing: boolean;
  refresh: () => Promise<void>;
  clear: () => Promise<void>;
}

export function useErrorLog(): UseErrorLogResult {
  const [entries, setEntries] = useState<LoggedError[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async () => {
    const log = await getErrorLog();
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
    await clearErrorLog();
    setEntries([]);
  }, []);

  return { entries, isLoading, isRefreshing, refresh, clear };
}
