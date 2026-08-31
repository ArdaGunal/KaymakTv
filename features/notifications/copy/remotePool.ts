import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../feed/services/supabaseClient';
import { parseRemoteVariants } from './remoteSchema';
import type { RemoteVariant } from './remoteSchema';
import type { NotificationCategoryId } from '../types';

/**
 * Uzak metin havuzunun çekilmesi ve önbelleklenmesi
 * (docs/design/notifications.md § 15).
 *
 * Doğrulama/birleştirme burada DEĞİL, `remoteSchema.ts`'te (saf, test edilebilir).
 * Bu dosyanın tek işi ağdan almak ve diske yazmak.
 *
 * 🔴 ASLA BLOKLAMAZ. Uzak havuz bir İYİLEŞTİRMEDİR, bağımlılık değil:
 * ağ yoksa, Supabase kapalıysa, yanıt bozuksa — gömülü havuz zaten yeterli
 * (`pool.ts`). Bu yüzden her hata yolu boş liste döndürür ve planlama
 * kesintisiz devam eder.
 *
 * 🔴 PLANLAMAYI BEKLETMEZ: çekim, bildirimler kurulduktan SONRA arka planda
 * yapılır. Yeni metinler bir sonraki planlama turunda devreye girer.
 */

const CACHE_KEY = 'kaymak-notification-remote-copy';
const CACHE_AT_KEY = 'kaymak-notification-remote-copy-at';

/** Önbellek ömrü. Metin havuzu sık değişen bir veri değil. */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Tek seferde alınacak en fazla satır — tablo şişse bile istemci korunur. */
const ROW_LIMIT = 200;

export async function loadCachedRemotePool(): Promise<RemoteVariant[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RemoteVariant[]) : [];
  } catch (error) {
    console.warn('[remotePool] onbellek okunamadi:', error);
    return [];
  }
}

async function isCacheFresh(now: number): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_AT_KEY);
    const at = raw ? Number(raw) : 0;
    return Number.isFinite(at) && now - at < CACHE_TTL_MS;
  } catch {
    return false;
  }
}

/**
 * Önbellek bayatlamışsa Supabase'ten yeniler.
 *
 * @param allowedCategories Kayıt defterindeki kategori kimlikleri
 * @returns Yeni veri alındıysa `true` — çağıran bir sonraki turda kullanır
 */
export async function refreshRemotePool(
  allowedCategories: readonly NotificationCategoryId[],
  now: number = Date.now(),
): Promise<boolean> {
  if (await isCacheFresh(now)) return false;

  try {
    const { data, error } = await supabase
      .from('notification_copy')
      .select('id, category, weight, tone, active_from, active_until, title_tr, body_tr, title_en, body_en')
      .eq('enabled', true)
      .limit(ROW_LIMIT);

    if (error) {
      // Tablo henüz oluşturulmamış olabilir (migration çalıştırılmadı) —
      // bu bir hata değil, yalnızca "uzak havuz yok" demektir.
      console.warn('[remotePool] cekilemedi:', error.message);
      return false;
    }

    const variants = parseRemoteVariants(data ?? [], allowedCategories);
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(variants));
    await AsyncStorage.setItem(CACHE_AT_KEY, String(now));
    return true;
  } catch (error) {
    console.warn('[remotePool] cekim hatasi:', error);
    return false;
  }
}
