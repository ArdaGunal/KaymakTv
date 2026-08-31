import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { logError } from '../../../utils/errorLog';
import { NOTIFICATION_CATEGORIES, getCategoryMeta } from '../registry';
import type { NotificationPayloadData, ScheduledPlan } from '../types';

/**
 * Zamanlanmış bildirimleri diske uygulayan TEK yan-etki katmanı
 * (docs/design/notifications.md § 8.1).
 *
 * 🔴 FARK TABANLI (DIFF) ÇALIŞIR — "hepsini iptal et, hepsini yeniden kur"
 * BİLİNÇLİ OLARAK YAPILMIYOR. O yaklaşım her uygulama açılışında 50 sistem
 * çağrısı demek olurdu ve iptal ile yeniden kurma arasındaki pencerede tam o
 * ana denk gelen bir bildirim kalıcı olarak kaybolurdu.
 *
 * ⚠️ Saf katman (planlayıcılar, `fireTime`, `budget`) burada BİTER. Bu
 * dosyanın altında Expo çağrıları var, üstünde yok.
 */

export interface SchedulerResult {
  scheduled: number;
  cancelled: number;
  unchanged: number;
}

const EMPTY_RESULT: SchedulerResult = { scheduled: 0, cancelled: 0, unchanged: 0 };

const isSupportedPlatform = (): boolean => Platform.OS !== 'web';

/** Bu modülün yönettiği kategori kimlikleri — yabancı bildirimlere dokunmamak için. */
const ownedCategoryIds = new Set<string>(NOTIFICATION_CATEGORIES.map((c) => c.id));

/**
 * Kurulu bir bildirimin bizim ürettiğimiz yükü olup olmadığını söyler.
 *
 * NEDEN GEREKLİ: `getAllScheduledNotificationsAsync()` cihazdaki TÜM bekleyen
 * bildirimleri döndürür. F3'te uzak push'lar, ileride başka bir özellik ya da
 * bir kütüphane de bildirim kurabilir. Süzmeden iptal etmek, bizim olmayanı
 * silmek olurdu.
 */
const readOwnPayload = (
  request: Notifications.NotificationRequest,
): NotificationPayloadData | null => {
  const data = request.content?.data as Partial<NotificationPayloadData> | undefined;
  if (!data || typeof data.categoryId !== 'string') return null;
  if (!ownedCategoryIds.has(data.categoryId)) return null;
  if (typeof data.plannedFireAt !== 'number') return null;
  return data as NotificationPayloadData;
};

/**
 * İstenen plan kümesini cihaza uygular.
 *
 * @param plans Bütçesi UYGULANMIŞ plan listesi (bkz. retention/budget.ts).
 *   Bütçeyi burada uygulamıyoruz: bu katmanın tek işi farkı yazmak, karar
 *   vermek değil.
 */
export async function applyPlans(plans: readonly ScheduledPlan[]): Promise<SchedulerResult> {
  if (!isSupportedPlatform()) return EMPTY_RESULT;

  let existing: Notifications.NotificationRequest[];
  try {
    existing = await Notifications.getAllScheduledNotificationsAsync();
  } catch (error) {
    // Mevcut durumu okuyamadan fark hesaplayamayız. Körlemesine kurmak,
    // her açılışta kopya bildirim biriktirmek demek olurdu.
    logError('notifications.applyPlans.read', error);
    return EMPTY_RESULT;
  }

  const desired = new Map(plans.map((plan) => [plan.identifier, plan]));
  const result: SchedulerResult = { scheduled: 0, cancelled: 0, unchanged: 0 };

  // ── 1) Artık istenmeyenleri ve ANI DEĞİŞENLERİ iptal et ────────────────
  // Anı değişenler de iptal edilir çünkü `expo-notifications` kurulu bir
  // bildirimin tarihini "güncelleme" imkânı sunmuyor — iptal + yeniden kurma
  // tek yol.
  const staleIdentifiers = new Set<string>();

  for (const request of existing) {
    const payload = readOwnPayload(request);
    if (!payload) continue; // bizim değil, dokunma

    const plan = desired.get(request.identifier);
    if (plan && plan.fireAt === payload.plannedFireAt) {
      // Zaten doğru anda kurulu — hiçbir sistem çağrısı yapma.
      result.unchanged += 1;
      desired.delete(request.identifier);
      continue;
    }
    staleIdentifiers.add(request.identifier);
  }

  for (const identifier of staleIdentifiers) {
    try {
      await Notifications.cancelScheduledNotificationAsync(identifier);
      result.cancelled += 1;
    } catch (error) {
      // Tek bir iptalin başarısızlığı döngüyü durdurmasın; diğerleri uygulanır.
      logError(`notifications.applyPlans.cancel:${identifier}`, error);
    }
  }

  // ── 2) Kalanları kur ──────────────────────────────────────────────────
  // `desired` artık yalnızca kurulu OLMAYAN (ya da az önce iptal edilmiş)
  // planları içeriyor.
  for (const plan of desired.values()) {
    const meta = getCategoryMeta(plan.categoryId);
    if (!meta) {
      // Kayıt defterinde olmayan kategori: planlayıcı ile defter ıraksamış.
      logError(
        'notifications.applyPlans.schedule',
        new Error(`'${plan.categoryId}' kategorisi kayit defterinde yok, plan atlandi.`),
      );
      continue;
    }

    try {
      await Notifications.scheduleNotificationAsync({
        identifier: plan.identifier,
        content: {
          title: plan.title,
          body: plan.body,
          data: plan.data,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: plan.fireAt,
          // Android'de kanal ATANMAZSA bildirim varsayılan kanala düşer ve
          // kullanıcının kategori bazlı sistem ayarları işlemez.
          channelId: meta.channelId,
        },
      });
      result.scheduled += 1;
    } catch (error) {
      logError(`notifications.applyPlans.schedule:${plan.identifier}`, error);
    }
  }

  return result;
}

/**
 * Bu modülün kurduğu TÜM bekleyen bildirimleri iptal eder — ana anahtar
 * kapatıldığında çağrılır.
 *
 * ⚠️ `cancelAllScheduledNotificationsAsync()` BİLİNÇLİ OLARAK KULLANILMIYOR:
 * o çağrı cihazdaki tüm bekleyenleri siler, başka bir özelliğin kurduklarını
 * da. Burada yalnızca yükünden bizim olduğu anlaşılanlar iptal ediliyor.
 */
export async function cancelAllOwnedNotifications(): Promise<number> {
  if (!isSupportedPlatform()) return 0;

  try {
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    let cancelled = 0;

    for (const request of existing) {
      if (!readOwnPayload(request)) continue;
      try {
        await Notifications.cancelScheduledNotificationAsync(request.identifier);
        cancelled += 1;
      } catch (error) {
        logError(`notifications.cancelAll:${request.identifier}`, error);
      }
    }

    return cancelled;
  } catch (error) {
    logError('notifications.cancelAllOwnedNotifications', error);
    return 0;
  }
}
