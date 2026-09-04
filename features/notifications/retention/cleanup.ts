import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { logError } from '../../../utils/errorLog';
import { NOTIFICATION_CATEGORIES } from '../registry';
import type { NotificationCategoryId } from '../types';
import { temizlenecekler, type PresentedInfo } from './cleanupRules';

/**
 * Bildirim TEPSİSİ temizliği — ADAPTÖR (docs/design/notifications.md § 8-(2)).
 *
 * 🔴 ÇÖZÜLEN SORUN: kullanıcı uygulamayı 8 gün açmazsa tepside 8 tane
 * "bugün yeni bölüm" bildirimi birikir. Uygulamayı açtığı an o yığın
 * ANLAMSIZLAŞIR — kullanıcı zaten geldi. Temizlenmezse bildirimler
 * "okunmamış" gibi durmaya devam eder ve sistem bakımsız görünür.
 *
 * ⚙️ KARAR BURADA DEĞİL: hangi bildirimin temizleneceğine `cleanupRules.ts`
 * (SAF) karar veriyor; bu dosya yalnızca okuma/silme yapar. Gerekçesi orada.
 *
 * ==========================================================================
 * 🔴 KUTUYU (inbox) BOZMAZ — ÖLÇÜLDÜ, VARSAYILMADI
 * ==========================================================================
 * İlk bakışta tehlikeli görünüyor: "tepsiyi silersek uygulama içindeki zil
 * listesi ne olacak?" Cevap: hiçbir şey. `inbox/sweep.ts` başlığı bunu zaten
 * çözmüş — kutu `getPresentedNotificationsAsync()`'e DEĞİL, diske yazılan
 * **deftere** (ledger) dayanıyor. Gerekçesi orada yazılı: tepsi zaten
 * güvenilmez, çünkü kullanıcı bildirimi kaydırıp atarsa kaybolur.
 *
 * Yani defter yaklaşımı bu temizliği baştan güvenli kılmış. Sıralama tuzağı
 * YOK: önce de temizlense sonra da, kutu aynı kalır.
 */

/** `scheduler.ts` ile AYNI koruma: web'de `expo-notifications` yok. */
const isSupportedPlatform = (): boolean => Platform.OS !== 'web';

/**
 * 🔴 `scheduler.ts` ile AYNI KAYNAK. Ayrı bir liste tutulsaydı, kayıt
 * defterine bir kategori eklendiğinde biri sessizce geride kalırdı.
 */
const ownedCategoryIds = new Set<string>(NOTIFICATION_CATEGORIES.map((c) => c.id));

/** `expo-notifications` yanıtını saf katmanın anladığı şekle indirger. */
function toPresentedInfo(n: Notifications.Notification): PresentedInfo {
  const data = n?.request?.content?.data as { categoryId?: unknown } | undefined;
  return {
    identifier: n?.request?.identifier ?? '',
    categoryId: typeof data?.categoryId === 'string' ? data.categoryId : null,
  };
}

/**
 * Tepsiyi temizler.
 *
 * 🔴 ASLA THROW ETMEZ. Açılış akışından (`useNotificationSetup`) çağrılıyor;
 * buradan sızacak bir hata bildirim kurulumunun TAMAMINI düşürürdü. Tepsiyi
 * temizleyememek bir konfor kaybı; kurulumu kaybetmek özelliğin kendisi.
 *
 * @returns temizlenen bildirim sayısı (yalnızca teşhis/test için)
 */
export async function clearDeliveredNotifications(
  sadeceKategori?: NotificationCategoryId,
): Promise<number> {
  if (!isSupportedPlatform()) return 0;

  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    const hedefler = temizlenecekler(
      (presented ?? []).map(toPresentedInfo),
      ownedCategoryIds,
      sadeceKategori,
    );

    let sayac = 0;
    for (const identifier of hedefler) {
      try {
        await Notifications.dismissNotificationAsync(identifier);
        sayac += 1;
      } catch (error) {
        // Tek bir temizliğin başarısızlığı döngüyü durdurmasın — diğerleri
        // uygulanır (`scheduler.ts`'in iptal döngüsündeki aynı gerekçe).
        logError('notifications.cleanup.dismiss', error);
      }
    }
    return sayac;
  } catch (error) {
    logError('notifications.cleanup.read', error);
    return 0;
  }
}
