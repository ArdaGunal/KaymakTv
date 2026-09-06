import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { logError } from '../../../utils/errorLog';
import { NOTIFICATION_CATEGORIES } from '../registry';
import { ensureInboxHydrated, useInboxStore } from './useInboxStore';
import { remoteEntries, type RemoteNotificationInfo } from './remoteInbox';

/**
 * Uzak bildirimleri kutuya sokan ADAPTÖR
 * (docs/design/notifications.md § 11).
 *
 * ⚙️ KARAR BURADA DEĞİL: hangi bildirimin kutuya gireceğine `remoteInbox.ts`
 * (SAF) karar veriyor; bu dosya yalnızca okuma/yazma yapar. Üç kaynağın
 * gerekçesi ve kabul edilen boşluk orada yazılı.
 */

/** `cleanup.ts`/`scheduler.ts` ile AYNI koruma: web'de `expo-notifications` yok. */
const isSupportedPlatform = (): boolean => Platform.OS !== 'web';

/**
 * 🔴 YALNIZCA `kind: 'remote'` KATEGORİLER. Yerel kategoriler kutuya zaten
 * defterden giriyor; buradan da almak ikinci bir yol açar ve defterin
 * "vakti geçti mi?" mantığını baypas ederdi.
 *
 * `registry`'den TÜRETİLİYOR, elle liste tutulmuyor — yeni bir uzak kategori
 * eklendiğinde burası kendiliğinden kapsar (`cleanup.ts`'teki aynı gerekçe).
 */
const remoteCategoryIds = new Set<string>(
  NOTIFICATION_CATEGORIES.filter((c) => c.kind === 'remote').map((c) => c.id),
);

/** `expo-notifications` nesnesini saf katmanın anladığı şekle indirger. */
export function toRemoteInfo(n: Notifications.Notification): RemoteNotificationInfo {
  const content = n?.request?.content;
  return {
    identifier: n?.request?.identifier ?? '',
    title: content?.title,
    body: content?.body,
    data: content?.data,
    // `Notification.date` platforma göre saniye/ms olabiliyor; normalizasyon
    // saf katmanda (`remoteInbox.normalizeAt`).
    receivedAt: (n as { date?: unknown })?.date,
  };
}

/**
 * Verilen uzak bildirimleri kutuya ekler.
 *
 * 🔴 ASLA THROW ETMEZ — açılış akışından çağrılıyor; buradan sızacak bir hata
 * bildirim kurulumunun tamamını düşürürdü (`cleanup.ts` ile aynı sözleşme).
 *
 * @returns kutuya eklenmek üzere gönderilen kayıt sayısı (teşhis/test için)
 */
export async function ingestRemote(
  list: readonly Notifications.Notification[],
): Promise<number> {
  try {
    const entries = remoteEntries(list.map(toRemoteInfo), remoteCategoryIds, Date.now());
    if (entries.length === 0) return 0;
    await ensureInboxHydrated();
    useInboxStore.getState().ingest(entries);
    return entries.length;
  } catch (error) {
    logError('notifications.remoteSweep.ingest', error);
    return 0;
  }
}

/**
 * Tepside HÂLÂ duran uzak bildirimleri kutuya alır.
 *
 * 🔴 TEPSİ TEMİZLİĞİNDEN **ÖNCE** ÇAĞRILMAK ZORUNDA. `clearDeliveredNotifications()`
 * `social`'ı bizim kategorimiz saydığı için tepsiden siliyor; sonra
 * çağrılsaydı okunacak bir şey kalmazdı ve bildirim tamamen kaybolurdu.
 * Bu, `useNotificationSetup` içindeki çağrı sırasının GERÇEK bir kısıtıdır —
 * `cleanup.ts` başlığındaki "sıralama tuzağı yok" notu bu iş eklenmeden
 * önceki duruma aitti ve orada düzeltildi.
 */
export async function sweepPresentedRemote(): Promise<number> {
  if (!isSupportedPlatform()) return 0;
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    return await ingestRemote(presented ?? []);
  } catch (error) {
    logError('notifications.remoteSweep.read', error);
    return 0;
  }
}
