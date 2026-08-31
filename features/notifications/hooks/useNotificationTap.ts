import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { logError } from '../../../utils/errorLog';
import type { NotificationPayloadData } from '../types';

/**
 * Bildirime tıklanınca doğru ekrana götürür (docs/design/notifications.md § 9).
 *
 * İKİ AYRI YOL VAR ve ikincisi en sık atlanan:
 *   1. Uygulama açıkken tıklama → `addNotificationResponseReceivedListener`
 *   2. 🔴 Uygulama KAPALIYKEN tıklama → bildirim uygulamayı başlatır ve
 *      yukarıdaki dinleyici kurulmadan ÖNCE olay olup biter.
 *      `getLastNotificationResponseAsync()` ile açılışta bir kez okunmazsa
 *      kullanıcı bildirime basar, uygulama ana ekranda açılır ve bildirim
 *      hiçbir şey yapmamış gibi görünür.
 *
 * ⚠️ GERİ NAVİGASYONU: buradan `router.push` ile açılan detay ekranı, yığının
 * İLK ekranı olabilir; o durumda `canGoBack()` false döner. Detay ekranları
 * `hooks/useAppBack.ts` kullandığı için (Madde 267) geri tuşu vitrine
 * atmıyor, ana ekrana düşüyor. Yeni bir hedef ekran eklerken o ekranın da
 * `useAppBack` kullandığından emin ol.
 */

/**
 * Soğuk başlangıç yanıtı SÜREÇ BAŞINA bir kez işlenir. Modül seviyesinde
 * olmasının sebebi: hook yeniden mount olduğunda (tema değişimi, hızlı
 * yenileme) `getLastNotificationResponseAsync()` AYNI yanıtı tekrar döndürür
 * ve kullanıcı bir daha o ekrana fırlatılırdı.
 */
let coldStartHandled = false;

export function useNotificationTap(): void {
  const router = useRouter();
  // `router` her render'da yeni referans olabilir; dinleyiciyi yeniden
  // kurmamak için ref üzerinden okunuyor.
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const navigate = (response: Notifications.NotificationResponse | null): void => {
      const data = response?.notification?.request?.content?.data as
        | Partial<NotificationPayloadData>
        | undefined;
      const deepLink = data?.deepLink;
      if (typeof deepLink !== 'string' || !deepLink.startsWith('/')) return;

      try {
        routerRef.current.push(deepLink as never);
      } catch (error) {
        // Silinmiş/geçersiz bir rotaya gitmek uygulamayı çökertmesin.
        logError('useNotificationTap.navigate', error);
      }
    };

    const subscription = Notifications.addNotificationResponseReceivedListener(navigate);

    if (!coldStartHandled) {
      coldStartHandled = true;
      Notifications.getLastNotificationResponseAsync()
        .then(navigate)
        .catch((error) => logError('useNotificationTap.coldStart', error));
    }

    return () => subscription.remove();
  }, []);
}
