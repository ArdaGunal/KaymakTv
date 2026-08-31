/**
 * Bildirim modülünün dışa açılan TEK yüzeyi.
 *
 * Modül dışından (app/, components/) yalnızca buradan import edilir; iç
 * dosya yollarına doğrudan bağlanmak, ileride dosya taşımayı imkânsız
 * kılar ve saf/yan-etkili katman ayrımını görünmez hale getirir.
 *
 * ⛔ İÇERİDEN İÇERİYE bu barrel üzerinden import ETME (modül içi dosyalar
 * birbirini göreli yolla çağırır) — aksi halde döngüsel import riski doğar.
 *
 * ⛔ Saf katman (planners/, fireTime, budget, mapCalendar) BİLİNÇLİ OLARAK
 * dışa açılmıyor: onlar `scheduling/` ve testlerin iç detayı.
 */

export { useNotificationSetup } from './hooks/useNotificationSetup';
export { useNotificationTap } from './hooks/useNotificationTap';
export { useNotificationPrefs } from './hooks/useNotificationPrefs';
export { NotificationBadge } from './components/NotificationBadge';

export type {
  NotificationCategoryId,
  NotificationPermissionStatus,
  NotificationPrefs,
} from './types';
