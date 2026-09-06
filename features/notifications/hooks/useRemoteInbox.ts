import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { ingestRemote } from '../inbox/remoteSweep';

/**
 * Uygulama ÖNDEYKEN gelen uzak bildirimleri kutuya alır
 * (docs/design/notifications.md § 11).
 *
 * 🔴 NEDEN AYRI BİR KANCA: `useNotificationSetup` açılışta BİR KEZ koşan bir
 * kurulum turu; bu ise oturum boyunca dinleyen sürekli bir abonelik. İkisini
 * aynı yere koymak, kurulum turunun her tetiklendiğinde dinleyiciyi yeniden
 * kurması riskini getirirdi.
 *
 * ⚠️ BU KANCA TEK BAŞINA YETMEZ ve yetmesi de beklenmiyor: uygulama arka
 * plandayken/kapalıyken düşen bildirimler bu dinleyiciyi TETİKLEMEZ. Onlar
 * açılıştaki tepsi süpürmesiyle (`sweepPresentedRemote`) ve tıklama
 * yanıtıyla yakalanıyor. Üç kaynağın tamamı ve kabul edilen boşluk
 * `inbox/remoteInbox.ts` başlığında.
 */
export function useRemoteInbox(): void {
  useEffect(() => {
    // `expo-notifications` web'de no-op; dinleyici kurmanın anlamı yok.
    if (Platform.OS === 'web') return;

    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      // `ingestRemote` asla throw etmez; `void` güvenli.
      void ingestRemote([notification]);
    });

    return () => subscription.remove();
  }, []);
}
