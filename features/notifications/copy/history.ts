import AsyncStorage from '@react-native-async-storage/async-storage';
import { logError } from '../../../utils/errorLog';
import type { NotificationCategoryId } from '../types';

/**
 * "Son gösterilen varyantlar" geçmişi — kategori başına küçük bir halka.
 * (docs/design/notifications.md § 4)
 *
 * Seçim mantığı burada DEĞİL, `picker.ts`'te (saf ve test edilebilir).
 * Bu dosyanın tek işi o listeyi diske yazıp geri okumak.
 *
 * ⚠️ Ayrı bir AsyncStorage anahtarı: tercihlerle (`kaymak-notification-prefs`)
 * aynı yere yazılsaydı, her bildirim planlamasında kullanıcı tercihleri de
 * gereksiz yere yeniden serialize edilirdi.
 */
const STORAGE_KEY = 'kaymak-notification-copy-history';

export type CopyHistory = Partial<Record<NotificationCategoryId, string[]>>;

export async function loadCopyHistory(): Promise<CopyHistory> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // Bozuk/elle kurcalanmış veri seçiciyi çökertmesin: şekli doğrulanmayan
    // her şey "geçmiş yok" sayılır. En kötü sonucu bir kez tekrar eden metin.
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    logError('notifications.loadCopyHistory', error);
    return {};
  }
}

export async function saveCopyHistory(history: CopyHistory): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (error) {
    // Geçmiş yazılamazsa sistem çalışmaya devam eder, yalnızca çeşitlilik
    // zayıflar — bildirim planlamasını bu yüzden durdurmak orantısız olurdu.
    logError('notifications.saveCopyHistory', error);
  }
}
