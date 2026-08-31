import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LedgerEntry } from './sweep';

/**
 * Kurulmuş bildirimlerin disk defteri (docs/design/notifications.md § 11).
 *
 * Karar mantığı burada DEĞİL, `sweep.ts`'te (saf ve test edilebilir).
 * Bu dosyanın tek işi defteri yazıp okumak.
 *
 * ⚠️ Zamanlayıcıya (`scheduling/scheduler.ts`) HİÇ DOKUNULMADI: defter,
 * uygulanan plan kümesinin bir kopyası olduğu için orkestrasyon katmanında
 * (`useNotificationSetup`) yazılıyor. Böylece zamanlayıcı tek işine —
 * farkı cihaza yazmaya — odaklı kalıyor.
 */
const STORAGE_KEY = 'kaymak-notification-ledger';

export async function loadLedger(): Promise<LedgerEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    // Defter okunamazsa yalnızca "hangi bildirimler düştü" bilgisi kaybolur;
    // bildirimlerin kendisi etkilenmez. Sistemi durdurmaya değmez.
    console.warn('[ledger] okunamadi:', error);
    return [];
  }
}

export async function saveLedger(entries: readonly LedgerEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (error) {
    console.warn('[ledger] yazilamadi:', error);
  }
}
