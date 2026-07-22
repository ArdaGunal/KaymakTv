import AsyncStorage from '@react-native-async-storage/async-storage';
import { CACHE_TTL } from './cacheTTL';

const CACHE_PREFIXES = [
  '@show_detail_',
  '@show_detail_v2_',
  '@episode_detail_',
  '@movie_detail_',
  '@tmdb_'
];

export const cacheManager = {
  // ttlMs opsiyoneldir — verilmezse STANDARD (6 saat) kullanılır, yani mevcut
  // tüm çağıranların (useShowDetail.ts, useEpisodeDetail.ts) davranışı BİREBİR
  // korunur. Farklı bir tazelik gereken veriler (örn. services/tmdbApi.ts'teki
  // nadiren değişen poster URL'leri) artık CACHE_TTL.LONG gibi ayrı bir katman
  // geçebilir — bkz. utils/cacheTTL.ts.
  async get<T>(key: string, ttlMs: number = CACHE_TTL.STANDARD): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Date.now() - parsed.timestamp < ttlMs) {
          return parsed.data as T;
        }
      }
    } catch (e) {
      console.warn(`[Cache GET Error] ${key}:`, e);
    }
    return null;
  },

  async set(key: string, data: any): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify({
        timestamp: Date.now(),
        data
      }));
    } catch (cacheErr) {
      console.warn('[Cache SET Error] Quota exceeded. Cleaning up old caches...');
      try {
        await this.clearAllCacheTypes();
        // Retry saving after cleanup
        await AsyncStorage.setItem(key, JSON.stringify({
          timestamp: Date.now(),
          data
        }));
      } catch (e) {
        console.error('Failed to clean cache or save data after cleanup:', e);
      }
    }
  },

  async clearAllCacheTypes(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(k => 
        CACHE_PREFIXES.some(prefix => k.startsWith(prefix))
      );
      
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
        console.log(`Successfully cleared ${cacheKeys.length} old cache entries to free up space.`);
      }
    } catch (e) {
      console.error('[Cache GC Error]', e);
    }
  }
};
