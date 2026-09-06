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
 * 🔴 SIRALAMA TUZAĞI VAR — UZAK BİLDİRİMLER İÇİN
 * ==========================================================================
 * ⚠️ Bu başlık eskiden *"sıralama tuzağı YOK"* diyordu ve o gün DOĞRUYDU:
 * kutu yalnızca **deftere** (ledger) dayanıyordu, yani tepsiyi silmek onu
 * etkilemiyordu. F3 dilim 2 bunu DEĞİŞTİRDİ.
 *
 * **YEREL bildirimler için hâlâ tuzak yok.** `inbox/sweep.ts` başlığındaki
 * gerekçe geçerli: kutu `getPresentedNotificationsAsync()`'e değil, diske
 * yazılan deftere dayanıyor.
 *
 * 🔴 **UZAK (sosyal) bildirimler için tuzak GERÇEK.** Onları biz kurmadığımız
 * için defterleri YOK; kutuya girmelerinin bir yolu tepsiyi okumak
 * (`inbox/remoteSweep.ts` → `sweepPresentedRemote`). Bu fonksiyon `social`'ı
 * bizim kategorimiz sayıp SİLDİĞİ için, süpürme BUNDAN ÖNCE çalışmak
 * zorunda. `useNotificationSetup` çağrı sırası bu yüzden anlamlıdır ve orada
 * `await` ile sabitlenmiştir.
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
