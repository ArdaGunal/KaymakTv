import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StatsSnapshot } from './snapshot';

/**
 * Aylık özet için alınan anlık görüntünün diske yazılması
 * (docs/design/notifications.md § 14).
 *
 * Karar mantığı burada DEĞİL, `snapshot.ts`'te (saf ve test edilebilir).
 * Bu dosyanın tek işi okuyup yazmak.
 *
 * ⚠️ Tercihlerden AYRI bir anahtar: bu bir kullanıcı tercihi değil, türetilmiş
 * veri. Tercih nesnesine tıkmak, her istatistik güncellemesinde tüm tercihleri
 * gereksiz yere yeniden serialize etmek olurdu.
 */
const STORAGE_KEY = 'kaymak-notification-stats-snapshot';

export async function loadStatsSnapshot(): Promise<StatsSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Şekli doğrulanmayan veri `evaluateMonthlyStats`'e girerse yanlış bir
    // fark üretir; "yok" saymak en kötü ihtimalle bir dönem atlatır.
    return parsed && typeof parsed === 'object' && typeof parsed.takenAt === 'number'
      ? (parsed as StatsSnapshot)
      : null;
  } catch (error) {
    console.warn('[statsSnapshot] okunamadi:', error);
    return null;
  }
}

export async function saveStatsSnapshot(snapshot: StatsSnapshot): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch (error) {
    console.warn('[statsSnapshot] yazilamadi:', error);
  }
}
